# EngageX — AI Meeting Co-Pilot 🎙️

> The AI engagement layer your Google Meet / Zoom / Teams calls are missing.
> Open EngageX alongside your existing call. Participants join with a code.
> EngageX surfaces live engagement intelligence — so no one gets left behind silently.

[![Deploy Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Backend](https://img.shields.io/badge/Backend-Railway-blueviolet?logo=railway)](https://railway.app)
[![AI](https://img.shields.io/badge/AI-Transformers.js-orange?logo=huggingface)](https://huggingface.co/docs/transformers.js)

---

## What it does

| Signal | How EngageX surfaces it |
|---|---|
| 🔇 Silent participants | Flags anyone inactive 3+ min (configurable) — gentle alert to the host |
| 💬 Live sentiment | DistilBERT SST-2 runs **locally** on every message — no API key |
| ⚖️ Participation imbalance | Tracks contribution ratio, alerts when <35% of room has spoken |
| 🤖 AI suggestions | Every alert gets a concrete action the host can take in 30 seconds |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18 + Express + Socket.IO 4 |
| AI (local) | `@xenova/transformers` — DistilBERT SST-2 (67 MB, no API key) |
| Agent orchestration | LangGraph-style JS state machine |
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Deploy | Vercel (frontend) + Railway (backend) |

---

## Project Structure

```
backend/
  agents/      monitorAgent · balancerAgent · mentorAgent · agentOrchestrator
  services/    eventBus · participationService · sentimentService · analyticsService
  server.js
frontend/
  src/
    pages/     Home · HostDashboard · ParticipantJoin
    components/ ParticipantGrid · SentimentTimeline · AlertFeed · SessionHeader
    hooks/     useMeetingSocket
```

---

## Quick Start (local)

```bash
# 1. Backend
cd backend
npm install
npm run dev          # → http://localhost:4000

# 2. Frontend
cd frontend
npm install
cp .env.example .env.local   # set VITE_BACKEND_URL=http://localhost:4000
npm run dev          # → http://localhost:5173
```

Then:
- Open `http://localhost:5173` — click **Start a new session**
- In a second tab, go to `/join` — enter the 6-char code + your name
- Send a message from the participant tab and watch sentiment + participation update live on the host dashboard

---

## Deploy

### Frontend → Vercel
1. Import this repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add env var: `VITE_BACKEND_URL=https://<your-railway-app>.up.railway.app`
4. Deploy

### Backend → Railway
1. Create a new project on [railway.app](https://railway.app)
2. Connect this repo, set **Root Directory** to `backend`
3. Add env var: `PORT=4000` (Railway sets this automatically)
4. Optional: `SILENT_THRESHOLD_MINS=3` (demo) or `15` (classroom)
5. Deploy — Railway auto-detects `package.json` and runs `npm start`

---

## Build Phases

| Phase | Goal | Status |
|---|---|---|
| 1 | Scaffold: eventBus → participation → sentiment → server → agents | ✅ Done |
| 2 | Backend hardening + Frontend rebuild (Meet/Zoom co-pilot UI) | ✅ Done |
| 3 | Zero-shot confusion classifier + full LangGraph agent loop | 🔄 Next |
| 4 | Supabase persistence + post-session JSON/PDF summary | ⏳ |
| 5 | WebRTC face-api.js attention detection + demo mode | ⏳ |
