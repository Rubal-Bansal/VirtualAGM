import { randomBytes } from 'crypto';
import * as mediasoup from 'mediasoup';
import { getNextWorker } from '../mediasoup/workerPool';
import { routerMediaCodecs, webRtcTransportOptions } from '../config/mediasoup';
import { persist, pool } from '../db/db';
import { MeetingStatus, MuteState, ParticipantInfo, ParticipantRole } from './types';

interface ParticipantState extends ParticipantInfo {
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
}

export interface MeetingBranding {
  scheduledAt?: number;
  logoUrl?: string;
  waitingVideoUrl?: string;
  tagline?: string;
}

/** Fields loaded back from the database when a meeting is restored after a server restart. */
export interface MeetingRestore {
  participantJoinToken: string;
  createdAt: number;
  status: MeetingStatus;
}

/**
 * One AGM/board meeting room. Wraps a dedicated mediasoup Router and tracks
 * participants, their transports, producers (things they send) and
 * consumers (things they receive).
 */
export class Meeting {
  readonly id: string;
  readonly companyName: string;
  readonly title: string;
  readonly createdAt: number;
  readonly scheduledAt?: number;
  readonly logoUrl?: string;
  readonly waitingVideoUrl?: string;
  readonly tagline?: string;
  /** One reusable link every shareholder joins with as a speaker — not tied to any individual identity. */
  readonly participantJoinToken: string;
  status: MeetingStatus = 'SCHEDULED';
  spotlightParticipantIds: string[] = [];
  votingEndsAt: number | null = null;

  private router!: mediasoup.types.Router;
  private participants = new Map<string, ParticipantState>();

  private constructor(
    id: string,
    companyName: string,
    title: string,
    branding: MeetingBranding,
    restore?: MeetingRestore,
  ) {
    this.id = id;
    this.createdAt = restore?.createdAt ?? Date.now();
    this.participantJoinToken = restore?.participantJoinToken ?? randomBytes(24).toString('hex');
    if (restore) this.status = restore.status;
    this.companyName = companyName;
    this.title = title;
    this.scheduledAt = branding.scheduledAt;
    this.logoUrl = branding.logoUrl;
    this.waitingVideoUrl = branding.waitingVideoUrl;
    this.tagline = branding.tagline;
  }

  static async create(
    id: string,
    companyName: string,
    title: string,
    branding: MeetingBranding = {},
    restore?: MeetingRestore,
  ): Promise<Meeting> {
    const meeting = new Meeting(id, companyName, title, branding, restore);
    const worker = getNextWorker();
    meeting.router = await worker.createRouter({ mediaCodecs: routerMediaCodecs });
    return meeting;
  }

  getRtpCapabilities(): mediasoup.types.RtpCapabilities {
    return this.router.rtpCapabilities;
  }

  addParticipant(id: string, name: string, role: ParticipantRole, designation?: string): ParticipantInfo {
    const participant: ParticipantState = {
      id,
      name,
      designation,
      role,
      handRaised: false,
      muted: { audio: false, video: false },
      joinedAt: Date.now(),
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    this.participants.set(id, participant);
    if (role === 'HOST' && this.status !== 'LIVE') {
      this.status = 'LIVE';
      persist('meeting status', pool.query('UPDATE meetings SET status = $1 WHERE id = $2', ['LIVE', this.id]));
    }
    persist(
      'attendance join',
      pool.query(
        'INSERT INTO attendance (meeting_id, participant_id, name, designation, role) VALUES ($1, $2, $3, $4, $5)',
        [this.id, id, name, designation ?? null, role],
      ),
    );
    return this.toParticipantInfo(participant);
  }

  removeParticipant(id: string): void {
    const participant = this.participants.get(id);
    if (!participant) return;
    participant.consumers.forEach((c) => c.close());
    participant.producers.forEach((p) => p.close());
    participant.transports.forEach((t) => t.close());
    this.participants.delete(id);
    persist(
      'attendance leave',
      pool.query(
        'UPDATE attendance SET left_at = now() WHERE meeting_id = $1 AND participant_id = $2 AND left_at IS NULL',
        [this.id, id],
      ),
    );
    if (this.spotlightParticipantIds.includes(id)) {
      this.spotlightParticipantIds = this.spotlightParticipantIds.filter((p) => p !== id);
    }
  }

  setSpotlight(participantIds: string[]): void {
    for (const id of participantIds) {
      if (!this.participants.has(id)) {
        throw new Error('Participant not found');
      }
    }
    this.spotlightParticipantIds = [...new Set(participantIds)];
  }

  getParticipant(id: string): ParticipantState | undefined {
    return this.participants.get(id);
  }

  listParticipants(): ParticipantInfo[] {
    return Array.from(this.participants.values()).map((p) => this.toParticipantInfo(p));
  }

  isEmpty(): boolean {
    return this.participants.size === 0;
  }

  /** Timer-only e-voting window — casting/tallying votes is a separate future module. */
  startVoting(durationMinutes: number): void {
    this.votingEndsAt = Date.now() + durationMinutes * 60_000;
  }

  stopVoting(): void {
    this.votingEndsAt = null;
  }

  setHandRaised(participantId: string, raised: boolean): void {
    const participant = this.requireParticipant(participantId);
    participant.handRaised = raised;
  }

  /** Host-controlled hard mute/unmute: pauses or resumes the participant's producer(s) of the given kind. */
  async setMute(participantId: string, kind: mediasoup.types.MediaKind, muted: boolean): Promise<void> {
    const participant = this.requireParticipant(participantId);
    const producers = Array.from(participant.producers.values()).filter((p) => p.kind === kind);
    await Promise.all(producers.map((p) => (muted ? p.pause() : p.resume())));
    participant.muted[kind] = muted;
  }

  async createWebRtcTransport(participantId: string): Promise<mediasoup.types.WebRtcTransport> {
    const participant = this.requireParticipant(participantId);
    const transport = await this.router.createWebRtcTransport(webRtcTransportOptions);
    participant.transports.set(transport.id, transport);
    transport.on('dtlsstatechange', (state) => {
      if (state === 'closed') transport.close();
    });
    return transport;
  }

  getTransport(participantId: string, transportId: string): mediasoup.types.WebRtcTransport {
    const participant = this.requireParticipant(participantId);
    const transport = participant.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');
    return transport;
  }

  async produce(
    participantId: string,
    transportId: string,
    kind: mediasoup.types.MediaKind,
    rtpParameters: mediasoup.types.RtpParameters,
    source: 'camera' | 'screen' = 'camera',
  ): Promise<mediasoup.types.Producer> {
    const participant = this.requireParticipant(participantId);
    const transport = this.getTransport(participantId, transportId);
    const producer = await transport.produce({
      kind,
      rtpParameters,
      paused: source === 'camera' && participant.muted[kind],
      appData: { source },
    });
    participant.producers.set(producer.id, producer);
    return producer;
  }

  /** Closes a single producer (e.g. stopping a screen share) without touching the rest of the participant's media. */
  closeProducer(participantId: string, producerId: string): void {
    const participant = this.requireParticipant(participantId);
    const producer = participant.producers.get(producerId);
    if (!producer) throw new Error('Producer not found');
    producer.close();
    participant.producers.delete(producerId);
  }

  canConsume(producerId: string, rtpCapabilities: mediasoup.types.RtpCapabilities): boolean {
    return this.router.canConsume({ producerId, rtpCapabilities });
  }

  async consume(
    participantId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities,
  ): Promise<mediasoup.types.Consumer> {
    const participant = this.requireParticipant(participantId);
    const transport = this.getTransport(participantId, transportId);
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });
    participant.consumers.set(consumer.id, consumer);
    return consumer;
  }

  /** All producers in the meeting except the given participant's own. */
  listProducersExcept(
    participantId: string,
  ): { producerId: string; participantId: string; kind: string; source: 'camera' | 'screen' }[] {
    const result: { producerId: string; participantId: string; kind: string; source: 'camera' | 'screen' }[] = [];
    this.participants.forEach((p, id) => {
      if (id === participantId) return;
      p.producers.forEach((producer) => {
        result.push({
          producerId: producer.id,
          participantId: id,
          kind: producer.kind,
          source: (producer.appData?.source as 'camera' | 'screen') ?? 'camera',
        });
      });
    });
    return result;
  }

  findProducerOwner(producerId: string): string | undefined {
    for (const [id, p] of this.participants) {
      if (p.producers.has(producerId)) return id;
    }
    return undefined;
  }

  end(): void {
    this.participants.forEach((_, id) => this.removeParticipant(id));
    this.router.close();
    this.status = 'ENDED';
  }

  private requireParticipant(id: string): ParticipantState {
    const participant = this.participants.get(id);
    if (!participant) throw new Error('Participant not found');
    return participant;
  }

  private toParticipantInfo(p: ParticipantState): ParticipantInfo {
    return {
      id: p.id,
      name: p.name,
      designation: p.designation,
      role: p.role,
      handRaised: p.handRaised,
      muted: { ...p.muted } as MuteState,
      joinedAt: p.joinedAt,
    };
  }
}
