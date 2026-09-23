import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { createMeeting } from '../lib/api';
import { useAuth } from '../lib/auth';

const STEPS = ['Details', 'Branding', 'Review'] as const;

export function CreateEventPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState(user?.name ?? '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tagline, setTagline] = useState('');
  const [waitingVideoUrl, setWaitingVideoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();

  const isLast = step === STEPS.length - 1;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    setCreating(true);
    setError(undefined);
    try {
      const meeting = await createMeeting(companyName, title, hostName || 'Chairman', {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        logoUrl: logoUrl || undefined,
        waitingVideoUrl: waitingVideoUrl || undefined,
        tagline: tagline || undefined,
      });
      navigate(`/meetings/${meeting.id}/admin`, { state: { meeting } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
      setCreating(false);
    }
  }

  const review: [string, string][] = [
    ['Company', companyName],
    ['Meeting title', title],
    ['Host / chairman', hostName || 'Chairman'],
    ['Start time', scheduledAt ? new Date(scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not set'],
    ['Logo', logoUrl || 'None'],
    ['Tagline', tagline || 'None'],
    ['Waiting-room video', waitingVideoUrl || 'None'],
  ];

  return (
    <AppShell>
      <button type="button" className="link-back" onClick={() => navigate('/')}>
        ← Back to events
      </button>
      <div className="wizard">
        <h1>Create event</h1>
        <p className="muted">Set up the meeting in three quick steps.</p>

        <ol className="stepper">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? 'active' : i < step ? 'done' : ''}>
              <span className="step-dot">{i < step ? '✓' : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <form className="wizard-card" onSubmit={handleSubmit}>
          {step === 0 && (
            <>
              <label className="field">
                Company name
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Industries Ltd." required autoFocus />
              </label>
              <label className="field">
                Meeting title
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 24th Annual General Meeting" required />
              </label>
              <div className="field-row">
                <label className="field">
                  Host / chairman name
                  <input value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Chairman" />
                </label>
                <label className="field">
                  <span>Scheduled start time <span className="optional">(optional)</span></span>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </label>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="muted">All optional — shown on the waiting screen and live broadcast header.</p>
              <label className="field">
                Company logo URL
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
              </label>
              <label className="field">
                Tagline / theme
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Leadership in Enterprise AI" />
              </label>
              <label className="field">
                Waiting-room video URL
                <input value={waitingVideoUrl} onChange={(e) => setWaitingVideoUrl(e.target.value)} placeholder="https://… (looping video shown 15 min before start)" />
              </label>
            </>
          )}

          {step === 2 && (
            <dl className="review">
              {review.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="wizard-actions">
            {step > 0 ? (
              <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)} disabled={creating}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {isLast ? (creating ? 'Creating…' : 'Create event') : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
