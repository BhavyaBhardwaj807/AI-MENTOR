# AgoraMeet

A real-time video meeting app built with Next.js, Agora RTC, and Agora Conversational AI Agent — featuring an AI Mentor powered by LiveAvatar.

## Features

- Real-time video and audio meetings via Agora RTC
- Create or join rooms with a shareable room ID
- AI Mentor powered by Agora Conversational AI Agent v2
  - Voice conversation with LLM + TTS pipeline
  - LiveAvatar video rendering (UID 999998)
- Microphone and camera toggle controls
- Participant grid with live status indicators

## Tech Stack

- [Next.js 16](https://nextjs.org/) — App Router, Server Components
- [Agora RTC SDK NG](https://docs.agora.io/en/video-calling/overview/product-overview) — real-time audio/video
- [Agora Conversational AI Agent v2](https://docs.agora.io/en/conversational-ai/overview/product-overview) — AI voice agent
- [Agora LiveAvatar](https://docs.agora.io/en/conversational-ai/develop/liveavatar) — animated avatar video
- TypeScript, Tailwind CSS

## Prerequisites

- Node.js 18+
- An [Agora account](https://console.agora.io/) with:
  - An App ID and App Certificate
  - REST API key and secret
  - A Conversational AI pipeline configured with LLM + TTS + ASR
  - LiveAvatar enabled on your project (contact Agora support if not available)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Agora project credentials
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate

# Agora REST API credentials (from Console → RESTful API)
AGORA_REST_KEY=your_rest_key
AGORA_REST_SECRET=your_rest_secret

# Conversational AI pipeline ID (from Agora Console → Conversational AI)
AGORA_AGENT_PIPELINE_ID=your_pipeline_id

# Fixed UID for the AI voice agent
AGORA_AI_AGENT_UID=999999

# LiveAvatar configuration
LIVEAVATAR_API_KEY=your_liveavatar_api_key
AGORA_AVATAR_UID=999998
AGORA_AVATAR_ID=your_avatar_id
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click **Create Meeting** to generate a new room and join it
2. Share the Room ID from the header with others so they can join
3. Click **Start AI Mentor** in the meeting controls to launch the AI agent
4. Speak naturally — the agent listens, responds with voice, and renders as a LiveAvatar video in the bottom-right corner

## Project Structure

```
app/
  page.tsx                        # Home page — create or join a meeting
  meeting/[roomId]/page.tsx       # Meeting room page (Server Component)
  api/
    agora/
      token/route.ts              # Generates Agora RTC tokens
      agent/
        start/route.ts            # Starts the Conversational AI agent
        stop/route.ts             # Stops the agent

components/
  MeetingRoom.tsx                 # Main meeting UI and Agora RTC logic
  MeetingRoomClient.tsx           # Client wrapper (ssr: false) for MeetingRoom
  ParticipantTile.tsx             # Individual participant video tile
  MeetingControls.tsx             # Mic, camera, leave, and AI mentor controls

lib/
  agora.ts                        # RTC token builder helper
  agora-conversational-ai.ts      # Agora Conversational AI REST API calls
  agent-store.ts                  # In-memory store for active agent IDs
```

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/agora/token` | POST | Returns an RTC token for a given channel |
| `/api/agora/agent/start` | POST | Starts the AI agent in a channel |
| `/api/agora/agent/stop` | POST | Stops the AI agent in a channel |

## Key Implementation Notes

- `agora-rtc-sdk-ng` cannot be statically imported in SSR context. `MeetingRoomClient.tsx` wraps `MeetingRoom.tsx` with `next/dynamic` and `ssr: false`.
- The AI agent uses Basic Auth (`REST_KEY:REST_SECRET`) for Agora's REST API — not an RTC token.
- `agent_rtc_uid` must be a string in the v2 API payload.
- `remote_rtc_uids: ["0"]` subscribes the agent to all participants.
- The in-memory `agentStore` is wiped on dev server restart. `stopAllAgentsInChannel` is called before each new agent start to clean up stale RUNNING agents.
- LiveAvatar renders into a dedicated `ref`-attached container (not `getElementById`) to avoid race conditions between the Agora `user-published` event and React's render cycle.

## Diagnostics

When the AI Mentor is active, the browser console emits:

```
[Agora:publish] UID: 999998 mediaType: video   ← LiveAvatar is sending video
[Agora:subscribe] UID: 999998 mediaType: video — SUCCESS
[Agora:VIDEO] UID: 999998 videoTrack exists: true
[Agora:VIDEO] #avatar-video ref exists: true
[Agora:VIDEO] Playing video for UID: 999998 into avatarVideoRef
```

If `[Agora:publish] UID: 999998` never appears, LiveAvatar is not publishing into the channel — this is a LiveAvatar provisioning or credentials issue, not a frontend issue.

## License

MIT
