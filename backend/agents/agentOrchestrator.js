// agentOrchestrator.js — Phase 4A: single master cycle drives all agents
//
// Architecture change from Phase 3B:
//   BEFORE: monitorAgent had setInterval(60s), balancerAgent had setInterval(90s).
//           They ran independently, could race, and were hard to reason about.
//   AFTER:  One setInterval per session (AGENT_CYCLE_SECS). Every tick runs
//           the full MONITOR → CLASSIFY → BALANCE → INTERVENE → LOG pipeline.
//           Agents are pure functions called by the orchestrator.
//
// State graph (unchanged from Phase 3B):
//   IDLE ──START──▶ MONITOR ──ALERT_FIRED──▶ CLASSIFY ──CLASSIFIED──▶ BALANCE
//                    ▲                                                    │
//                    │                        ┌─ IMBALANCE ──▶ INTERVENE │
//                    │                        └─ OK ──────────▶ LOG       │
//                    └────────────── NEXT_CYCLE ◀──────────────────┘
//                                   SESSION_END ──▶ ENDED

const monitorAgent         = require('./monitorAgent');
const balancerAgent        = require('./balancerAgent');
const mentorAgent          = require('./mentorAgent');         // auto-wires ENGAGEMENT_ALERT
const participationService = require('../services/participationService');
const analyticsService     = require('../services/analyticsService');
const engagementService    = require('../services/engagementService');
const bus                  = require('../services/eventBus');

// ─── Config ────────────────────────────────────────────────────────────────────
const CYCLE_MS            = (parseInt(process.env.AGENT_CYCLE_SECS, 10)  || 60)  * 1000;
// Balancer runs every N master cycles (avoids over-alerting on fast cycles)
const BALANCER_EVERY_N    = parseInt(process.env.BALANCER_EVERY_N,   10) || 2;

// ─── State machine definition ───────────────────────────────────────────────────────
const STATES = {
  IDLE:      'IDLE',
  MONITOR:   'MONITOR',
  CLASSIFY:  'CLASSIFY',
  BALANCE:   'BALANCE',
  INTERVENE: 'INTERVENE',
  LOG:       'LOG',
  ENDED:     'ENDED',
};

const TRANSITIONS = {
  IDLE:      { START:       STATES.MONITOR   },
  MONITOR:   { ALERT_FIRED: STATES.CLASSIFY,
               TICK:        STATES.MONITOR   },
  CLASSIFY:  { CLASSIFIED:  STATES.BALANCE   },
  BALANCE:   { IMBALANCE:   STATES.INTERVENE,
               OK:          STATES.LOG       },
  INTERVENE: { DONE:        STATES.LOG       },
  LOG:       { NEXT_CYCLE:  STATES.MONITOR,
               SESSION_END: STATES.ENDED     },
  ENDED:     {},
};

function transition(current, event) {
  return TRANSITIONS[current]?.[event] || current;
}

// ─── Alert deduplication ──────────────────────────────────────────────────────────
// Tracks last-fired timestamp per (sessionId, alertType).
// Prevents the same alert from re-firing within ALERT_COOLDOWN_MS.
// Note: CONFUSION_SPIKE has its own cooldown in engagementService —
//       this layer deduplicates monitor + balancer alerts.
const ALERT_COOLDOWN_MS = (parseInt(process.env.SILENT_THRESHOLD_MINS, 10) || 3) * 60 * 1000;
const alertLastFired    = new Map(); // key: `${sessionId}:${alertType}`

function canFire(sessionId, alertType) {
  const key  = `${sessionId}:${alertType}`;
  const last = alertLastFired.get(key) || 0;
  return Date.now() - last >= ALERT_COOLDOWN_MS;
}

function markFired(sessionId, alertType) {
  alertLastFired.set(`${sessionId}:${alertType}`, Date.now());
}

function clearAlertHistory(sessionId) {
  for (const key of alertLastFired.keys()) {
    if (key.startsWith(`${sessionId}:`)) alertLastFired.delete(key);
  }
}

// ─── Per-session context ─────────────────────────────────────────────────────────────
// Map<sessionId, { state, cycleCount, timerId }>
const sessions = new Map();

function getCtx(sessionId) {
  return sessions.get(sessionId);
}

function advanceState(sessionId, event) {
  const ctx = getCtx(sessionId);
  if (!ctx) return;
  const next = transition(ctx.state, event);
  if (next !== ctx.state) {
    console.log(`[Orchestrator] ${sessionId}: ${ctx.state} ──${event}──▶ ${next}`);
    ctx.state = next;
  }
}

// ─── Master cycle ──────────────────────────────────────────────────────────────────
// Called every CYCLE_MS. Executes full MONITOR → BALANCE → LOG pipeline.
// Agents are pure function calls — no independent timers anywhere.

function runMasterCycle(sessionId) {
  const ctx = getCtx(sessionId);
  if (!ctx || ctx.state === STATES.ENDED) return;

  ctx.cycleCount++;
  console.log(`[Orchestrator] Cycle #${ctx.cycleCount} for ${sessionId}`);

  // ── STEP 1: MONITOR — silence detection + score decay ─────────────────────
  const monitorResult = monitorAgent.runCycle(sessionId);

  // Deduplicate: only advance graph if alert fired AND cooldown allows
  const silentFired = monitorResult.silentCount > 0 && canFire(sessionId, 'SILENT_PARTICIPANTS');
  if (silentFired) markFired(sessionId, 'SILENT_PARTICIPANTS');

  // ── STEP 2: BALANCE — run every BALANCER_EVERY_N cycles ───────────────────
  let balancerResult = { ratio: 1, triggered: false };
  if (ctx.cycleCount % BALANCER_EVERY_N === 0) {
    balancerResult = balancerAgent.runCycle(sessionId);
    if (balancerResult.triggered && canFire(sessionId, 'PARTICIPATION_IMBALANCE')) {
      markFired(sessionId, 'PARTICIPATION_IMBALANCE');
    } else if (balancerResult.triggered) {
      // Balancer wanted to fire but cooldown blocked it — suppress the already-published event
      // (bus is sync so it already fired; we note this in the cycle log for observability)
      balancerResult.deduped = true;
    }
  }

  // ── STEP 3: LOG — emit cycle:log event + write to analyticsService ─────────
  const cycleData = {
    cycleNum:          ctx.cycleCount,
    silentCount:       monitorResult.silentCount,
    silentNames:       monitorResult.silentNames,
    participationRatio: balancerResult.ratio,
    balancerTriggered: balancerResult.triggered,
    balancerDeduped:   balancerResult.deduped || false,
    state:             ctx.state,
  };

  analyticsService.logCycle(sessionId, cycleData);

  // Emit cycle:log to eventBus (debug subscribers and Phase 5B recap can use this)
  bus.publish(bus.EVENTS.CYCLE_LOG, { sessionId, ...cycleData });

  // ── Advance state graph ─────────────────────────────────────────────────────
  const alertFiredThisCycle = silentFired || (balancerResult.triggered && !balancerResult.deduped);
  if (alertFiredThisCycle) {
    advanceState(sessionId, 'ALERT_FIRED');
    advanceState(sessionId, 'CLASSIFIED');
    advanceState(sessionId, balancerResult.triggered ? 'IMBALANCE' : 'OK');
    advanceState(sessionId, 'DONE');
  }
  advanceState(sessionId, 'NEXT_CYCLE'); // always return to MONITOR
}

// ─── Public API ────────────────────────────────────────────────────────────────────

function startSession(sessionId) {
  if (sessions.has(sessionId) && getCtx(sessionId).state !== STATES.ENDED) return;

  sessions.set(sessionId, {
    state:      STATES.IDLE,
    cycleCount: 0,
    timerId:    null,
  });

  engagementService.initSession(sessionId);
  advanceState(sessionId, 'START'); // IDLE → MONITOR

  // Single timer — drives the entire agent pipeline
  const timerId = setInterval(() => runMasterCycle(sessionId), CYCLE_MS);
  getCtx(sessionId).timerId = timerId;

  console.log(`[Orchestrator] Session ${sessionId} started (cycle: ${CYCLE_MS / 1000}s)`);
}

function endSession(sessionId) {
  const ctx = getCtx(sessionId);
  if (ctx?.timerId) {
    clearInterval(ctx.timerId); // stop the master cycle
  }

  // Full cleanup — no memory leaks after session ends
  engagementService.clearSession(sessionId);
  analyticsService.clearSession(sessionId);
  participationService.clearSession(sessionId);
  clearAlertHistory(sessionId);

  advanceState(sessionId, 'SESSION_END');
  bus.publish(bus.EVENTS.SESSION_END, { sessionId });
  sessions.delete(sessionId);

  console.log(`[Orchestrator] Session ${sessionId} ended + fully cleaned.`);
}

function getState(sessionId) {
  return getCtx(sessionId)?.state || STATES.IDLE;
}

function getCycleCount(sessionId) {
  return getCtx(sessionId)?.cycleCount || 0;
}

// ─── CONFUSION_SPIKE state routing ─────────────────────────────────────────────────
// CONFUSION_SPIKE fires from engagementService (message-triggered, not cycle-triggered).
// It still needs to drive the state graph correctly.
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  const { sessionId, type } = payload;
  const ctx = getCtx(sessionId);
  if (!ctx || ctx.state === STATES.ENDED) return;

  ctx.cycleCount++;

  advanceState(sessionId, 'ALERT_FIRED');
  advanceState(sessionId, 'CLASSIFIED');

  const routeToIntervene = [
    'PARTICIPATION_IMBALANCE',
    'SILENT_PARTICIPANTS',
    'CONFUSION_SPIKE',
  ].includes(type);

  advanceState(sessionId, routeToIntervene ? 'IMBALANCE' : 'OK');
  advanceState(sessionId, 'DONE');
  advanceState(sessionId, 'NEXT_CYCLE');
});

module.exports = { startSession, endSession, getState, getCycleCount, STATES, transition };
