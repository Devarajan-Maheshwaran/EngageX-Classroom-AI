# EngageX v2 — Deployment Guide

## Stack

| Layer | Service | Tier |
|-------|---------|------|
| Frontend | Vercel | Free |
| Backend | Railway | Hobby ($5/mo) or Render Free |
| Database | Supabase | Free (500 MB) |
| Storage | Supabase Storage | Free (1 GB) |
| Cache / Rate limiting | Upstash Redis | Free (10k req/day) |
| LLM | Groq API | Free tier |

---

## 1. Supabase Setup

1. Create project at [supabase.com](https://supabase.com).
2. Run all migrations in order:
   ```bash
   supabase db push
   # or manually run:
   # supabase/migrations/001_initial_schema.sql
   # supabase/migrations/002_signals.sql
   # supabase/migrations/003_alerts.sql
   # supabase/migrations/004_quizzes.sql
   # supabase/migrations/005_session_reports.sql
   # supabase/migrations/006_quiz_insights.sql
   # supabase/migrations/007_student_pdf_reports.sql
   ```
3. Create Storage bucket: `engagex-reports` (public).
4. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API.

---

## 2. Backend — Local Docker + Ngrok

This setup is used to expose your local backend securely to the public internet so that the Vercel-deployed frontend can communicate with it. This is ideal for HR / Researcher demonstrations without needing a permanent cloud backend deployment.

```bash
# Start your local backend services
docker-compose up -d
```

In separate terminals, start `ngrok` to expose the ports:
```bash
# Terminal 1 (Node Backend)
ngrok http 4000

# Terminal 2 (Python Backend)
ngrok http 4001
```

Copy the generated `https://*.ngrok-free.app` URLs for both. Keep these terminal windows open during your demonstration.

---

## 3. Frontend — Vercel

```bash
npm install -g vercel
cd frontend
vercel --prod
```

During setup, ensure the **Root Directory** is set to `frontend`. 

Set environment variables in the Vercel dashboard:
```
VITE_BACKEND_URL=https://<your-node-ngrok-url>.ngrok-free.app
VITE_PYTHON_BACKEND_URL=https://<your-python-ngrok-url>.ngrok-free.app
```

`vercel.json` is already configured in `frontend/` to handle SPA routing.

---

## 4. Upstash Redis (rate limiting)

1. Create database at [upstash.com](https://upstash.com) (free tier).
2. Copy REST URL and token to Railway env vars.
3. If not configured, the backend falls back to in-process rate limiting automatically.

---

## 5. End-to-end test checklist

- [ ] Teacher creates session → gets join code
- [ ] 3 student browsers join with code
- [ ] Students see privacy consent dialog
- [ ] Vision + audio pipelines activate on accept
- [ ] Teacher dashboard shows live engagement grid
- [ ] Engagement chart populates over 60s
- [ ] Teacher pushes quiz → student overlay appears with countdown
- [ ] Quiz Crew analysis triggered → insights panel populates
- [ ] Session summary generated
- [ ] Recap page loads at `/recap/[sessionId]`
- [ ] PDF download works for at least one student

---

## 6. Cost summary

All services used have **free tiers** that cover:
- Up to ~50 concurrent students
- ~100 sessions/month
- PDF storage up to 1 GB
- LLM calls up to Groq free limits (~14,400 req/day on free)

Total monthly cost for a single school: **$0** (or $5 for Railway Hobby if Render free tier is insufficient).
