// analyticsService.js — session-level analytics aggregator
// Phase 3A: intent fields added to sentimentLog + sliding window for confusion detection
const participationService = require('./participationService');

// Map<sessionId, SessionAnalytics>
const analytics = new Map();

const WINDOW_MAX = 20; // sliding window cap — last 20 messages

function initSession(sessionId) {
  analytics.set(sessionId, {
    startedAt:    Date.now(),
    sentimentLog: [],  // { ts, studentId, label, score, intentLabel, intentScore, allScores }
    alertLog:     [],  // { ts, type, message, suggestion }
    topicMoments: [],  // { ts, topic, confusionScore } — Phase 4+
    cycleHistory: [],  // { ts, cycleNum, ... } — Phase 4A orchestrator cycles
    recentWindow: [],  // sliding window of last WINDOW_MAX entries for confusion detection
  });
}

/**
 * logSentiment — stores sentiment + intent for every participant message.
 * Phase 3A: accepts intentLabel, intentScore, allScores in addition to sentiment.
 */
function logSentiment(sessionId, studentId, sentimentLabel, sentimentScore, intentLabel, intentScore, allScores) {
  const s = analytics.get(sessionId);
  if (!s) return;

  const entry = {
    ts:          Date.now(),
    studentId,
    label:       sentimentLabel,
    score:       sentimentScore,
    intentLabel: intentLabel || 'engaged',
    intentScore: intentScore || 0.5,
    allScores:   allScores   || {},
  };

  s.sentimentLog.push(entry);

  // Maintain bounded sliding window
  s.recentWindow.push(entry);
  if (s.recentWindow.length > WINDOW_MAX) s.recentWindow.shift();
}

/**
 * getRecentWindow — returns last N entries from the sliding window.
 * Used by engagementService (Phase 3B) to check for confusion spikes.
 */
function getRecentWindow(sessionId, n) {
  const s = analytics.get(sessionId);
  if (!s) return [];
  return n ? s.recentWindow.slice(-n) : [...s.recentWindow];
}

function logAlert(sessionId, type, message, suggestion) {
  const s = analytics.get(sessionId);
  if (!s) return;
  s.alertLog.push({ ts: Date.now(), type, message, suggestion: suggestion || null });
}

function logTopicMoment(sessionId, topic, confusionScore) {
  const s = analytics.get(sessionId);
  if (!s) return;
  s.topicMoments.push({ ts: Date.now(), topic, confusionScore });
}

// Called by orchestrator each cycle (Phase 4A)
function logCycle(sessionId, cycleData) {
  const s = analytics.get(sessionId);
  if (!s) return;
  s.cycleHistory.push({ ts: Date.now(), ...cycleData });
  if (s.cycleHistory.length > 100) s.cycleHistory.shift();
}

function getSessionReport(sessionId) {
  const data     = analytics.get(sessionId) || {};
  const students = participationService.getSnapshot(sessionId);
  const duration = data.startedAt ? Date.now() - data.startedAt : 0;

  // Compute dominantIntent per participant from full sentimentLog
  const intentMap = {};
  (data.sentimentLog || []).forEach(({ studentId, intentLabel }) => {
    if (!intentMap[studentId]) intentMap[studentId] = {};
    intentMap[studentId][intentLabel] = (intentMap[studentId][intentLabel] || 0) + 1;
  });

  const perParticipant = students.map((p) => {
    const counts   = intentMap[p.studentId] || {};
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'engaged';
    return { ...p, dominantIntent: dominant };
  });

  return {
    sessionId,
    duration,
    startedAt:    data.startedAt,
    students:     perParticipant,
    sentimentLog: data.sentimentLog  || [],
    alertLog:     data.alertLog      || [],
    topicMoments: data.topicMoments  || [],
    cycleHistory: data.cycleHistory  || [],
  };
}

function clearSession(sessionId) {
  analytics.delete(sessionId);
}

module.exports = {
  initSession,
  logSentiment,
  logAlert,
  logTopicMoment,
  logCycle,
  getRecentWindow,
  getSessionReport,
  clearSession,
};
