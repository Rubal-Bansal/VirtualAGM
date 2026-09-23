import { useEffect, useState } from 'react';

interface EVotingOverlayProps {
  votingEndsAt: number;
}

function formatRemaining(ms: number): { minutes: string; seconds: string } {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

export function EVotingOverlay({ votingEndsAt }: EVotingOverlayProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { minutes, seconds } = formatRemaining(votingEndsAt - now);

  return (
    <div className="evoting-stage">
      <div className="evoting-card">
        <div className="evoting-timer">
          {minutes}:{seconds}
        </div>
        <div className="evoting-timer-labels">
          <span>MINUTES</span>
          <span>SECONDS</span>
        </div>
        <div className="evoting-rule" />
        <div className="evoting-status">E-Voting in Progress</div>
      </div>
    </div>
  );
}
