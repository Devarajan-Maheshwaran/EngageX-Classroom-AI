// monitorAgent.js — polls participation every 60s
// Fires engagement:alert for participants silent beyond threshold
const bus                  = require('../services/eventBus');
const participationService = require('../services/participationService');
const analyticsService     = require('../services/analyticsService');

// 3 min for demo; set SILENT_THRESHOLD_MINS=15 in env for real classroom use
const SILENT_THRESHOLD_MS = (parseInt(process.env.SILENT_THRESHOLD_MINS, 10) || 3) * 60 * 1000;
const POLL_INTERVAL_MS    = 60 * 1000;

const timers = new Map();

function start(sessionId) {
  if (timers.has(sessionId)) return;
  const id = setInterval(() => {
    participationService.tick(sessionId);
    const all    = participationService.getSnapshot(sessionId);
    const silent = all.filter((p) => p.silentDurationMs > SILENT_THRESHOLD_MS);
    if (silent.length === 0) return;

    const names   = silent.map((p) => p.name).join(', ');
    const payload = {
      sessionId,
      type:     'SILENT_PARTICIPANTS',
      count:    silent.length,
      students: silent.map((p) => ({ id: p.studentId, name: p.name, silentMs: p.silentDurationMs })),
      message:  `${silent.length} participant(s) haven't engaged in ${SILENT_THRESHOLD_MS / 60000}+ min: ${names}`,
    };
    bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, payload);
    analyticsService.logAlert(sessionId, 'SILENT_PARTICIPANTS', payload.message);
  }, POLL_INTERVAL_MS);
  timers.set(sessionId, id);
  console.log(`[MonitorAgent] Started for ${sessionId} (threshold: ${SILENT_THRESHOLD_MS / 60000} min)`);
}

function stop(sessionId) {
  const id = timers.get(sessionId);
  if (id) { clearInterval(id); timers.delete(sessionId); }
}

module.exports = { start, stop };
