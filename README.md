# Virtual AGM

A live video meeting platform for SEBI-mandated Annual General Meetings /
board meetings held via video conferencing / other audio-visual means
(VC/OAVM), as required under SEBI LODR Regulation 44 and related MCA
circulars.

## What's implemented (Phase 1: invite-based live meeting)

- **Self-hosted WebRTC SFU** using [mediasoup](https://mediasoup.org/) —
  no third-party video vendor. Every participant can be seen and heard;
  this is built for a closed meeting (e.g. ~10 board members), not a
  large public webcast (see "Scaling" below for that path).
- **Two link types, no folio/PAN**: the admin who sets up the meeting
  gets a private host link with full control. Every shareholder joining
  as a speaker uses one shared, unguessable link — they just type their
  name (and an optional designation) when they join. No pre-registered
  speaker list, no self-service sign-up form beyond that.
- **Admin has hard control** over every participant's mic and camera —
  instant mute/unmute and camera on/off, enforced server-side (the
  producer is paused on the media server, not just hidden in the UI).
- **Raise hand**: participants can signal they want to speak.
- **Attendance list**: live roster of who has joined, their mute state,
  and raised hands.
- The meeting stays alive even if the admin's connection drops (e.g.
  during a long session) — they rejoin with the same host link.
- **Pre-meeting waiting screen** for invited participants: a branded
  banner (company name, logo, meeting title, scheduled start time in
  IST) shown until the meeting starts. If a `waitingVideoUrl` is set, it
  switches to a looping muted video with a scrolling ticker (same pattern
  as listed companies' real AGM pre-rolls) starting 15 minutes before the
  scheduled time. It auto-switches to the live meeting the moment the
  admin joins — no page refresh needed.
- **Broadcast-style live layout**: once live, participants are shown
  edge-to-edge in a single row (like a panel on a dais) under a branded
  header (meeting title + optional tagline) and a footer bar with the
  company logo and meeting name — matching the look of a real listed
  company's AGM broadcast rather than a generic video-call grid.
- **Speaker designation + multi-spotlight**: each invited speaker can
  have a title (e.g. "Company Secretary") shown on their nameplate. The
  host can spotlight one or more participants at a time — e.g. just the
  Company Secretary while they open the meeting, or the Chairman plus
  whichever director is currently answering a question — shown larger
  on the main stage with name and designation, while everyone else
  stays visible as a smaller thumbnail filmstrip underneath (so nobody
  disappears from view, matching a real AGM's "active speaker + full
  roster" broadcast layout). Clearing the spotlight returns to the full
  equal-size panel view. When exactly one person is spotlighted (e.g.
  the Chairman), the others surround them in two flanking side columns
  (up to 2 each side) with any remainder along the bottom, matching a
  real AGM's "chairman centered, board flanking" broadcast shot; with
  two or more spotlighted, they're shown side by side instead.
- **Screen-share / presentation mode**: any participant can share their
  screen (e.g. a results PPT). While active, it takes over as the main
  stage — the shared screen large, with the presenter's camera as a
  small corner tile showing their name — the same layout a CEO walking
  through slides uses on a real AGM broadcast. The screen share is a
  separate WebRTC track from the presenter's camera (tagged `camera` vs
  `screen` server-side), so it can be stopped independently — via the
  in-app button or the browser's native "Stop sharing" control — without
  dropping their camera/mic.
- **Audio-only visual**: whenever a participant's camera is off (whether
  admin-muted or off by choice), every tile — panel, spotlight, filmstrip,
  presentation corner — shows an animated mic/waveform indicator instead
  of a blank box, so it's clear they're still there and speaking.
- **E-voting countdown overlay**: the host can start a timed e-voting
  window (with a duration in minutes); while active, everyone sees a
  branded countdown ("E-Voting in Progress", MM:SS) taking over the main
  stage, matching a real AGM's voting screen. This is the timer/status
  display only — actual vote casting, tallying, and a scrutinizer
  dashboard still need a real e-voting agency integration (NSDL/CDSL),
  which remains a separate future module (see below).
- **Meeting conclusion**: when the e-voting countdown reaches zero, the
  host's client automatically ends the meeting; the host can also end it
  manually at any time. Everyone's view switches to a branded "The
  Meeting has now concluded — Thank you for your participation" screen,
  matching a real AGM's closing slide.

## Architecture

```
client/   React + TypeScript (Vite), mediasoup-client, socket.io-client
server/   Node.js + TypeScript, Express (REST), socket.io (signaling),
          mediasoup (media server / SFU)
```

- REST (`/api/meetings`):
  - `POST /api/meetings` — create a meeting; returns a private `hostToken`
    (host link) and the meeting's one `participantJoinUrl` (shared
    speaker link).
  - `GET /api/meetings/:id` — meeting details, including the shared
    speaker link and the live attendee list (used by the admin dashboard
    to poll who's currently in the meeting).
- Socket.io handles WebRTC signaling: `join`, `createTransport`,
  `connectTransport`, `produce`, `consume`, `hostSetMute`, `raiseHand`,
  `lowerHand`. The server also pushes a `meetingStarted` event to
  everyone waiting the moment the admin joins.
- Each meeting gets its own mediasoup `Router`; workers are pooled and
  assigned round-robin so meetings spread across CPU cores.
- `server/src/meeting/Meeting.ts` owns all mediasoup state (transports,
  producers, consumers) per participant so signaling code stays thin.
- Identity on `join` comes from the token, never client input:
  `server/src/invite/InviteManager.ts` resolves the host's named,
  single-use invite; anything else is checked against the meeting's
  `participantJoinToken` (`MeetingManager.resolveParticipantToken`) — a
  reusable token shared by every shareholder, who supply their own name
  (and optional designation) in the `join` payload at that point.

### Scaling beyond a small board meeting

The current SFU delivers WebRTC directly to every participant, which is
ideal for low-latency two-way interaction at meeting-room scale (tens of
people) but doesn't scale to a large public shareholder audience on its
own. If a future module needs to also webcast to hundreds/thousands of
view-only shareholders, the recommended path — not built — is to keep
WebRTC for the board/speakers and fan out a mixed feed via HLS/CDN
(mediasoup's `PlainTransport` + ffmpeg). The Meeting/producer model here
is designed so that addition is additive, not a rewrite.

## Pluggable interfaces (for future SEBI-mandated modules)

Planned next modules (not built yet), each intended as its own pluggable
service so they can be added without touching the meeting core:

- **Remote + live e-voting** with a scrutinizer dashboard.
- **Structured Q&A queue** (as opposed to today's simple raise-hand).
- **Recording & statutory retention** of the proceedings.
- **Public shareholder webcast** (view-only, at scale) alongside the
  closed board/speaker meeting, per the scaling note above.

## Running locally

```bash
# Server
cd server
cp .env.example .env
npm install
npm run dev        # http://localhost:4000

# Client (separate terminal)
cd client
cp .env.example .env
npm install
npm run dev         # http://localhost:5173
```

Open http://localhost:5173 → **Create meeting**. You'll land on the admin
dashboard for that meeting:
- Click **Enter meeting as host** to join as the admin, in this or another
  tab/browser.
- Copy the **speaker join link** shown on the dashboard and open it in as
  many other tabs/browsers as you like — each one types a name (and
  optional designation) and joins as a speaker. It's the same link for
  everyone; there's nothing to pre-register.

As host, you can mute/unmute or turn off any participant's camera from
the attendee list — this takes effect immediately and is enforced on the
server, not just hidden client-side.

`MEDIASOUP_ANNOUNCED_IP` in `server/.env` must be an IP participants'
browsers can reach — `127.0.0.1` only works when everyone is on the same
machine. For a LAN or cloud deployment, set it to the server's real
reachable IP.
