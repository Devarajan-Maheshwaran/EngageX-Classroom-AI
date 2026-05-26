-- Phase 1: Core Schema (Sessions & Students)

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
