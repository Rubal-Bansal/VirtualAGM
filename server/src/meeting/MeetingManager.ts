import { randomUUID } from 'crypto';
import { persist, pool } from '../db/db';
import { Meeting, MeetingBranding } from './Meeting';
import { MeetingSummary } from './types';

const ms = (d: Date | null): number | undefined => (d ? d.getTime() : undefined);

class MeetingManager {
  private meetings = new Map<string, Meeting>();
  private participantTokenIndex = new Map<string, string>();
  private owners = new Map<string, string | null>();

  async createMeeting(
    ownerId: string,
    companyName: string,
    title: string,
    branding: MeetingBranding = {},
  ): Promise<Meeting> {
    const id = randomUUID();
    const meeting = await Meeting.create(id, companyName, title, branding);
    await pool.query(
      `INSERT INTO meetings (id, company_name, title, status, participant_join_token, created_at,
                             scheduled_at, logo_url, waiting_video_url, tagline, owner_id)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), $7, $8, $9, $10, $11)`,
      [
        id,
        companyName,
        title,
        meeting.status,
        meeting.participantJoinToken,
        meeting.createdAt,
        branding.scheduledAt ? new Date(branding.scheduledAt) : null,
        branding.logoUrl ?? null,
        branding.waitingVideoUrl ?? null,
        branding.tagline ?? null,
        ownerId,
      ],
    );
    this.meetings.set(id, meeting);
    this.owners.set(id, ownerId);
    this.participantTokenIndex.set(meeting.participantJoinToken, id);
    return meeting;
  }

  /** Reloads unfinished meetings from Postgres on startup so links keep working across restarts. */
  async restoreFromDb(): Promise<number> {
    const { rows } = await pool.query("SELECT * FROM meetings WHERE status <> 'ENDED'");
    for (const r of rows) {
      const meeting = await Meeting.create(
        r.id,
        r.company_name,
        r.title,
        {
          scheduledAt: ms(r.scheduled_at),
          logoUrl: r.logo_url ?? undefined,
          waitingVideoUrl: r.waiting_video_url ?? undefined,
          tagline: r.tagline ?? undefined,
        },
        {
          participantJoinToken: r.participant_join_token,
          createdAt: r.created_at.getTime(),
          // Nobody is connected after a restart; the meeting is live again when the host rejoins.
          status: 'SCHEDULED',
        },
      );
      this.meetings.set(r.id, meeting);
      this.owners.set(r.id, r.owner_id ?? null);
      this.participantTokenIndex.set(meeting.participantJoinToken, r.id);
    }
    // Close attendance rows that were left open by the previous process.
    await pool.query('UPDATE attendance SET left_at = now() WHERE left_at IS NULL');
    return rows.length;
  }

  getMeeting(id: string): Meeting | undefined {
    return this.meetings.get(id);
  }

  /** Resolves a meeting's shared speaker-join token to its meeting id. */
  resolveParticipantToken(token: string): string | undefined {
    return this.participantTokenIndex.get(token);
  }

  getOwnerId(id: string): string | null | undefined {
    return this.owners.get(id);
  }

  listMeetings(ownerId: string): MeetingSummary[] {
    return Array.from(this.meetings.values())
      .filter((m) => this.owners.get(m.id) === ownerId)
      .map((m) => ({
        id: m.id,
        companyName: m.companyName,
        title: m.title,
        status: m.status,
        participantCount: m.listParticipants().length,
        createdAt: m.createdAt,
        scheduledAt: m.scheduledAt,
        logoUrl: m.logoUrl,
        waitingVideoUrl: m.waitingVideoUrl,
        tagline: m.tagline,
      }));
  }

  endMeeting(id: string): void {
    const meeting = this.meetings.get(id);
    if (!meeting) return;
    this.participantTokenIndex.delete(meeting.participantJoinToken);
    meeting.end();
    this.meetings.delete(id);
    this.owners.delete(id);
    persist('meeting end', pool.query("UPDATE meetings SET status = 'ENDED', ended_at = now() WHERE id = $1", [id]));
  }
}

export const meetingManager = new MeetingManager();
