// participationService.js — per-participant engagement tracking
// Phase 3A: lastIntentLabel/Score + intentHistory per participant
// Phase 4B: reconnect restore — if a participant reconnects with same name+sessionId,
//           their existing record is preserved and socketId is updated in place.
//           This prevents duplicate tiles on the host dashboard after mobile network drops.

const sessions = new Map(); // Map<sessionId, Map<socketId, ParticipantRecord>>

// Phase 4B: secondary index by (sessionId, name) for reconnect lookup
// Map<`${sessionId}:${name}`, socketId>
const nameIndex = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
  return sessions.get(sessionId);
}

/**
 * registerStudent
 * Phase 4B: checks nameIndex first. If a record with the same name already
 * exists in the session (reconnect scenario), migrates it to the new socketId
 * instead of creating a duplicate.
 *
 * @param {string} sessionId
 * @param {string} socketId   - current socket.id (changes on reconnect)
 * @param {string} name
 * @returns {'new'|'restored'} whether this was a fresh join or a reconnect
 */
function registerStudent(sessionId, socketId, name) {
  const session  = getOrCreateSession(sessionId);
  const indexKey = `${sessionId}:${name.toLowerCase().trim()}`;
  const existingSocketId = nameIndex.get(indexKey);

  if (existingSocketId && session.has(existingSocketId)) {
    // Reconnect: migrate the existing record to the new socketId
    const existing = session.get(existingSocketId);
    session.delete(existingSocketId);
    existing.studentId    = socketId;
    existing.lastActiveAt = Date.now(); // treat reconnect as activity
    session.set(socketId, existing);
    nameIndex.set(indexKey, socketId);
    console.log(`[ParticipationService] Reconnect restored: ${name} (${existingSocketId} → ${socketId})`);
    return 'restored';
  }

  // Fresh join
  if (session.has(socketId)) return 'new'; // idempotent guard
  session.set(socketId, {
    studentId:          socketId,
    name,
    messageCount:       0,
    joinedAt:           Date.now(),
    lastActiveAt:       Date.now(),
    silentDurationMs:   0,
    participationScore: 100,
    lastIntentLabel:    'engaged',
    lastIntentScore:    0.5,
    intentHistory:      [],
  });
  nameIndex.set(indexKey, socketId);
  return 'new';
}

/**
 * recordMessage — updates score, lastActiveAt, and intent fields.
 */
function recordMessage(sessionId, socketId, intentLabel, intentScore) {
  const session = sessions.get(sessionId);
  if (!session || !session.has(socketId)) return;
  const rec = session.get(socketId);

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
 * tick — called by orchestrator each cycle.
 * Decays participation score 1pt/min of silence, floors at 0.
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

/**
 * getSnapshot — returns lean objects for room:state broadcast.
 * intentHistory stays internal to avoid bloating the socket payload.
 */
function getSnapshot(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
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

function removeStudent(sessionId, socketId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const rec = session.get(socketId);
  if (rec) {
    // Clean up nameIndex entry only if it still points to this socketId
    const indexKey = `${sessionId}:${rec.name.toLowerCase().trim()}`;
    if (nameIndex.get(indexKey) === socketId) nameIndex.delete(indexKey);
    session.delete(socketId);
  }
}

function clearSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    // Clean nameIndex for all participants in this session
    session.forEach((rec) => {
      const indexKey = `${sessionId}:${rec.name.toLowerCase().trim()}`;
      nameIndex.delete(indexKey);
    });
  }
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
