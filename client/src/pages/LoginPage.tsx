import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app auth">
      <aside className="auth-brand">
        <span className="brand">
          <span className="brand-mark brand-mark-light">A</span>
          Virtual AGM
        </span>
        <div>
          <h1>Run AGMs and board meetings, live.</h1>
          <p>
            Broadcast-quality video meetings built for SEBI LODR Regulation 44 — host controls, spotlight, screen
            share and e-voting countdown in one place.
          </p>
        </div>
        <small>VC / OAVM compliant meetings for listed companies</small>
      </aside>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">
            {mode === 'login' ? 'Sign in to manage your events.' : 'Sign up to start creating events.'}
          </p>

          <div className="segmented">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
              Sign in
            </button>
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
              Sign up
            </button>
          </div>

          {mode === 'register' && (
            <label className="field">
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required autoFocus />
            </label>
          )}
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus={mode === 'login'}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}
