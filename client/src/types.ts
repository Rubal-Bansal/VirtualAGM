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

export interface MeetingDetail extends MeetingSummary {
  participantJoinUrl: string;
  participants: ParticipantInfo[];
}

export interface CreatedMeeting {
  id: string;
  companyName: string;
  title: string;
  status: MeetingStatus;
  scheduledAt?: number;
  logoUrl?: string;
  waitingVideoUrl?: string;
  tagline?: string;
  hostToken: string;
  hostJoinUrl: string;
  participantJoinUrl: string;
}

export type MediaSource = 'camera' | 'screen';

export interface RemoteProducerRef {
  producerId: string;
  participantId: string;
  kind: 'audio' | 'video';
  source: MediaSource;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}
