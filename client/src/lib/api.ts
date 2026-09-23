import { CreatedMeeting, MeetingDetail, MeetingSummary } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface MeetingBrandingInput {
  scheduledAt?: string;
  logoUrl?: string;
  waitingVideoUrl?: string;
  tagline?: string;
}

export async function createMeeting(
  companyName: string,
  title: string,
  hostName: string,
  branding: MeetingBrandingInput = {},
): Promise<CreatedMeeting> {
  const res = await fetch(`${SERVER_URL}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName, title, hostName, ...branding }),
  });
  if (!res.ok) throw new Error('Failed to create meeting');
  return res.json();
}

export async function listMeetings(): Promise<MeetingSummary[]> {
  const res = await fetch(`${SERVER_URL}/api/meetings`);
  if (!res.ok) throw new Error('Failed to list meetings');
  return res.json();
}

export async function getMeeting(id: string): Promise<MeetingDetail> {
  const res = await fetch(`${SERVER_URL}/api/meetings/${id}`);
  if (!res.ok) throw new Error('Meeting not found');
  return res.json();
}

export { SERVER_URL };
