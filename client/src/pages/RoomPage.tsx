import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAgmRoom } from '../hooks/useAgmRoom';
import { BroadcastStage, BroadcastTile } from '../components/BroadcastStage';
import { WaitingBanner } from '../components/WaitingBanner';
import { MeetingEndedScreen } from '../components/MeetingEndedScreen';

interface RoomPageProps {
  token?: string;
  presetName?: string;
  presetDesignation?: string;
}

export function RoomPage({ token: tokenProp, presetName, presetDesignation }: RoomPageProps = {}) {
  const { token: tokenParam } = useParams<{ token: string }>();
  const token = tokenProp ?? tokenParam;
  const room = useAgmRoom(token!, { name: presetName, designation: presetDesignation });
  const [votingMinutes, setVotingMinutes] = useState(15);

  if (room.status === 'connecting') return <div className="page">Connecting…</div>;
  if (room.status === 'error') return <div className="page error">Failed to join: {room.error}</div>;
  if (room.status === 'ended') {
    return <MeetingEndedScreen companyName={room.companyName} title={room.title} logoUrl={room.logoUrl} />;
  }

  const self = room.participants.find((p) => p.id === room.selfId);
  const isHost = room.selfRole === 'HOST';

  if (!isHost && room.meetingStatus === 'SCHEDULED') {
    return (
      <WaitingBanner
        companyName={room.companyName}
        title={room.title}
        scheduledAt={room.scheduledAt}
        logoUrl={room.logoUrl}
        waitingVideoUrl={room.waitingVideoUrl}
      />
    );
  }

  const [screenShareParticipantId, screenShareStream] = [...room.screenShares.entries()][0] ?? [];
  const screenShare = screenShareParticipantId && screenShareStream
    ? { participantId: screenShareParticipantId, stream: screenShareStream }
    : undefined;

  const tiles: BroadcastTile[] = [
    {
      id: room.selfId ?? 'self',
      stream: room.localStream,
      mutePlayback: true,
      label: self?.name ?? 'You',
      designation: self?.designation,
      audioMuted: self?.muted.audio,
      videoMuted: self?.muted.video,
    },
    ...[...room.remoteStreams.entries()].map(([participantId, stream]) => {
      const p = room.participants.find((x) => x.id === participantId);
      return {
        id: participantId,
        stream,
        label: p?.name ?? 'Participant',
        designation: p?.designation,
        audioMuted: p?.muted.audio,
        videoMuted: p?.muted.video,
      };
    }),
  ];

  return (
    <div className="room">
      <BroadcastStage
        companyName={room.companyName}
        title={room.title}
        tagline={room.tagline}
        logoUrl={room.logoUrl}
        tiles={tiles}
        spotlightParticipantIds={room.spotlightParticipantIds}
        screenShare={screenShare}
        votingEndsAt={room.votingEndsAt}
      />

      <div className="page">
        <div className="controls">
          {!isHost && (
            <>
              {self?.handRaised ? (
                <button onClick={room.lowerHand}>Lower hand</button>
              ) : (
                <button onClick={room.raiseHand}>✋ Raise hand</button>
              )}
            </>
          )}
          {isHost && room.spotlightParticipantIds.length > 0 && (
            <button onClick={() => room.setSpotlight([])}>Show full panel</button>
          )}
          {room.isSharingScreen ? (
            <button onClick={room.stopScreenShare}>Stop sharing screen</button>
          ) : (
            !screenShare && <button onClick={() => room.startScreenShare().catch(console.error)}>Share screen</button>
          )}
          {isHost &&
            (room.votingEndsAt ? (
              <button onClick={room.stopVoting}>Stop e-voting</button>
            ) : (
              <>
                <label>
                  E-voting duration (min)
                  <input
                    type="number"
                    min={1}
                    value={votingMinutes}
                    onChange={(e) => setVotingMinutes(Number(e.target.value))}
                    style={{ width: 60, marginLeft: 6 }}
                  />
                </label>
                <button onClick={() => room.startVoting(votingMinutes)}>Start e-voting</button>
              </>
            ))}
          {isHost && (
            <button
              onClick={() => {
                if (confirm('End the meeting for everyone?')) room.endMeeting();
              }}
            >
              End meeting
            </button>
          )}
        </div>

        <section className="participants">
          <h2>Attendees ({room.participants.length})</h2>
          <ul>
            {room.participants.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name}
                  {p.designation ? ` (${p.designation})` : ''} — {p.role}
                  {p.handRaised && ' ✋'}
                  {p.muted.audio && ' 🔇'}
                  {p.muted.video && ' 📷🚫'}
                  {room.spotlightParticipantIds.includes(p.id) && ' 🔦'}
                </span>
                {isHost && (
                  <span className="host-controls">
                    {p.id !== room.selfId && (
                      <>
                        <button onClick={() => room.setMute(p.id, 'audio', !p.muted.audio)}>
                          {p.muted.audio ? 'Unmute mic' : 'Mute mic'}
                        </button>
                        <button onClick={() => room.setMute(p.id, 'video', !p.muted.video)}>
                          {p.muted.video ? 'Turn camera on' : 'Turn camera off'}
                        </button>
                      </>
                    )}
                    {room.spotlightParticipantIds.includes(p.id) ? (
                      <button onClick={() => room.setSpotlight(room.spotlightParticipantIds.filter((id) => id !== p.id))}>
                        Remove from spotlight
                      </button>
                    ) : (
                      <button onClick={() => room.setSpotlight([...room.spotlightParticipantIds, p.id])}>
                        Add to spotlight
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
