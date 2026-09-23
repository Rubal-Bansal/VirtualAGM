import { useEffect, useState } from 'react';

const PRE_ROLL_MS = 15 * 60 * 1000;
const WELCOME_MS = 1 * 60 * 1000;

interface WaitingBannerProps {
  companyName?: string;
  title?: string;
  scheduledAt?: number;
  logoUrl?: string;
  waitingVideoUrl?: string;
}

function formatIST(timestamp: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(timestamp);
}

export function WaitingBanner({ companyName, title, scheduledAt, logoUrl, waitingVideoUrl }: WaitingBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(interval);
  }, []);

  const msUntilStart = scheduledAt !== undefined ? scheduledAt - now : undefined;
  const withinPreRoll = msUntilStart !== undefined && msUntilStart <= PRE_ROLL_MS;
  const withinWelcome = msUntilStart !== undefined && msUntilStart <= WELCOME_MS;
  const showVideo = withinPreRoll && Boolean(waitingVideoUrl);
  const startTimeText = scheduledAt ? `${title ?? 'Meeting'} will begin at ${formatIST(scheduledAt)} IST` : '';

  if (showVideo) {
    return (
      <div className="waiting-banner waiting-banner-video">
        <video src={waitingVideoUrl} autoPlay loop muted playsInline />
        {withinWelcome ? (
          <div className="waiting-banner-card waiting-welcome-card">
            <p className="waiting-welcome-eyebrow">Welcome to</p>
            <h1>{companyName}</h1>
            <h2>{title}</h2>
          </div>
        ) : (
          <div className="waiting-ticker">
            <div className="waiting-ticker-track">
              <span>{startTimeText}</span>
              <span>{startTimeText}</span>
              <span>{startTimeText}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="waiting-banner">
      {logoUrl && <img className="waiting-banner-logo" src={logoUrl} alt={companyName ?? 'Company logo'} />}
      <div className="waiting-banner-card">
        <h1>{companyName}</h1>
        <h2>{title}</h2>
        <div className="waiting-banner-rule" />
        <p>
          {scheduledAt
            ? `The event will begin at ${formatIST(scheduledAt)} IST`
            : 'The event has not started yet — please wait for the host to begin.'}
        </p>
      </div>
    </div>
  );
}
