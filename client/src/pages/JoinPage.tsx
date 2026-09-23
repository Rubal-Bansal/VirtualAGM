import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RoomPage } from './RoomPage';

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!token) return null;

  if (submitted) {
    return <RoomPage token={token} presetName={name} presetDesignation={designation || undefined} />;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitted(true);
  }

  return (
    <div className="app app-center">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="brand">
          <span className="brand-mark">A</span>
          Virtual AGM
        </span>
        <h2>Join meeting</h2>
        <p className="muted">Enter your name to join as a speaker.</p>
        <label className="field">
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required autoFocus />
        </label>
        <label className="field">
          <span>Designation <span className="optional">(optional)</span></span>
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Independent Director"
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block">
          Join meeting
        </button>
      </form>
    </div>
  );
}
