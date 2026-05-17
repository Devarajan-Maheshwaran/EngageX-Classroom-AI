// balancerAgent.js — detects participation imbalance in the room
const bus                  = require('../services/eventBus');
const participationService = require('../services/participationService');
const analyticsService     = require('../services/analyticsService');

const IMBALANCE_THRESHOLD = 0.35;   // < 35% of room spoken → alert
const MIN_ROOM_SIZE       = 3;      // don't alert for tiny 1-2 person rooms
const MIN_MESSAGES_TOTAL  = 3;      // wait for some signal before flagging
const CHECK_INTERVAL_MS   = 90 * 1000;

const timers = new Map();

function start(sessionId) {
  if (timers.has(sessionId)) return;
  const id = setInterval(() => {
    const all = participationService.getSnapshot(sessionId);
    if (all.length < MIN_ROOM_SIZE) return;

    const totalMessages = all.reduce((acc, p) => acc + p.messageCount, 0);
    if (totalMessages < MIN_MESSAGES_TOTAL) return;

    const active  = all.filter((p) => p.messageCount > 0);
    const ratio   = active.length / all.length;
    if (ratio >= IMBALANCE_THRESHOLD) return;

    const silent  = all.filter((p) => p.messageCount === 0).map((p) => p.name);
    const preview = silent.slice(0, 5).join(', ') + (silent.length > 5 ? ` +${silent.length - 5} more` : '');
    const msg     = `Only ${active.length}/${all.length} participants have spoken. Silent: ${preview}`;
    const payload = { sessionId, type: 'PARTICIPATION_IMBALANCE', ratio, message: msg };

    bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, payload);
    analyticsService.logAlert(sessionId, 'PARTICIPATION_IMBALANCE', msg);
  }, CHECK_INTERVAL_MS);
  timers.set(sessionId, id);
}

function stop(sessionId) {
  const id = timers.get(sessionId);
  if (id) { clearInterval(id); timers.delete(sessionId); }
}

module.exports = { start, stop };
