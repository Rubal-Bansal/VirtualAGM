import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

  return (
    <div className="page">
      <h1>{companyName || 'Meeting'} — Admin</h1>
      <p className="muted">{title}</p>

      {hostToken ? (
        <button onClick={() => navigate(`/room/${hostToken}`)}>Enter meeting as host</button>
      ) : (
        <p className="error">{loadError}</p>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Speaker join link</h2>
        <p className="muted">
          Share this one link with every shareholder joining as a speaker. Anyone with the link enters their name
          (and optional designation) when they join — no pre-registration needed.
        </p>
        {participantJoinUrl && (
          <div className="speaker-row">
            <input value={participantJoinUrl} readOnly />
            <button type="button" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}
      </section>

      <section className="participants" style={{ marginTop: 24 }}>
        <h2>Currently in meeting ({participants.length})</h2>
        <ul>
          {participants.map((p) => (
            <li key={p.id}>
              <span>
                {p.name}
                {p.designation ? ` (${p.designation})` : ''} — {p.role}
              </span>
            </li>
          ))}
          {participants.length === 0 && <p className="muted">Nobody has joined yet.</p>}
        </ul>
      </section>
    </div>
  );
}
