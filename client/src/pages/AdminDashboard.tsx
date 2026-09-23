import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { getMeeting } from '../lib/api';
import { CreatedMeeting, ParticipantInfo } from '../types';

function hostTokenStorageKey(meetingId: string): string {
  return `agm:hostToken:${meetingId}`;
}

function saveHostToken(meetingId: string, token: string): void {
  try {
    localStorage.setItem(hostTokenStorageKey(meetingId), token);
  } catch {
    // localStorage may be unavailable (private browsing); non-fatal.
  }
}

function loadHostToken(meetingId: string): string | undefined {
  try {
    return localStorage.getItem(hostTokenStorageKey(meetingId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function AdminDashboard() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const passedMeeting = (location.state as { meeting?: CreatedMeeting } | undefined)?.meeting;

  const [companyName, setCompanyName] = useState(passedMeeting?.companyName ?? '');
  const [title, setTitle] = useState(passedMeeting?.title ?? '');
  const [hostToken, setHostToken] = useState<string | undefined>(passedMeeting?.hostToken);
  const [participantJoinUrl, setParticipantJoinUrl] = useState<string | undefined>(
    passedMeeting?.participantJoinUrl,
  );
  const [loadError, setLoadError] = useState<string>();
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (!meetingId) return;
    if (passedMeeting) {
      saveHostToken(meetingId, passedMeeting.hostToken);
    } else {
      const stored = loadHostToken(meetingId);
      if (stored) {
        setHostToken(stored);
      } else {
        setLoadError('No host link found for this meeting on this device. Use the link shown when the meeting was created.');
      }
    }
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  function refresh() {
    if (!meetingId) return;
    getMeeting(meetingId)
      .then((m) => {
        setCompanyName(m.companyName);
        setTitle(m.title);
        setStatus(m.status);
        setParticipantJoinUrl(m.participantJoinUrl);
        setParticipants(m.participants);
      })
      .catch(() => undefined);
  }

  async function copyLink() {
    if (!participantJoinUrl) return;
    try {
      await navigator.clipboard.writeText(participantJoinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable; the link is still visible to copy manually.
    }
  }

  if (!meetingId) return null;

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');

  return (
    <AppShell>
      <div className="admin-wrap">
        <button type="button" className="link-back" onClick={() => navigate('/')}>
          ← Back to events
        </button>

        <header className="admin-head">
          <div>
            <span className={`admin-status admin-status-${(status ?? 'SCHEDULED').toLowerCase()}`}>
              {status ?? 'SCHEDULED'}
            </span>
            <h1>{companyName || 'Meeting'}</h1>
            <p>{title}</p>
          </div>
          {hostToken ? (
            <button className="btn btn-primary" onClick={() => navigate(`/room/${hostToken}`)}>
              Enter meeting as host
            </button>
          ) : (
            <p className="form-error">{loadError}</p>
          )}
        </header>

        <div className="admin-grid">
          <section className="admin-card">
            <h2>Speaker join link</h2>
            <p className="admin-muted">
              Share this one link with every shareholder joining as a speaker. Anyone with the link enters their
              name (and optional designation) when they join — no pre-registration needed.
            </p>
            {participantJoinUrl && (
              <div className="admin-link">
                <input value={participantJoinUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
                <button type="button" onClick={copyLink}>
                  {copied ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
            )}
          </section>

          <section className="admin-card">
            <div className="admin-card-head">
              <h2>In the meeting</h2>
              <span className="admin-count">{participants.length}</span>
            </div>
            {participants.length === 0 ? (
              <p className="admin-muted">Nobody has joined yet.</p>
            ) : (
              <ul className="admin-people">
                {participants.map((p) => (
                  <li key={p.id}>
                    <span className="admin-avatar">{initials(p.name)}</span>
                    <div>
                      <strong>{p.name}</strong>
                      {p.designation && <span>{p.designation}</span>}
                    </div>
                    <span className={`admin-role admin-role-${p.role.toLowerCase()}`}>{p.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
