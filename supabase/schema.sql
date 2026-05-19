-- EngageX Phase 2: Full Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run)

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id     UUID,                              -- optional: future auth
    join_code      VARCHAR(8) UNIQUE NOT NULL,
    title          TEXT NOT NULL DEFAULT 'Untitled Session',
    started_at     TIMESTAMPTZ DEFAULT now(),
    ended_at       TIMESTAMPTZ,
    status         TEXT NOT NULL DEFAULT 'waiting'   -- waiting | active | ended
);

CREATE INDEX IF NOT EXISTS idx_sessions_join_code ON sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_sessions_status    ON sessions(status);

-- ─────────────────────────────────────────────────────────────
-- SESSION STUDENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_students (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_name   TEXT NOT NULL,
    socket_id      TEXT,                              -- current socket.id, updated on reconnect
    joined_at      TIMESTAMPTZ DEFAULT now(),
    left_at        TIMESTAMPTZ,
    is_active      BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_session_students_session ON session_students(session_id);
CREATE INDEX IF NOT EXISTS idx_session_students_active  ON session_students(session_id, is_active);

-- ─────────────────────────────────────────────────────────────
-- STUDENT SIGNALS  (time-series, high write volume)
-- ─────────────────────────────────────────────────────────────
-- signal_type: 'text' | 'text_deleted' | 'vision' | 'audio' | 'behavior' | 'reaction'
-- signal_data: free-form JSONB, shape differs per type
--
-- text:         { text, sentiment, sentimentScore, intent, intentScores, editCount }
-- text_deleted: { partialText, editCount, abandonedAt }
-- vision:       { facePresent, dominantExpression, lookingAwayRatio, eyeOpenRatio }
-- audio:        { transcript, vocalEmotion, pitch, energy, speechRate }
-- behavior:     { participationFreq, silenceDurationMs, responseLatencyMs }
-- reaction:     { type: 'got_it' | 'confused' | 'question' }

CREATE TABLE IF NOT EXISTS student_signals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
    student_id       UUID NOT NULL REFERENCES session_students(id) ON DELETE CASCADE,
    signal_type      TEXT NOT NULL,
    signal_data      JSONB NOT NULL DEFAULT '{}',
    engagement_score FLOAT,                           -- computed by agent, 0–100
    recorded_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_session     ON student_signals(session_id);
CREATE INDEX IF NOT EXISTS idx_signals_student     ON student_signals(student_id);
CREATE INDEX IF NOT EXISTS idx_signals_type        ON student_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_recorded    ON student_signals(recorded_at DESC);
-- Composite: fetch last N signals for a student in a session fast
CREATE INDEX IF NOT EXISTS idx_signals_student_time ON student_signals(student_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────
-- ENGAGEMENT ALERTS
-- ─────────────────────────────────────────────────────────────
-- alert_type:  'silence' | 'confusion' | 'frustration' | 'anxiety' | 'class_confusion' | 'participation_imbalance'
-- severity:    'info' | 'warning' | 'critical'

CREATE TABLE IF NOT EXISTS engagement_alerts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
    student_id       UUID REFERENCES session_students(id),  -- NULL = class-wide alert
    alert_type       TEXT NOT NULL,
    severity         TEXT NOT NULL DEFAULT 'info',
    agent_reasoning  TEXT,                            -- raw LLM reasoning
    suggestion       TEXT,                            -- intervention suggestion for teacher
    teacher_action   TEXT,                            -- logged when teacher acts
    resolved         BOOLEAN DEFAULT FALSE,
    raised_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_session      ON engagement_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_student      ON engagement_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved   ON engagement_alerts(session_id, resolved) WHERE resolved = FALSE;

-- ─────────────────────────────────────────────────────────────
-- QUIZZES
-- ─────────────────────────────────────────────────────────────
-- question_type: 'mcq' | 'short_answer' | 'truefalse' | 'confidence'

CREATE TABLE IF NOT EXISTS quizzes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question         TEXT NOT NULL,
    question_type    TEXT NOT NULL DEFAULT 'mcq',
    options          JSONB,                           -- ["Option A", "Option B", ...]
    correct_answer   TEXT,                            -- NULL for short_answer / confidence
    time_limit_secs  INTEGER,                         -- NULL = no limit
    launched_at      TIMESTAMPTZ DEFAULT now(),
    closed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quizzes_session ON quizzes(session_id);

-- ─────────────────────────────────────────────────────────────
-- QUIZ RESPONSES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_responses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id          UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id       UUID NOT NULL REFERENCES session_students(id) ON DELETE CASCADE,
    answer           TEXT,
    is_correct       BOOLEAN,
    response_time_ms INTEGER,                         -- ms from quiz launch to submit
    edit_count       INTEGER DEFAULT 0,               -- how many times they changed answer
    submitted_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE(quiz_id, student_id)                       -- one response per student per quiz
);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_quiz    ON quiz_responses(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_student ON quiz_responses(student_id);

-- ─────────────────────────────────────────────────────────────
-- SESSION REPORTS  (generated post-session by Report Crew)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id          UUID NOT NULL REFERENCES session_students(id) ON DELETE CASCADE,
    engagement_score    FLOAT,
    participation_rate  FLOAT,
    quiz_accuracy       FLOAT,
    signal_summary      JSONB DEFAULT '{}',           -- { topIntent, alertCount, deletedMsgs, ... }
    narrative           TEXT,                         -- Groq-generated natural language summary
    follow_up_actions   TEXT[],                       -- 3-bullet recommended actions
    pdf_url             TEXT,                         -- Supabase Storage URL
    generated_at        TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_session ON session_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_student ON session_reports(student_id);

-- ─────────────────────────────────────────────────────────────
-- HELPER VIEWS
-- ─────────────────────────────────────────────────────────────

-- v_active_sessions: quick lookup of sessions currently running
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT
    s.id,
    s.join_code,
    s.title,
    s.started_at,
    COUNT(ss.id) FILTER (WHERE ss.is_active = TRUE) AS active_student_count
FROM sessions s
LEFT JOIN session_students ss ON ss.session_id = s.id
WHERE s.status = 'active'
GROUP BY s.id;

-- v_student_signal_summary: latest engagement state per student
CREATE OR REPLACE VIEW v_student_signal_summary AS
SELECT DISTINCT ON (student_id)
    student_id,
    session_id,
    engagement_score,
    signal_type  AS last_signal_type,
    signal_data  AS last_signal_data,
    recorded_at  AS last_signal_at
FROM student_signals
ORDER BY student_id, recorded_at DESC;
