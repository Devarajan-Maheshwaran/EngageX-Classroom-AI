// balancerAgent.js — Phase 4A: pure function, no internal timers
//
// The orchestrator calls runCycle(sessionId) on every N-th master cycle
// (balancer runs less frequently than the monitor — see orchestrator config).
// This file owns ONLY the participation-ratio logic.

const bus                  = require('../services/eventBus');
const participationService = require('../services/participationService');

const IMBALANCE_THRESHOLD = parseFloat(process.env.IMBALANCE_THRESHOLD || '0.35');
const MIN_ROOM_SIZE       = parseInt(process.env.MIN_ROOM_SIZE         || '2',   10);
const MIN_MESSAGES_TOTAL  = 3;

/**
 * runCycle(sessionId)
 *
 * Checks participation ratio. Fires PARTICIPATION_IMBALANCE if < IMBALANCE_THRESHOLD
 * of the room has spoken and there are enough participants + messages to be meaningful.
 *
 * @param {string} sessionId
 * @returns {{ ratio: number, triggered: boolean }}
 */
function runCycle(sessionId) {
  const all = participationService.getSnapshot(sessionId);

  if (all.length < MIN_ROOM_SIZE) return { ratio: 1, triggered: false };

  const totalMessages = all.reduce((sum, p) => sum + p.messageCount, 0);
  if (totalMessages < MIN_MESSAGES_TOTAL) return { ratio: 1, triggered: false };

  const active  = all.filter((p) => p.messageCount > 0);
  const ratio   = active.length / all.length;

  if (ratio >= IMBALANCE_THRESHOLD) return { ratio, triggered: false };

  const silent  = all.filter((p) => p.messageCount === 0).map((p) => p.name);
  const preview = silent.slice(0, 5).join(', ') + (silent.length > 5 ? ` +${silent.length - 5} more` : '');

  bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, {
    sessionId,
    type:    'PARTICIPATION_IMBALANCE',
    ratio,
    message: `Only ${active.length}/${all.length} participants have spoken. Silent: ${preview}`,
  });

  return { ratio, triggered: true };
}

module.exports = { runCycle, IMBALANCE_THRESHOLD };
