// balancerAgent.js — detects participation imbalance and fires alerts
const bus = require('../services/eventBus');
const participationService = require('../services/participationService');
const analyticsService = require('../services/analyticsService');

const IMBALANCE_THRESHOLD = 0.3; // < 30% of class has spoken → alert
const CHECK_INTERVAL_MS = 120 * 1000; // every 2 minutes

const timers = new Map();

function start(sessionId) {
  if (timers.has(sessionId)) return;
  const id = setInterval(() => {
    const students = participationService.getSnapshot(sessionId);
    if (students.length < 3) return; // not worth alerting tiny sessions
    const active = students.filter((s) => s.messageCount > 0);
    const ratio = active.length / students.length;
    if (ratio < IMBALANCE_THRESHOLD) {
      const inactive = students.filter((s) => s.messageCount === 0).map((s) => s.name);
      const msg = `Only ${active.length}/${students.length} students have participated. ` +
                  `Silent: ${inactive.slice(0, 6).join(', ')}${inactive.length > 6 ? '...' : ''}`;
      const payload = { sessionId, type: 'PARTICIPATION_IMBALANCE', ratio, message: msg };
      bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, payload);
      analyticsService.logAlert(sessionId, 'PARTICIPATION_IMBALANCE', msg);
    }
  }, CHECK_INTERVAL_MS);
  timers.set(sessionId, id);
}

function stop(sessionId) {
  const id = timers.get(sessionId);
  if (id) { clearInterval(id); timers.delete(sessionId); }
}

module.exports = { start, stop };
