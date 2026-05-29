const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/engagex.db');
let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function insertSession(session) {
  const stmt = getDb().prepare(`
    INSERT INTO sessions (id, join_code, title, created_at, status)
    VALUES (@id, @join_code, @title, @started_at, @status)
  `);
  stmt.run(session);
}

function endSession(sessionId, endedAt) {
  const stmt = getDb().prepare(`
    UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?
  `);
  stmt.run(endedAt, sessionId);
}

function upsertSessionStudent(student) {
  const stmt = getDb().prepare(`
    INSERT INTO session_students (session_id, student_id, joined_at, role)
    VALUES (@session_id, @socket_id, @joined_at, 'student')
    ON CONFLICT(session_id, student_id) DO UPDATE SET
      joined_at = excluded.joined_at,
      left_at = NULL
  `);
  stmt.run(student);

  const stmt2 = getDb().prepare(`
    INSERT OR IGNORE INTO students (id, display_name)
    VALUES (@socket_id, @student_name)
  `);
  stmt2.run(student);
}

function removeSessionStudent(sessionId, studentId, leftAt) {
  const stmt = getDb().prepare(`
    UPDATE session_students SET left_at = ? WHERE session_id = ? AND student_id = ?
  `);
  stmt.run(leftAt, sessionId, studentId);
}

function logTextSignal(signal) {
  const stmt = getDb().prepare(`
    INSERT INTO text_signals (session_id, student_id, ts, text, sentiment_label, sentiment_score, intent_label, intent_score, engagement_score)
    VALUES (@session_id, @student_id, @ts, @text, @sentiment_label, @sentiment_score, @intent_label, @intent_score, @engagement_score)
  `);
  stmt.run(signal);
}

function logAlert(alert) {
  const stmt = getDb().prepare(`
    INSERT INTO engagement_alerts (session_id, student_id, ts, alert_type, message, fused_score, source)
    VALUES (@session_id, @student_id, @ts, @alert_type, @message, @fused_score, @source)
  `);
  stmt.run(alert);
}

module.exports = {
  getDb,
  insertSession,
  endSession,
  upsertSessionStudent,
  removeSessionStudent,
  logTextSignal,
  logAlert,
};
