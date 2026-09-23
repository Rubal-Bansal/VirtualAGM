import { randomBytes } from 'crypto';
import { persist, pool } from '../db/db';
import { ParticipantRole } from '../meeting/types';
import { InviteInfo } from './types';

class InviteManager {
  private invites = new Map<string, InviteInfo>();

  async create(meetingId: string, name: string, role: ParticipantRole): Promise<InviteInfo> {
    const token = randomBytes(24).toString('hex');
    const invite: InviteInfo = {
      token,
      meetingId,
      role,
      name,
      used: false,
      createdAt: Date.now(),
    };
    await pool.query('INSERT INTO invites (token, meeting_id, role, name, created_at) VALUES ($1, $2, $3, $4, $5)', [
      token,
      meetingId,
      role,
      name,
      new Date(invite.createdAt),
    ]);
    this.invites.set(token, invite);
    return invite;
  }

  /** Reloads invites for unfinished meetings on startup. */
  async restoreFromDb(): Promise<void> {
    const { rows } = await pool.query(
      `SELECT i.* FROM invites i JOIN meetings m ON m.id = i.meeting_id WHERE m.status <> 'ENDED'`,
    );
    for (const r of rows) {
      this.invites.set(r.token, {
        token: r.token,
        meetingId: r.meeting_id,
        role: r.role,
        name: r.name,
        used: r.used,
        createdAt: r.created_at.getTime(),
      });
    }
  }

  get(token: string): InviteInfo | undefined {
    return this.invites.get(token);
  }

  markUsed(token: string): void {
    const invite = this.invites.get(token);
    if (!invite) return;
    invite.used = true;
    persist('invite used', pool.query('UPDATE invites SET used = true WHERE token = $1', [token]));
  }
}

export const inviteManager = new InviteManager();
