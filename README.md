# EngageX Classroom AI

> Real-time AI engagement layer for live teaching sessions.
> Students join with a code. EngageX monitors attention signals and surfaces
> live alerts so no one falls behind silently.

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Backend](https://img.shields.io/badge/Backend-Railway-blueviolet?logo=railway)](https://railway.app)
[![AI](https://img.shields.io/badge/AI-Groq-orange)](https://groq.com)

---

## What it does

| Signal | How EngageX surfaces it |
|---|---|
| Silent participants | Flags anyone inactive 3+ min — alert + AI suggestion |
| Live sentiment | DistilBERT SST-2 runs locally on every message |
| Engagement intent | DeBERTa NLI zero-shot: confused / frustrated / excited / engaged |
| Participation imbalance | Tracks contribution ratio, alerts when < 35% of room has spoken |
| Confusion spikes | 3+ confused signals in 5 min fires CONFUSION_SPIKE automatically |
| AI quiz generation | Groq LLM generates MCQs from a topic, manual input, or uploaded PDF |
| Vision signals | FER lightweight face emotion detection — no CUDA required |
| Audio transcription | Groq Whisper large-v3 API — no local model download |

---

## Architecture

```
                    +-------------------------------------+
                    |       LangGraph State Machine        |
                    |  IDLE > MONITOR > CLASSIFY > LOG    |
                    +----------------+--------------------+
                                     | coordinates
       +-----------------------------+-----------------------------+
 monitorAgent              balancerAgent                  mentorAgent
 (silent 3+ min)         (< 35% spoken)              (AI suggestions)
       +-----------------------------+
                    | fires via eventBus
  +-----------------+------------------------------------------+
  |                 Socket.IO Server (Node.js)                   |
  |  sentiment (DistilBERT) + intent (DeBERTa NLI)               |
  |  confusionTracker: spike detection (3 in 5 min)              |
  +---------+------------------------------------+---------------+
            |                                    |
  +---------+----------+             +-----------+-----------+
  | Teacher Dashboard  |             | Student Join (/join)  |
  | /host              |             +-----------------------+
  +--------------------+

  Python FastAPI backend (port 4001)
    /api/signals/vision  -- FER face emotion
    /api/signals/audio   -- Groq Whisper transcription + vocal energy
    /api/quiz/generate   -- Groq LLM topic-based MCQ
    /api/quiz/from-pdf   -- pdfplumber extract + Groq LLM MCQ
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Node backend | Node.js 20, Express, Socket.IO 4 |
| Python backend | FastAPI, Uvicorn, python-socketio |
| Sentiment | Xenova/distilbert-base-uncased-finetuned-sst-2-english (local) |
| Intent | Xenova/nli-deberta-v3-small (local, zero-shot) |
| Transcription | Groq Whisper large-v3 API |
| LLM | Groq (llama-3 / mixtral) |
| Vision | FER + OpenCV headless (no CUDA) |
| PDF extraction | pdfplumber |
| Agent orchestration | LangGraph-style state machine in JS |
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Lucide |
| Deploy | Vercel (frontend), Railway (backend) |

---

## Project Structure

```
backend/
  agents/
    agentOrchestrator.js     LangGraph state machine
    monitorAgent.js          Silent participant polling
    balancerAgent.js         Participation ratio checker
    mentorAgent.js           AI suggestion generator
  routers/
    signals.py               Vision + audio signal ingestion
    quiz.py                  AI quiz generation
    quiz_pdf.py              PDF-to-quiz endpoint
    sessions.py              Session lifecycle
    report.py                Post-session report
  services/
    whisper_service.py       Groq Whisper transcription
    vocal_emotion_service.py Pure-Python RMS energy classifier
    eventBus.js              Pub/sub backbone
    participationService.js  Per-participant tracking
    sentimentService.js      DistilBERT SST-2 (local)
    classifierService.js     DeBERTa NLI zero-shot (local)
    analyticsService.js      In-memory session analytics
  server.js
  main.py
frontend/
  src/
    pages/       Home, HostDashboard, ParticipantJoin
    components/  AIInsightPanel, QuizBuilder, PDFQuizUploader,
                 QuizModal, AlertFeed, ParticipantGrid
    hooks/       useMeetingSocket
scripts/
  dev-local.sh           Start all services locally
  dev-vercel-backend.sh  Start backends + localtunnel for Vercel frontend
  start-tunnels.ps1      Windows PowerShell equivalent
```

---

## Quick Start (local)

```bash
# Clone and install
git clone https://github.com/Devarajan-Maheshwaran/EngageX-Classroom-AI.git
cd EngageX-Classroom-AI

# Node backend
cd backend
npm install
cp .env.example .env          # add GROQ_API_KEY
npm run dev                   # http://localhost:4000

# Python backend (new terminal)
cd backend
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 4001 --reload   # http://localhost:4001

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local    # VITE_BACKEND_URL=http://localhost:4000
                               # VITE_PYTHON_BACKEND_URL=http://localhost:4001
npm run dev                   # http://localhost:5173
```

Or use the convenience script:

```bash
bash scripts/dev-local.sh
```

### Test flow
1. Open `http://localhost:5173` and click **Start a new session**
2. Copy the 6-character session code
3. Open a second tab at `/join` — enter the code and a name
4. Send `I am confused about this` from the student tab
5. Watch the teacher dashboard: intent badge updates, sentiment chart plots,
   and after 3 confused messages a CONFUSION_SPIKE alert fires
6. Use the AI panel quiz tabs to generate an MCQ by topic, build one manually,
   or upload a PDF to extract questions

---

## Deploy (Local Backends + Vercel Frontend)

1. Start backends locally:
   ```bash
   bash scripts/dev-vercel-backend.sh
   ```
   The script starts both backends and opens two localtunnel URLs.

2. Push the repository to GitHub and import into Vercel.
   Set framework preset to `Vite`, root directory to `frontend`.

3. Add environment variables in the Vercel dashboard:
   - `VITE_BACKEND_URL` — Node localtunnel URL
   - `VITE_PYTHON_BACKEND_URL` — Python localtunnel URL

4. Deploy. The frontend is live while your local backends and tunnels are running.

> If Python AI features fail on first load, open the localtunnel URL directly
> in a browser tab once and accept the reminder page.
