import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({ connectionString: env.databaseUrl });

pool.on('error', (err) => console.error('Postgres pool error', err));

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id                     UUID PRIMARY KEY,
      company_name           TEXT NOT NULL,
      title                  TEXT NOT NULL,
      status                 TEXT NOT NULL DEFAULT 'SCHEDULED',
      participant_join_token TEXT NOT NULL UNIQUE,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      scheduled_at           TIMESTAMPTZ,
      logo_url               TEXT,
      waiting_video_url      TEXT,
      tagline                TEXT,
      ended_at               TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS invites (
      token       TEXT PRIMARY KEY,
      meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      role        TEXT NOT NULL,
      name        TEXT NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id             BIGSERIAL PRIMARY KEY,
      meeting_id     UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL,
      name           TEXT NOT NULL,
      designation    TEXT,
      role           TEXT NOT NULL,
      joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      left_at        TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS attendance_meeting_idx ON attendance(meeting_id);
  `);
}

/** Persistence is best-effort for live meetings: log the failure but never break a running call. */
export function persist(label: string, run: Promise<unknown>): void {
  run.catch((err) => console.error(`DB write failed (${label})`, err));
}
