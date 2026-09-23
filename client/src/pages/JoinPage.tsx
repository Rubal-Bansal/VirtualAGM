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
    <div className="page">
      <h1>Join meeting</h1>
      <form className="card" onSubmit={handleSubmit}>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label>
          Designation (optional)
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. Independent Director"
          />
        </label>
        <button type="submit">Join meeting</button>
      </form>
    </div>
  );
}
