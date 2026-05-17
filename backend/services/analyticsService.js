// analyticsService.js — aggregates session-level analytics for report generation
const participationService = require('./participationService');

// Map<sessionId, { topicMoments, sentimentLog, alertLog }>
const analytics = new Map();

function initSession(sessionId) {
  analytics.set(sessionId, {
    topicMoments: [],   // { timestamp, topic, confusionScore }
    sentimentLog: [],   // { timestamp, studentId, label, score }
    alertLog: [],       // { timestamp, type, message }
  });
}

function logSentiment(sessionId, studentId, label, score) {
  const s = analytics.get(sessionId);
  if (!s) return;
  s.sentimentLog.push({ timestamp: Date.now(), studentId, label, score });
}

function logAlert(sessionId, type, message) {
  const s = analytics.get(sessionId);
  if (!s) return;
  s.alertLog.push({ timestamp: Date.now(), type, message });
}

function logTopicMoment(sessionId, topic, confusionScore) {
  const s = analytics.get(sessionId);
  if (!s) return;
  s.topicMoments.push({ timestamp: Date.now(), topic, confusionScore });
}

function getSessionReport(sessionId) {
  const data = analytics.get(sessionId) || {};
  const students = participationService.getSnapshot(sessionId);
  return { students, ...data };
}

function clearSession(sessionId) {
  analytics.delete(sessionId);
}

module.exports = { initSession, logSentiment, logAlert, logTopicMoment, getSessionReport, clearSession };
