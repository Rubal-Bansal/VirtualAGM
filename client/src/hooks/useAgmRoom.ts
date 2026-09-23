import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Producer, RtpCapabilities } from 'mediasoup-client/types';
import { connectSocket, emitWithAck } from '../lib/socket';
import { MediaClient, getLocalMediaStream, getScreenShareStream } from '../lib/mediasoupClient';
import { MeetingStatus, ParticipantInfo, ParticipantRole, RemoteProducerRef } from '../types';

interface JoinResponse {
  participantId: string;
  role: ParticipantRole;
  companyName: string;
  title: string;
  scheduledAt?: number;
  logoUrl?: string;
  waitingVideoUrl?: string;
  tagline?: string;
  rtpCapabilities: RtpCapabilities;
  participants: ParticipantInfo[];
  producers: RemoteProducerRef[];
  meetingStatus: MeetingStatus;
  spotlightParticipantIds: string[];
  votingEndsAt: number | null;
}

interface ConsumedTrackInfo {
  participantId: string;
  source: 'camera' | 'screen';
  track: MediaStreamTrack;
}

export interface AgmRoomState {
  status: 'connecting' | 'joined' | 'error' | 'ended';
  error?: string;
  selfId?: string;
  selfRole?: ParticipantRole;
  companyName?: string;
  title?: string;
  scheduledAt?: number;
  logoUrl?: string;
  waitingVideoUrl?: string;
  tagline?: string;
  meetingStatus: MeetingStatus;
  participants: ParticipantInfo[];
  localStream?: MediaStream;
  remoteStreams: Map<string, MediaStream>;
  screenShares: Map<string, MediaStream>;
  isSharingScreen: boolean;
  spotlightParticipantIds: string[];
  votingEndsAt: number | null;
  setMute: (participantId: string, kind: 'audio' | 'video', muted: boolean) => void;
  setSpotlight: (participantIds: string[]) => void;
  raiseHand: () => void;
  lowerHand: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  startVoting: (durationMinutes: number) => void;
  stopVoting: () => void;
  endMeeting: () => void;
}

export interface JoinInfo {
  name?: string;
  designation?: string;
}

export function useAgmRoom(token: string, joinInfo?: JoinInfo): AgmRoomState {
  const [status, setStatus] = useState<AgmRoomState['status']>('connecting');
  const [error, setError] = useState<string>();
  const [selfId, setSelfId] = useState<string>();
  const [selfRole, setSelfRole] = useState<ParticipantRole>();
  const [companyName, setCompanyName] = useState<string>();
  const [title, setTitle] = useState<string>();
  const [scheduledAt, setScheduledAt] = useState<number>();
  const [logoUrl, setLogoUrl] = useState<string>();
  const [waitingVideoUrl, setWaitingVideoUrl] = useState<string>();
  const [tagline, setTagline] = useState<string>();
  const [meetingStatus, setMeetingStatus] = useState<MeetingStatus>('SCHEDULED');
  const [spotlightParticipantIds, setSpotlightParticipantIds] = useState<string[]>([]);
  const [votingEndsAt, setVotingEndsAt] = useState<number | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [screenShares, setScreenShares] = useState<Map<string, MediaStream>>(new Map());
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const socketRef = useRef<Socket>();
  const mediaClientRef = useRef<MediaClient>();
  const screenProducerRef = useRef<Producer>();
  const trackInfoByProducerId = useRef<Map<string, ConsumedTrackInfo>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let producing = false;
    const socket = connectSocket();
    socketRef.current = socket;
    const mediaClient = new MediaClient(socket);
    mediaClientRef.current = mediaClient;

    function addTrack(participantId: string, source: 'camera' | 'screen', track: MediaStreamTrack) {
      const setter = source === 'screen' ? setScreenShares : setRemoteStreams;
      setter((prev) => {
        const next = new Map(prev);
        const existing = next.get(participantId) ?? new MediaStream();
        existing.addTrack(track);
        next.set(participantId, existing);
        return next;
      });
    }

    async function consumeProducer(ref: RemoteProducerRef) {
      const consumer = await mediaClient.consume(ref.producerId);
      trackInfoByProducerId.current.set(ref.producerId, {
        participantId: ref.participantId,
        source: ref.source,
        track: consumer.track,
      });
      addTrack(ref.participantId, ref.source, consumer.track);
    }

    async function startProducingLocalMedia() {
      if (producing) return;
      producing = true;
      const stream = await getLocalMediaStream();
      if (cancelled) return;
      setLocalStream(stream);
      for (const track of stream.getTracks()) {
        await mediaClient.produce(track, { source: 'camera' });
      }
    }

    async function run() {
      try {
        const joinResult = await emitWithAck<{ token: string; name?: string; designation?: string }, JoinResponse>(
          socket,
          'join',
          { token, name: joinInfo?.name, designation: joinInfo?.designation },
        );

        if (cancelled) return;
        setSelfId(joinResult.participantId);
        setSelfRole(joinResult.role);
        setCompanyName(joinResult.companyName);
        setTitle(joinResult.title);
        setScheduledAt(joinResult.scheduledAt);
        setLogoUrl(joinResult.logoUrl);
        setWaitingVideoUrl(joinResult.waitingVideoUrl);
        setTagline(joinResult.tagline);
        setParticipants(joinResult.participants);
        setMeetingStatus(joinResult.meetingStatus);
        setSpotlightParticipantIds(joinResult.spotlightParticipantIds);
        setVotingEndsAt(joinResult.votingEndsAt);

        await mediaClient.load(joinResult.rtpCapabilities);

        for (const producer of joinResult.producers) {
          await consumeProducer(producer);
        }

        if (joinResult.meetingStatus === 'LIVE') {
          await startProducingLocalMedia();
        }

        setStatus('joined');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to join meeting');
        setStatus('error');
      }
    }

    socket.on('participantJoined', ({ participant }: { participant: ParticipantInfo }) => {
      setParticipants((prev) => [...prev.filter((p) => p.id !== participant.id), participant]);
    });

    socket.on('participantLeft', ({ participantId }: { participantId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });
      setScreenShares((prev) => {
        const next = new Map(prev);
        next.delete(participantId);
        return next;
      });
    });

    socket.on('newProducer', async (ref: RemoteProducerRef) => {
      try {
        await consumeProducer(ref);
      } catch (err) {
        console.error('Failed to consume new producer', err);
      }
    });

    socket.on('producerClosed', ({ producerId }: { producerId: string }) => {
      const info = trackInfoByProducerId.current.get(producerId);
      if (!info) return;
      trackInfoByProducerId.current.delete(producerId);
      info.track.stop();
      const setter = info.source === 'screen' ? setScreenShares : setRemoteStreams;
      setter((prev) => {
        const stream = prev.get(info.participantId);
        if (!stream) return prev;
        stream.removeTrack(info.track);
        const next = new Map(prev);
        if (stream.getTracks().length === 0) {
          next.delete(info.participantId);
        } else {
          next.set(info.participantId, stream);
        }
        return next;
      });
    });

    socket.on(
      'participantMuteChanged',
      ({ participantId, kind, muted }: { participantId: string; kind: 'audio' | 'video'; muted: boolean }) => {
        setParticipants((prev) =>
          prev.map((p) => (p.id === participantId ? { ...p, muted: { ...p.muted, [kind]: muted } } : p)),
        );
      },
    );

    socket.on('handRaised', ({ participantId }: { participantId: string }) => {
      setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, handRaised: true } : p)));
    });

    socket.on('handLowered', ({ participantId }: { participantId: string }) => {
      setParticipants((prev) => prev.map((p) => (p.id === participantId ? { ...p, handRaised: false } : p)));
    });

    socket.on('meetingStarted', async ({ meetingStatus: newStatus }: { meetingStatus: MeetingStatus }) => {
      setMeetingStatus(newStatus);
      if (newStatus === 'LIVE') {
        try {
          await startProducingLocalMedia();
        } catch (err) {
          console.error('Failed to start local media after meeting started', err);
        }
      }
    });

    socket.on('spotlightChanged', ({ participantIds }: { participantIds: string[] }) => {
      setSpotlightParticipantIds(participantIds);
    });

    socket.on('votingChanged', ({ votingEndsAt: newVotingEndsAt }: { votingEndsAt: number | null }) => {
      setVotingEndsAt(newVotingEndsAt);
    });

    socket.on('meetingEnded', () => {
      setStatus('ended');
    });

    run();

    return () => {
      cancelled = true;
      socket.disconnect();
      setLocalStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return undefined;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selfRole !== 'HOST' || votingEndsAt === null) return;
    const endNow = () => {
      socketRef.current && emitWithAck(socketRef.current, 'hostEndMeeting', undefined).catch(console.error);
    };
    const delay = votingEndsAt - Date.now();
    if (delay <= 0) {
      endNow();
      return;
    }
    const timer = setTimeout(endNow, delay);
    return () => clearTimeout(timer);
  }, [selfRole, votingEndsAt]);

  return {
    status,
    error,
    selfId,
    selfRole,
    companyName,
    title,
    scheduledAt,
    logoUrl,
    waitingVideoUrl,
    tagline,
    meetingStatus,
    participants,
    localStream,
    remoteStreams,
    screenShares,
    isSharingScreen,
    spotlightParticipantIds,
    votingEndsAt,
    setMute: (participantId, kind, muted) => {
      socketRef.current &&
        emitWithAck(socketRef.current, 'hostSetMute', { participantId, kind, muted }).catch(console.error);
    },
    setSpotlight: (participantIds) => {
      socketRef.current &&
        emitWithAck(socketRef.current, 'hostSetSpotlight', { participantIds }).catch(console.error);
    },
    raiseHand: () => {
      socketRef.current && emitWithAck(socketRef.current, 'raiseHand', undefined).catch(console.error);
    },
    lowerHand: () => {
      socketRef.current && emitWithAck(socketRef.current, 'lowerHand', undefined).catch(console.error);
    },
    startScreenShare: async () => {
      const mediaClient = mediaClientRef.current;
      if (!mediaClient || isSharingScreen) return;
      const screenStream = await getScreenShareStream();
      const track = screenStream.getVideoTracks()[0];
      const producer = await mediaClient.produce(track, { source: 'screen' });
      screenProducerRef.current = producer;
      setIsSharingScreen(true);
      track.addEventListener('ended', () => {
        screenProducerRef.current = undefined;
        setIsSharingScreen(false);
      });
    },
    stopScreenShare: () => {
      const mediaClient = mediaClientRef.current;
      const producer = screenProducerRef.current;
      if (!mediaClient || !producer) return;
      mediaClient.closeProducer(producer);
      screenProducerRef.current = undefined;
      setIsSharingScreen(false);
    },
    startVoting: (durationMinutes) => {
      socketRef.current &&
        emitWithAck(socketRef.current, 'hostStartVoting', { durationMinutes }).catch(console.error);
    },
    stopVoting: () => {
      socketRef.current && emitWithAck(socketRef.current, 'hostStopVoting', undefined).catch(console.error);
    },
    endMeeting: () => {
      socketRef.current && emitWithAck(socketRef.current, 'hostEndMeeting', undefined).catch(console.error);
    },
  };
}
