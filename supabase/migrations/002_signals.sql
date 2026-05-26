-- Phase 2: Signals

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
-- HELPER VIEWS
-- ─────────────────────────────────────────────────────────────
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
