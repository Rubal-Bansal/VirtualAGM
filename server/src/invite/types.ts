import { ParticipantRole } from '../meeting/types';

export interface InviteInfo {
  token: string;
  meetingId: string;
  role: ParticipantRole;
  name: string;
  used: boolean;
  createdAt: number;
}
