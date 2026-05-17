// monitorAgent.js — polls participation every 60s, fires engagement:alert for silent students
const bus = require('../services/eventBus');
const participationService = require('../services/participationService');
const analyticsService = require('../services/analyticsService');

const SILENT_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const POLL_INTERVAL_MS = 60 * 1000;          // 60 seconds

const timers = new Map(); // sessionId → intervalId

function start(sessionId) {
  if (timers.has(sessionId)) return;
  const id = setInterval(() => {
    participationService.tick(sessionId);
    const students = participationService.getSnapshot(sessionId);
    const silent = students.filter((s) => s.silentDurationMs > SILENT_THRESHOLD_MS);
    if (silent.length > 0) {
      const names = silent.map((s) => s.name).join(', ');
      const alertPayload = {
        sessionId,
        type: 'SILENT_STUDENTS',
        count: silent.length,
        students: silent.map((s) => ({ id: s.studentId, name: s.name, silentMs: s.silentDurationMs })),
        message: `${silent.length} student(s) haven't engaged in 15+ minutes: ${names}`,
      };
      bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, alertPayload);
      analyticsService.logAlert(sessionId, 'SILENT_STUDENTS', alertPayload.message);
    }
  }, POLL_INTERVAL_MS);
  timers.set(sessionId, id);
  console.log(`[MonitorAgent] Started for session ${sessionId}`);
}

function stop(sessionId) {
  const id = timers.get(sessionId);
  if (id) {
    clearInterval(id);
    timers.delete(sessionId);
    console.log(`[MonitorAgent] Stopped for session ${sessionId}`);
  }
}

module.exports = { start, stop };
