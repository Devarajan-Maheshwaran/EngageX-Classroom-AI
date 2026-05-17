// analyticsService.js — Phase 5B: getSessionReport returns full recap shape
// All previous fields preserved; added startedAt, endedAt, sentimentLog, alertLog,
// cycleHistory, students snapshot, totalMessages, totalAlerts.

const sessions = new Map();

function initSession(sessionId) {
  if (sessions.has(sessionId)) return;
  sessions.set(sessionId, {
    startedAt:     Date.now(),
    endedAt:       null,
    sentimentLog:  [],   // [{ ts, studentId, label, score, intentLabel, intentScore, allScores }]
    alertLog:      [],   // [{ ts, type, message, suggestion }]
    cycleHistory:  [],   // [{ cycleNum, silentCount, participationRatio, ... }]
    slidingWindow: [],   // last 20 entries for real-time agent reads
  });
}

function clearSession(sessionId) {
  const s = sessions.get(sessionId);
  if (s) s.endedAt = Date.now(); // mark end time before clearing live state
  // Keep the record in memory for the recap REST endpoint until server restart.
  // Only clear the sliding window to free memory.
  if (s) s.slidingWindow = [];
}

function logSentiment(sessionId, studentId, label, score, intentLabel, intentScore, allScores) {
  const s = sessions.get(sessionId);
  if (!s) return;
  const entry = { ts: Date.now(), studentId, label, score, intentLabel, intentScore, allScores };
  s.sentimentLog.push(entry);
  s.slidingWindow.push(entry);
  if (s.slidingWindow.length > 20) s.slidingWindow.shift();
}

function logAlert(sessionId, type, message, suggestion) {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.alertLog.push({ ts: Date.now(), type, message, suggestion: suggestion || null });
}

function logCycle(sessionId, cycleData) {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.cycleHistory.push({ ts: Date.now(), ...cycleData });
  // Keep only last 200 cycles to avoid unbounded growth
  if (s.cycleHistory.length > 200) s.cycleHistory.shift();
}

function getSlidingWindow(sessionId) {
  return sessions.get(sessionId)?.slidingWindow || [];
}

/**
 * getSessionReport(sessionId)
 *
 * Returns the full recap object consumed by GET /api/session/:id/summary
 * and the Phase 5B SessionRecap page.
 *
 * Shape:
 * {
 *   sessionId, startedAt, endedAt,
 *   totalMessages, totalAlerts,
 *   sentimentLog, alertLog, cycleHistory,
 *   students: []  ← populated by server.js from participationService snapshot
 * }
 */
function getSessionReport(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return { sessionId, error: 'Session not found' };
  return {
    sessionId,
    startedAt:     s.startedAt,
    endedAt:       s.endedAt || Date.now(),
    totalMessages: s.sentimentLog.length,
    totalAlerts:   s.alertLog.length,
    sentimentLog:  s.sentimentLog,
    alertLog:      s.alertLog,
    cycleHistory:  s.cycleHistory,
    students:      [], // server.js merges participationService.getSnapshot() here
  };
}

module.exports = {
  initSession,
  clearSession,
  logSentiment,
  logAlert,
  logCycle,
  getSlidingWindow,
  getSessionReport,
};
