import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMeeting, listMeetings } from '../lib/api';
import { MeetingSummary } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [waitingVideoUrl, setWaitingVideoUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  const [liveMeetings, setLiveMeetings] = useState<MeetingSummary[]>([]);

  useEffect(() => {
    listMeetings().then(setLiveMeetings).catch(() => setLiveMeetings([]));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(undefined);
    try {
      const meeting = await createMeeting(companyName, title, hostName || 'Chairman', {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        logoUrl: logoUrl || undefined,
        waitingVideoUrl: waitingVideoUrl || undefined,
        tagline: tagline || undefined,
      });
      navigate(`/meetings/${meeting.id}/admin`, { state: { meeting } });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="home">
      <header className="home-hero">
        <span className="home-badge">SEBI LODR Reg. 44 · VC/OAVM</span>
        <h1>Virtual AGM</h1>
        <p>
          Broadcast-quality live meetings for AGMs and board meetings. Host with full control,
          invite speakers with a single link.
        </p>
        <ul className="home-points">
          <li>Host mic &amp; camera control</li>
          <li>Spotlight &amp; screen share</li>
          <li>E-voting countdown</li>
        </ul>
      </header>

      <main className="home-main">
        <form className="home-form" onSubmit={handleCreate}>
          <div className="home-form-head">
            <h2>Set up a meeting</h2>
            <p>Fill in the essentials — you can share the speaker link right after.</p>
          </div>
          <div className="home-grid">
            <label className="span-2">
              Company name
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Industries Ltd."
                required
              />
            </label>
            <label className="span-2">
              Meeting title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 24th Annual General Meeting"
                required
              />
            </label>
            <label>
              Your name (Chairman/admin)
              <input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Chairman" />
            </label>
            <label>
              Scheduled start time
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
            <label>
              Company logo URL
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            </label>
            <label>
              Tagline / theme
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Leadership in Enterprise AI"
              />
            </label>
            <label className="span-2">
              Waiting-room video URL
              <input
                value={waitingVideoUrl}
                onChange={(e) => setWaitingVideoUrl(e.target.value)}
                placeholder="https://… (looping video shown 15 min before start)"
              />
            </label>
          </div>
          <p className="home-hint">Schedule, logo, tagline and waiting video are optional.</p>
          {createError && <p className="error">{createError}</p>}
          <button type="submit" className="home-cta" disabled={creating}>
            {creating ? 'Creating…' : 'Create meeting'}
          </button>
        </form>

        <section className="home-meetings">
          <h2>Existing meetings</h2>
          {liveMeetings.length === 0 && <p className="muted">No meetings yet.</p>}
          <ul>
            {liveMeetings.map((m) => (
              <li key={m.id}>
                <div>
                  <strong>{m.companyName}</strong>
                  <span className="muted">{m.title}</span>
                  <span className="home-status">
                    {m.status} · {m.participantCount} in room
                  </span>
                </div>
                <button className="home-ghost" onClick={() => navigate(`/meetings/${m.id}/admin`)}>
                  Manage
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
