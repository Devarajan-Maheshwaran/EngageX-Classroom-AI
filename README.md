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

## Deploy (Local Backends + Vercel Frontend)

This project uses a hybrid deployment model:
- **Frontend**: Deployed to Vercel for public access.
- **Backend**: Runs locally via Docker and is exposed securely to the internet using **Ngrok** and **Localtunnel** (to bypass Ngrok's single-tunnel free limit).

### 1. Run Backend Locally (Docker)
Ensure Docker is running, then start the Node.js and Python backends:
```bash
docker-compose up -d backend-node backend-python
```

### 2. Expose Backends to the Internet
We provide scripts to automatically spin up tunnels for both backends.
- **On Windows:**
  Open PowerShell as Administrator and run:
  ```powershell
  ./scripts/start-tunnels.ps1
  ```
- **On Mac/Linux:**
  ```bash
  chmod +x scripts/dev-tunnel.sh
  ./scripts/dev-tunnel.sh
  ```
The script will output two public URLs (one Ngrok, one Localtunnel). Keep this script running.

### 3. Deploy Frontend to Vercel
1. Push this repository to GitHub and import it into Vercel.
2. Set the **Framework Preset** to `Vite` and **Root Directory** to `frontend`.
3. Add the following Environment Variables in the Vercel dashboard using the URLs generated in step 2:
   - `VITE_BACKEND_URL`: Your Ngrok URL (e.g., `https://abc-123.ngrok-free.app`)
   - `VITE_PYTHON_BACKEND_URL`: Your Localtunnel URL (e.g., `https://fuzzy-ants-jump.loca.lt`)
4. Deploy! 

> **Important:** Your Vercel frontend will only work while your local Docker containers and tunnels are running. Localtunnel may show a "Click to Continue" reminder page the first time you visit; if your Python AI features fail, open the Localtunnel URL in your browser once and accept it.

---

## Build Phases

| Phase | Goal | Status |
|---|---|---|
| 1 | Scaffold: eventBus → participation → sentiment → server → agents | ✅ Done |
| 2 | Backend hardening + Frontend rebuild (Meet/Zoom co-pilot UI) | ✅ Done |
| 3 | Zero-shot intent classifier + confusion spike + full LangGraph loop | ✅ Done |
| 4 | Post-session summary drawer + jsPDF report + demo seed mode | 🔄 Next |
| 5 | Deploy: Railway + Vercel + optional Supabase persistence | ⏳ |
