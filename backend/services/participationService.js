// participationService.js — per-student engagement tracking
const bus = require('./eventBus');

// Map<sessionId, Map<studentId, StudentRecord>>
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
  return sessions.get(sessionId);
}

function registerStudent(sessionId, studentId, name) {
  const session = getOrCreateSession(sessionId);
  if (!session.has(studentId)) {
    session.set(studentId, {
      studentId,
      name,
      messageCount: 0,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      silentDurationMs: 0,
      participationScore: 100,
    });
  }
}

function recordMessage(sessionId, studentId) {
  const session = sessions.get(sessionId);
  if (!session || !session.has(studentId)) return;
  const rec = session.get(studentId);
  rec.messageCount += 1;
  rec.lastActiveAt = Date.now();
  rec.silentDurationMs = 0;
  rec.participationScore = Math.min(100, rec.participationScore + 5);
}

function tick(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const now = Date.now();
  session.forEach((rec) => {
    rec.silentDurationMs = now - rec.lastActiveAt;
    // Decay score by 1 point per minute of silence
    const silentMins = rec.silentDurationMs / 60000;
    rec.participationScore = Math.max(0, 100 - Math.floor(silentMins * 1));
  });
}

function getSnapshot(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return Array.from(session.values());
}

function removeStudent(sessionId, studentId) {
  const session = sessions.get(sessionId);
  if (session) session.delete(studentId);
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

module.exports = {
  registerStudent,
  recordMessage,
  tick,
  getSnapshot,
  removeStudent,
  clearSession,
};
