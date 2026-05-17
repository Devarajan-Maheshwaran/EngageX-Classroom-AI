// monitorAgent.js — Phase 4A: pure function, no internal timers
//
// The orchestrator calls runCycle(sessionId) every AGENT_CYCLE_SECS.
// This file owns ONLY the silence-detection logic — not the scheduling.
//
// Why pure functions:
//   • No timer drift between agents (previously monitor fired every 60s,
//     balancer every 90s — they could race or stack on low-resource Railway).
//   • Orchestrator controls ALL timing from one place.
//   • Fully testable: call runCycle() directly without setInterval.

const bus                  = require('../services/eventBus');
const participationService = require('../services/participationService');

const SILENT_THRESHOLD_MS = (parseInt(process.env.SILENT_THRESHOLD_MINS, 10) || 3) * 60 * 1000;

/**
 * runCycle(sessionId)
 *
 * Ticks participation scores, checks for silent participants.
 * Returns a summary object so the orchestrator can include it in cycle:log.
 *
 * @param {string} sessionId
 * @returns {{ silentCount: number, silentNames: string[] }}
 */
function runCycle(sessionId) {
  participationService.tick(sessionId);
  const all    = participationService.getSnapshot(sessionId);
  const silent = all.filter((p) => p.silentDurationMs > SILENT_THRESHOLD_MS);

  if (silent.length > 0) {
    const names = silent.map((p) => p.name).join(', ');
    bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, {
      sessionId,
      type:     'SILENT_PARTICIPANTS',
      count:    silent.length,
      students: silent.map((p) => ({ id: p.studentId, name: p.name, silentMs: p.silentDurationMs })),
      message:  `${silent.length} participant(s) silent for ${SILENT_THRESHOLD_MS / 60000}+ min: ${names}`,
    });
  }

  return {
    silentCount: silent.length,
    silentNames: silent.map((p) => p.name),
  };
}

module.exports = { runCycle, SILENT_THRESHOLD_MS };
