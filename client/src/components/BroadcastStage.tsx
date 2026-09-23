import { useEffect, useRef } from 'react';
import { EVotingOverlay } from './EVotingOverlay';

export interface BroadcastTile {
  id: string;
  stream?: MediaStream;
  label: string;
  designation?: string;
  mutePlayback?: boolean;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

interface BroadcastStageProps {
  companyName?: string;
  title?: string;
  tagline?: string;
  logoUrl?: string;
  tiles: BroadcastTile[];
  spotlightParticipantIds?: string[];
  screenShare?: { participantId: string; stream: MediaStream };
  votingEndsAt?: number | null;
}

function AudioOnlyIndicator({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`audio-only audio-only-${size}`}>
      <svg viewBox="0 0 24 24" className="audio-only-mic" fill="currentColor">
        <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
        <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.08A7 7 0 0 0 19 11Z" />
      </svg>
      <div className="audio-only-bars">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function StageVideo({ stream, mutePlayback, label, audioMuted, videoMuted }: BroadcastTile) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className="stage-tile">
      {videoMuted && <AudioOnlyIndicator size="md" />}
      <video ref={videoRef} autoPlay playsInline muted={mutePlayback} />
      <div className="stage-tile-nameplate">
        {label}
        {audioMuted && ' 🔇'}
      </div>
    </div>
  );
}

function FilmstripVideo({ stream, mutePlayback, label, designation, audioMuted, videoMuted }: BroadcastTile) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className="filmstrip-tile">
      {videoMuted && <AudioOnlyIndicator size="sm" />}
      <video ref={videoRef} autoPlay playsInline muted={mutePlayback} />
      <div className="filmstrip-nameplate">
        <div className="filmstrip-name">
          {label}
          {audioMuted && ' 🔇'}
        </div>
        {designation && <div className="filmstrip-designation">{designation}</div>}
      </div>
    </div>
  );
}

function SpotlightVideo({ stream, mutePlayback, label, designation, audioMuted, videoMuted }: BroadcastTile) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className="spotlight-frame">
      {videoMuted && <AudioOnlyIndicator size="lg" />}
      <video ref={videoRef} autoPlay playsInline muted={mutePlayback} />
      <div className="spotlight-nameplate">
        <div className="spotlight-name">
          {label}
          {audioMuted && ' 🔇'}
        </div>
        {designation && <div className="spotlight-designation">{designation}</div>}
      </div>
    </div>
  );
}

function PresentationScreen({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="presentation-screen">
      <video ref={videoRef} autoPlay playsInline />
    </div>
  );
}

function PresentationPresenter({ stream, mutePlayback, label, audioMuted, videoMuted }: BroadcastTile) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className="presentation-presenter">
      {videoMuted && <AudioOnlyIndicator size="sm" />}
      <video ref={videoRef} autoPlay playsInline muted={mutePlayback} />
      <div className="presentation-presenter-nameplate">
        {label}
        {audioMuted && ' 🔇'}
      </div>
    </div>
  );
}

export function BroadcastStage({
  companyName,
  title,
  tagline,
  logoUrl,
  tiles,
  spotlightParticipantIds = [],
  screenShare,
  votingEndsAt,
}: BroadcastStageProps) {
  const spotlightTiles = spotlightParticipantIds
    .map((id) => tiles.find((t) => t.id === id))
    .filter((t): t is BroadcastTile => Boolean(t));
  const otherTiles = spotlightTiles.length > 0 ? tiles.filter((t) => !spotlightParticipantIds.includes(t.id)) : [];
  const presenterTile = screenShare ? tiles.find((t) => t.id === screenShare.participantId) : undefined;

  return (
    <div className="broadcast-stage">
      <div className="broadcast-header">
        <h1>{title}</h1>
        {tagline && <p>{tagline}</p>}
      </div>
      {votingEndsAt ? (
        <EVotingOverlay votingEndsAt={votingEndsAt} />
      ) : screenShare ? (
        <div className="presentation-stage">
          <PresentationScreen stream={screenShare.stream} />
          {presenterTile && <PresentationPresenter {...presenterTile} />}
        </div>
      ) : spotlightTiles.length === 1 ? (
        <>
          <div className="surround-stage">
            <div className="surround-side">
              {otherTiles.slice(0, 2).map((tile) => (
                <FilmstripVideo key={tile.id} {...tile} />
              ))}
            </div>
            <div className="spotlight-row spotlight-row-surround">
              <SpotlightVideo {...spotlightTiles[0]} />
            </div>
            <div className="surround-side">
              {otherTiles.slice(2, 4).map((tile) => (
                <FilmstripVideo key={tile.id} {...tile} />
              ))}
            </div>
          </div>
          {otherTiles.length > 4 && (
            <div className="filmstrip">
              {otherTiles.slice(4).map((tile) => (
                <FilmstripVideo key={tile.id} {...tile} />
              ))}
            </div>
          )}
        </>
      ) : spotlightTiles.length > 1 ? (
        <>
          <div className="spotlight-row">
            {spotlightTiles.map((tile) => (
              <SpotlightVideo key={tile.id} {...tile} />
            ))}
          </div>
          {otherTiles.length > 0 && (
            <div className="filmstrip">
              {otherTiles.map((tile) => (
                <FilmstripVideo key={tile.id} {...tile} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="broadcast-row">
          {tiles.map((tile) => (
            <StageVideo key={tile.id} {...tile} />
          ))}
        </div>
      )}
      <div className="broadcast-footer">
        {logoUrl && <img src={logoUrl} alt={companyName ?? 'Company logo'} />}
        <span>
          {companyName}
          {companyName && title ? ' — ' : ''}
          {title}
        </span>
        {logoUrl && <img src={logoUrl} alt={companyName ?? 'Company logo'} />}
      </div>
    </div>
  );
}
