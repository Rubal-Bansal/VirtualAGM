import { Router } from 'express';
import { meetingManager } from '../meeting/MeetingManager';
import { inviteManager } from '../invite/InviteManager';
import { env } from '../config/env';

export const meetingsRouter = Router();

function hostJoinUrl(token: string): string {
  return `${env.clientOrigin}/room/${token}`;
}

function participantJoinUrl(token: string): string {
  return `${env.clientOrigin}/join/${token}`;
}

meetingsRouter.get('/', (_req, res) => {
  res.json(meetingManager.listMeetings());
});

meetingsRouter.post('/', async (req, res) => {
  const { companyName, title, hostName, scheduledAt, logoUrl, waitingVideoUrl, tagline } = req.body ?? {};
  if (!companyName || !title) {
    res.status(400).json({ error: 'companyName and title are required' });
    return;
  }
  const scheduledAtMs = scheduledAt ? new Date(scheduledAt).getTime() : undefined;
  const meeting = await meetingManager.createMeeting(String(companyName), String(title), {
    scheduledAt: Number.isFinite(scheduledAtMs) ? scheduledAtMs : undefined,
    logoUrl: logoUrl ? String(logoUrl) : undefined,
    waitingVideoUrl: waitingVideoUrl ? String(waitingVideoUrl) : undefined,
    tagline: tagline ? String(tagline) : undefined,
  });
  const hostInvite = await inviteManager.create(meeting.id, String(hostName ?? 'Chairman'), 'HOST');
  res.status(201).json({
    id: meeting.id,
    companyName: meeting.companyName,
    title: meeting.title,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt,
    logoUrl: meeting.logoUrl,
    waitingVideoUrl: meeting.waitingVideoUrl,
    tagline: meeting.tagline,
    hostToken: hostInvite.token,
    hostJoinUrl: hostJoinUrl(hostInvite.token),
    participantJoinUrl: participantJoinUrl(meeting.participantJoinToken),
  });
});

meetingsRouter.get('/:id', (req, res) => {
  const meeting = meetingManager.getMeeting(req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }
  res.json({
    id: meeting.id,
    companyName: meeting.companyName,
    title: meeting.title,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt,
    logoUrl: meeting.logoUrl,
    waitingVideoUrl: meeting.waitingVideoUrl,
    tagline: meeting.tagline,
    participantJoinUrl: participantJoinUrl(meeting.participantJoinToken),
    participants: meeting.listParticipants(),
  });
});

meetingsRouter.delete('/:id', (req, res) => {
  meetingManager.endMeeting(req.params.id);
  res.status(204).send();
});
