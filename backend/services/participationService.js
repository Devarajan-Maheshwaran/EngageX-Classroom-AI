// participationService.js — per-participant engagement tracking
// Phase 3A: each participant record now carries lastIntentLabel + lastIntentScore
// These are included in every room:state broadcast so the frontend can render live mood badges

const sessions = new Map(); // Map<sessionId, Map<studentId, ParticipantRecord>>

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
  return sessions.get(sessionId);
}

function registerStudent(sessionId, studentId, name) {
  const session = getOrCreateSession(sessionId);
  if (session.has(studentId)) return; // idempotent — safe for reconnects
  session.set(studentId, {
    studentId,
    name,
    messageCount:       0,
    joinedAt:           Date.now(),
    lastActiveAt:       Date.now(),
    silentDurationMs:   0,
    participationScore: 100,
    // Phase 3A intent tracking
    lastIntentLabel:    'engaged',
    lastIntentScore:    0.5,
    intentHistory:      [], // last 10 intents for dominant-intent calculation
  });
}

/**
 * recordMessage — called on every student:message.
 * Phase 3A: accepts optional intent fields to keep the record current.
 */
function recordMessage(sessionId, studentId, intentLabel, intentScore) {
  const session = sessions.get(sessionId);
  if (!session || !session.has(studentId)) return;
  const rec = session.get(studentId);

  rec.messageCount      += 1;
  rec.lastActiveAt       = Date.now();
  rec.silentDurationMs   = 0;
  rec.participationScore = Math.min(100, rec.participationScore + 5);

  if (intentLabel) {
    rec.lastIntentLabel = intentLabel;
    rec.lastIntentScore = intentScore || 0.5;
    rec.intentHistory.push(intentLabel);
    if (rec.intentHistory.length > 10) rec.intentHistory.shift();
  }
}

/**
 * tick — called by orchestrator each cycle to decay participation scores.
 * Score decays 1pt per minute of silence, floors at 0.
 */
function tick(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const now = Date.now();
  session.forEach((rec) => {
    rec.silentDurationMs   = now - rec.lastActiveAt;
    const silentMins       = rec.silentDurationMs / 60000;
    rec.participationScore = Math.max(0, 100 - Math.floor(silentMins));
  });
}

function getSnapshot(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  // Return lean objects — intentHistory stays internal
  return Array.from(session.values()).map((rec) => ({
    studentId:          rec.studentId,
    name:               rec.name,
    messageCount:       rec.messageCount,
    joinedAt:           rec.joinedAt,
    lastActiveAt:       rec.lastActiveAt,
    silentDurationMs:   rec.silentDurationMs,
    participationScore: rec.participationScore,
    lastIntentLabel:    rec.lastIntentLabel,
    lastIntentScore:    rec.lastIntentScore,
  }));
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
