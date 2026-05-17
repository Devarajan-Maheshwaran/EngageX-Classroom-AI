# EngageX — AI Teaching Co-Pilot 🎓

> A real-time multi-agent classroom intelligence system that watches every student's engagement signal, detects confusion and disengagement, and gives teachers a live co-pilot dashboard.

## Features
- 🟢 **Silent confusion detection** — flags students inactive for 15+ minutes
- 💬 **Real-time sentiment analysis** — local DistilBERT model, no API key needed
- ⚖️ **Participation balancer** — tracks contribution ratio, alerts on imbalance
- 🧠 **Mentor agent** — generates actionable teaching suggestions per alert
- 📄 **Post-session PDF report** _(Phase 5)_
- 📹 **WebRTC attention detection** via face-api.js _(Phase 5)_

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Node.js + Express + Socket.IO |
| AI (local) | Transformers.js — DistilBERT SST-2, BART-large-MNLI |
| Agent orchestration | LangGraph-style JS state machine |
| Frontend | React + Vite + Tailwind CSS + Recharts |
| Deploy | Vercel (frontend) + Railway (backend) |

## Project Structure
```
backend/
  agents/         # monitorAgent, balancerAgent, mentorAgent, orchestrator
  services/       # eventBus, participationService, sentimentService, analyticsService
  server.js       # Express + Socket.IO entry
frontend/         # React + Vite app (Phase 4)
```

## Quick Start
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:4000
```

## Build Phases
| Phase | Goal | Status |
|---|---|---|
| 1 | Scaffold wire-up: eventBus → participation → sentiment → server → monitorAgent | ✅ Done |
| 2 | AI sentiment layer + live graph on teacher dashboard | 🔄 Next |
| 3 | Full agent pipeline: LangGraph state machine + balancer + mentor LLM | ⏳ |
| 4 | Teacher dashboard UI: student grid, alert feed, sentiment chart | ⏳ |
| 5 | PDF report + WebRTC face detection + deploy | ⏳ |
