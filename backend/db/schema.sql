CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    join_code TEXT,
    title TEXT,
    created_at TEXT,
    ended_at TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    display_name TEXT
);

CREATE TABLE IF NOT EXISTS session_students (
    session_id TEXT,
    student_id TEXT,
    joined_at TEXT,
    left_at TEXT,
    role TEXT,
    PRIMARY KEY (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS text_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    student_id TEXT,
    ts TEXT,
    text TEXT,
    sentiment_label TEXT,
    sentiment_score REAL,
    intent_label TEXT,
    intent_score REAL,
    engagement_score REAL
);

CREATE TABLE IF NOT EXISTS audio_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    student_id TEXT,
    ts TEXT,
    transcript TEXT,
    vocal_emotion TEXT,
    engagement_score REAL
);

CREATE TABLE IF NOT EXISTS vision_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    student_id TEXT,
    ts TEXT,
    dominant_emotion TEXT,
    looking_away INTEGER,
    engagement_score REAL
);

CREATE TABLE IF NOT EXISTS engagement_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    student_id TEXT,
    ts TEXT,
    alert_type TEXT,
    message TEXT,
    fused_score REAL,
    source TEXT
);

CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    topic TEXT,
    payload_json TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS quiz_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT,
    session_id TEXT,
    student_id TEXT,
    ts TEXT,
    answer_id TEXT,
    answer_text TEXT,
    is_correct INTEGER
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    student_id TEXT,
    summary TEXT,
    recommendations_json TEXT,
    created_at TEXT
);
