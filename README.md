# EngageX — AI Meeting Co-Pilot 🎙️

> The AI engagement layer your Google Meet / Zoom / Teams calls are missing.
> Open EngageX alongside your existing call. Participants join with a code.
> EngageX watches engagement signals and surfaces live AI alerts — so no one gets left behind silently.

[![Deploy Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Backend](https://img.shields.io/badge/Backend-Railway-blueviolet?logo=railway)](https://railway.app)
[![AI](https://img.shields.io/badge/AI-Transformers.js-orange?logo=huggingface)](https://huggingface.co/docs/transformers.js)
[![No API Key](https://img.shields.io/badge/AI%20models-local%2C%20no%20API%20key-brightgreen)]()

---

## What it does

| Signal | How EngageX surfaces it |
|---|---|
| 🔇 Silent participants | Flags anyone inactive 3+ min (configurable) — gentle alert + AI suggestion |
| 💬 Live sentiment | DistilBERT SST-2 runs **locally** on every message — no API key |
| 🧠 Engagement intent | DeBERTa NLI zero-shot classifies: confused / frustrated / excited / engaged |
| ⚖️ Participation imbalance | Tracks contribution ratio, alerts when <35% of room has spoken |
| 🌊 Confusion spikes | 3+ confused signals in 5 min → CONFUSION_SPIKE alert fires automatically |
| 🤖 AI suggestions | Every alert gets a concrete host action (HF Mistral if key set, static fallback) |

---

## Architecture

```
                        ┌─────────────────────────────────────┐
                        │         LangGraph State Machine      │
                        │  IDLE→MONITOR→CLASSIFY→BALANCE→LOG  │
                        └───────────────┬─────────────────────┘
                                        │ coordinates
           ┌────────────────────────────┼───────────────────────┐
    monitorAgent          balancerAgent │              mentorAgent
  (silent 3+ min)      (<35% spoken)   │          (AI suggestions)
           └────────────────────────────┘
                        │ fires via eventBus
  ┌─────────────────────▼──────────────────────────┐
  │               Socket.IO Server                  │
  │  sentiment (DistilBERT) + intent (DeBERTa NLI)  │
  │  confusionTracker: spike detection (3 in 5 min) │
  └───────┬──────────────────────────────┬──────────┘
          │                              │
  ┌───────▼──────┐               ┌───────▼───────┐
  │ Host Dashboard│               │ Participant    │
  │  /host        │               │  /join         │
  └──────────────┘               └───────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18 + Express + Socket.IO 4 |
| Sentiment AI | `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (~67 MB, local) |
| Intent AI | `Xenova/nli-deberta-v3-small` (~85 MB, local, zero-shot) |
| LLM suggestions | HuggingFace Inference API (free, optional) — static fallback if no key |
| Agent orchestration | LangGraph-style explicit state machine in JS |
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Deploy | Vercel (frontend) + Railway (backend) |

> **No database needed for demo.** All session state is in-memory on Railway.
> Phase 4 adds optional Supabase persistence for post-session reports.

---

## Project Structure

```
backend/
  agents/
    agentOrchestrator.js   LangGraph state machine (MONITOR→CLASSIFY→BALANCE→INTERVENE→LOG)
    monitorAgent.js        Silent participant polling (configurable threshold)
    balancerAgent.js       Participation ratio checker
    mentorAgent.js         AI suggestion generator (HF + static fallback)
  services/
    eventBus.js            EventEmitter pub/sub backbone
    participationService.js  Per-participant tracking & scoring
    sentimentService.js    DistilBERT SST-2 sentiment (local)
    classifierService.js   DeBERTa NLI zero-shot intent (local)
    confusionTracker.js    Rolling confusion spike detector
    analyticsService.js    In-memory session analytics
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
# Backend
cd backend
npm install
cp .env.example .env
npm run dev          # → http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local   # set VITE_BACKEND_URL=http://localhost:4000
npm run dev          # → http://localhost:5173
```

Flow to test:
1. Open `http://localhost:5173` → click **Start a new session**
2. Copy the 6-char session code
3. In a second tab open `/join` → enter code + name
4. Send a message like `"I'm confused about this"` from the participant tab
5. Watch the host dashboard: intent badge updates, sentiment chart plots, and after 3 confused messages a CONFUSION_SPIKE alert fires

---

## Deploy

### Backend → Railway
1. New project → connect repo → Root Directory: `backend`
2. Env vars:
   - `PORT=4000` (set automatically by Railway)
   - `SILENT_THRESHOLD_MINS=3` (demo) or `15` (classroom)
   - `HF_API_KEY=hf_xxx` (optional — free at huggingface.co/settings/tokens)
3. Health check: `/health`

### Frontend → Vercel
1. Import repo → Root Directory: `frontend`
2. Env var: `VITE_BACKEND_URL=https://<your-app>.up.railway.app`
3. `vercel.json` already handles SPA routing

> **No database required.** Session state lives in Railway process memory.
> If Railway restarts mid-session, the session resets — acceptable for demo use.

---

## Build Phases

| Phase | Goal | Status |
|---|---|---|
| 1 | Scaffold: eventBus → participation → sentiment → server → agents | ✅ Done |
| 2 | Backend hardening + Frontend rebuild (Meet/Zoom co-pilot UI) | ✅ Done |
| 3 | Zero-shot intent classifier + confusion spike + full LangGraph loop | ✅ Done |
| 4 | Post-session summary drawer + jsPDF report + demo seed mode | 🔄 Next |
| 5 | Deploy: Railway + Vercel + optional Supabase persistence | ⏳ |
