import { Server, Socket } from 'socket.io';
import * as mediasoup from 'mediasoup';
import { meetingManager } from '../meeting/MeetingManager';
import { Meeting } from '../meeting/Meeting';
import { inviteManager } from '../invite/InviteManager';

interface SocketData {
  meetingId?: string;
  participantId?: string;
}

function room(meetingId: string): string {
  return `meeting:${meetingId}`;
}

function requireMeeting(meetingId: string | undefined): Meeting {
  if (!meetingId) throw new Error('Not joined to a meeting');
  const meeting = meetingManager.getMeeting(meetingId);
  if (!meeting) throw new Error('Meeting not found');
  return meeting;
}

type Ack<T> = (response: { ok: true; data: T } | { ok: false; error: string }) => void;

function safeHandler<Args extends unknown[], T>(
  handler: (...args: Args) => Promise<T>,
): (...args: [...Args, Ack<T>]) => void {
  return async (...allArgs: unknown[]) => {
    const ack = allArgs[allArgs.length - 1] as Ack<T>;
    const args = allArgs.slice(0, -1) as Args;
    try {
      const data = await handler(...args);
      ack({ ok: true, data });
    } catch (err) {
      ack({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };
}

export function registerSignaling(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on(
      'join',
      safeHandler(async (payload: { token: string; name?: string; designation?: string }) => {
        const hostInvite = inviteManager.get(payload.token);
        let meetingId: string;
        let role: 'HOST' | 'PARTICIPANT';
        let name: string;
        let designation: string | undefined;

        if (hostInvite) {
          meetingId = hostInvite.meetingId;
          role = hostInvite.role;
          name = hostInvite.name;
        } else {
          const resolvedMeetingId = meetingManager.resolveParticipantToken(payload.token);
          if (!resolvedMeetingId) {
            throw new Error('Invalid or expired join link');
          }
          const trimmedName = (payload.name ?? '').trim();
          if (!trimmedName) {
            throw new Error('Name is required to join');
          }
          meetingId = resolvedMeetingId;
          role = 'PARTICIPANT';
          name = trimmedName;
          designation = payload.designation?.trim() || undefined;
        }

        const meeting = requireMeeting(meetingId);
        const wasLive = meeting.status === 'LIVE';

        const participantId = socket.id;
        const participant = meeting.addParticipant(participantId, name, role, designation);
        if (hostInvite) inviteManager.markUsed(hostInvite.token);

        data.meetingId = meeting.id;
        data.participantId = participantId;
        socket.join(room(meeting.id));

        socket.to(room(meeting.id)).emit('participantJoined', { participant });

        if (!wasLive && meeting.status === 'LIVE') {
          socket.to(room(meeting.id)).emit('meetingStarted', { meetingStatus: meeting.status });
        }

        return {
          participantId,
          role,
          companyName: meeting.companyName,
          title: meeting.title,
          scheduledAt: meeting.scheduledAt,
          logoUrl: meeting.logoUrl,
          waitingVideoUrl: meeting.waitingVideoUrl,
          tagline: meeting.tagline,
          rtpCapabilities: meeting.getRtpCapabilities(),
          participants: meeting.listParticipants(),
          producers: meeting.listProducersExcept(participantId),
          meetingStatus: meeting.status,
          spotlightParticipantIds: meeting.spotlightParticipantIds,
          votingEndsAt: meeting.votingEndsAt,
        };
      }),
    );

    socket.on(
      'createTransport',
      safeHandler(async () => {
        const meeting = requireMeeting(data.meetingId);
        const transport = await meeting.createWebRtcTransport(data.participantId!);
        return {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        };
      }),
    );

    socket.on(
      'connectTransport',
      safeHandler(async (payload: { transportId: string; dtlsParameters: mediasoup.types.DtlsParameters }) => {
        const meeting = requireMeeting(data.meetingId);
        const transport = meeting.getTransport(data.participantId!, payload.transportId);
        await transport.connect({ dtlsParameters: payload.dtlsParameters });
        return { connected: true };
      }),
    );

    socket.on(
      'produce',
      safeHandler(async (payload: {
        transportId: string;
        kind: mediasoup.types.MediaKind;
        rtpParameters: mediasoup.types.RtpParameters;
        appData?: { source?: 'camera' | 'screen' };
      }) => {
        const meeting = requireMeeting(data.meetingId);
        const source = payload.appData?.source ?? 'camera';
        const producer = await meeting.produce(
          data.participantId!,
          payload.transportId,
          payload.kind,
          payload.rtpParameters,
          source,
        );
        socket.to(room(meeting.id)).emit('newProducer', {
          producerId: producer.id,
          participantId: data.participantId,
          kind: producer.kind,
          source,
        });
        producer.on('transportclose', () => {
          socket.to(room(meeting.id)).emit('producerClosed', {
            producerId: producer.id,
            participantId: data.participantId,
          });
        });
        return { id: producer.id };
      }),
    );

    socket.on(
      'closeProducer',
      safeHandler(async (payload: { producerId: string }) => {
        const meeting = requireMeeting(data.meetingId);
        meeting.closeProducer(data.participantId!, payload.producerId);
        io.to(room(meeting.id)).emit('producerClosed', {
          producerId: payload.producerId,
          participantId: data.participantId,
        });
        return { ok: true };
      }),
    );

    socket.on(
      'consume',
      safeHandler(async (payload: {
        transportId: string;
        producerId: string;
        rtpCapabilities: mediasoup.types.RtpCapabilities;
      }) => {
        const meeting = requireMeeting(data.meetingId);
        if (!meeting.canConsume(payload.producerId, payload.rtpCapabilities)) {
          throw new Error('Cannot consume this producer with the given capabilities');
        }
        const consumer = await meeting.consume(
          data.participantId!,
          payload.transportId,
          payload.producerId,
          payload.rtpCapabilities,
        );
        return {
          id: consumer.id,
          producerId: payload.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        };
      }),
    );

    socket.on(
      'resumeConsumer',
      safeHandler(async (payload: { consumerId: string }) => {
        const meeting = requireMeeting(data.meetingId);
        const participant = meeting.getParticipant(data.participantId!);
        const consumer = participant?.consumers.get(payload.consumerId);
        if (!consumer) throw new Error('Consumer not found');
        await consumer.resume();
        return { resumed: true };
      }),
    );

    socket.on(
      'hostSetMute',
      safeHandler(async (payload: { participantId: string; kind: mediasoup.types.MediaKind; muted: boolean }) => {
        const meeting = requireMeeting(data.meetingId);
        const requester = meeting.getParticipant(data.participantId!);
        if (!requester || requester.role !== 'HOST') {
          throw new Error('Only the host can mute or unmute a participant');
        }
        await meeting.setMute(payload.participantId, payload.kind, payload.muted);
        io.to(room(meeting.id)).emit('participantMuteChanged', {
          participantId: payload.participantId,
          kind: payload.kind,
          muted: payload.muted,
        });
        return { ok: true };
      }),
    );

    socket.on(
      'hostSetSpotlight',
      safeHandler(async (payload: { participantIds: string[] }) => {
        const meeting = requireMeeting(data.meetingId);
        const requester = meeting.getParticipant(data.participantId!);
        if (!requester || requester.role !== 'HOST') {
          throw new Error('Only the host can set the spotlight');
        }
        meeting.setSpotlight(payload.participantIds);
        io.to(room(meeting.id)).emit('spotlightChanged', { participantIds: meeting.spotlightParticipantIds });
        return { ok: true };
      }),
    );

    socket.on(
      'hostStartVoting',
      safeHandler(async (payload: { durationMinutes: number }) => {
        const meeting = requireMeeting(data.meetingId);
        const requester = meeting.getParticipant(data.participantId!);
        if (!requester || requester.role !== 'HOST') {
          throw new Error('Only the host can start e-voting');
        }
        meeting.startVoting(payload.durationMinutes);
        io.to(room(meeting.id)).emit('votingChanged', { votingEndsAt: meeting.votingEndsAt });
        return { ok: true };
      }),
    );

    socket.on(
      'hostStopVoting',
      safeHandler(async () => {
        const meeting = requireMeeting(data.meetingId);
        const requester = meeting.getParticipant(data.participantId!);
        if (!requester || requester.role !== 'HOST') {
          throw new Error('Only the host can stop e-voting');
        }
        meeting.stopVoting();
        io.to(room(meeting.id)).emit('votingChanged', { votingEndsAt: meeting.votingEndsAt });
        return { ok: true };
      }),
    );

    socket.on(
      'hostEndMeeting',
      safeHandler(async () => {
        const meeting = requireMeeting(data.meetingId);
        const requester = meeting.getParticipant(data.participantId!);
        if (!requester || requester.role !== 'HOST') {
          throw new Error('Only the host can end the meeting');
        }
        io.to(room(meeting.id)).emit('meetingEnded');
        meetingManager.endMeeting(meeting.id);
        return { ok: true };
      }),
    );

    socket.on(
      'raiseHand',
      safeHandler(async () => {
        const meeting = requireMeeting(data.meetingId);
        meeting.setHandRaised(data.participantId!, true);
        io.to(room(meeting.id)).emit('handRaised', { participantId: data.participantId });
        return { ok: true };
      }),
    );

    socket.on(
      'lowerHand',
      safeHandler(async () => {
        const meeting = requireMeeting(data.meetingId);
        meeting.setHandRaised(data.participantId!, false);
        io.to(room(meeting.id)).emit('handLowered', { participantId: data.participantId });
        return { ok: true };
      }),
    );

    socket.on('disconnect', () => {
      if (!data.meetingId || !data.participantId) return;
      const meeting = meetingManager.getMeeting(data.meetingId);
      if (!meeting) return;
      meeting.removeParticipant(data.participantId);
      socket.to(room(data.meetingId)).emit('participantLeft', { participantId: data.participantId });
      // The meeting stays alive even if the host disconnects (e.g. a dropped
      // connection during a multi-hour session) — they can rejoin with the
      // same invite link. Host explicitly ends the meeting via DELETE /api/meetings/:id.
    });
  });
}
