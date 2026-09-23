export type ParticipantRole = 'HOST' | 'PARTICIPANT';

export interface MuteState {
  audio: boolean;
  video: boolean;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  designation?: string;
  role: ParticipantRole;
  handRaised: boolean;
  muted: MuteState;
  joinedAt: number;
}

export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';

export interface MeetingSummary {
  id: string;
  companyName: string;
  title: string;
  status: MeetingStatus;
  participantCount: number;
  createdAt: number;
  scheduledAt?: number;
  logoUrl?: string;
  waitingVideoUrl?: string;
  tagline?: string;
}

export interface ProducerInfo {
  producerId: string;
  participantId: string;
  kind: 'audio' | 'video';
}
