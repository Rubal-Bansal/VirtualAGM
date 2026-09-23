import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { listMeetings } from '../lib/api';
import { useAuth } from '../lib/auth';
import { MeetingSummary } from '../types';

function formatWhen(ms?: number): string {
  if (!ms) return 'No start time set';
  return new Date(ms).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingSummary[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    listMeetings()
      .then(setMeetings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load events'));
  }, []);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Hello, {user?.name.split(' ')[0]}</h1>
          <p className="muted">Create and manage your AGM and board meeting events.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/events/new')}>
          + Create event
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {meetings && meetings.length === 0 && (
        <div className="empty">
          <div className="empty-icon">📅</div>
          <h3>No events yet</h3>
          <p className="muted">Create your first event to get a host link and a shareable speaker link.</p>
          <button className="btn btn-primary" onClick={() => navigate('/events/new')}>
            Create event
          </button>
        </div>
      )}

      <div className="event-grid">
        {meetings?.map((m) => (
          <article key={m.id} className="event-card">
            <div className="event-card-top">
              <span className={`badge badge-${m.status.toLowerCase()}`}>{m.status}</span>
              <span className="muted small">{m.participantCount} in room</span>
            </div>
            <h3>{m.companyName}</h3>
            <p className="event-title">{m.title}</p>
            <p className="muted small">{formatWhen(m.scheduledAt)}</p>
            <button className="btn btn-outline btn-block" onClick={() => navigate(`/meetings/${m.id}/admin`)}>
              Manage event
            </button>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
