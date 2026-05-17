// agentOrchestrator.js — explicit LangGraph-style session state machine
//
// State graph:
//   IDLE ──START──▶ MONITOR ──ALERT_FIRED──▶ CLASSIFY ──CLASSIFIED──▶ BALANCE
//                    ▲                                                    │
//                    │                              ┌─ IMBALANCE ──▶ INTERVENE
//                    │                              └─ OK ──────────▶ LOG
//                    └────────────── NEXT_CYCLE ◀───────────────────┘
//                                   SESSION_END ──▶ ENDED

const monitorAgent         = require('./monitorAgent');
const balancerAgent        = require('./balancerAgent');
const mentorAgent          = require('./mentorAgent');       // auto-wires ENGAGEMENT_ALERT subscriber
const participationService = require('../services/participationService');
const analyticsService     = require('../services/analyticsService');
const engagementService    = require('../services/engagementService'); // Phase 3B
const bus                  = require('../services/eventBus');

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
  IDLE:      { START:        STATES.MONITOR   },
  MONITOR:   { ALERT_FIRED:  STATES.CLASSIFY,
               TICK:         STATES.MONITOR   },
  CLASSIFY:  { CLASSIFIED:   STATES.BALANCE   },
  BALANCE:   { IMBALANCE:    STATES.INTERVENE,
               OK:           STATES.LOG       },
  INTERVENE: { DONE:         STATES.LOG       },
  LOG:       { NEXT_CYCLE:   STATES.MONITOR,
               SESSION_END:  STATES.ENDED     },
  ENDED:     {},
};

function transition(current, event) {
  return TRANSITIONS[current]?.[event] || current;
}

// ─── Per-session context ─────────────────────────────────────────────────────────────
// Map<sessionId, { state, cycleCount, lastAlertType }>
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

// ─── Public API ────────────────────────────────────────────────────────────────────

function startSession(sessionId) {
  if (sessions.has(sessionId) && getCtx(sessionId).state === STATES.MONITOR) return;

  sessions.set(sessionId, { state: STATES.IDLE, cycleCount: 0, lastAlertType: null });

  // Phase 3B: initialise engagementService per-session state (confusion cooldown)
  engagementService.initSession(sessionId);

  advanceState(sessionId, 'START'); // IDLE → MONITOR
  monitorAgent.start(sessionId);
  balancerAgent.start(sessionId);

  console.log(`[Orchestrator] Session started: ${sessionId}`);
}

function endSession(sessionId) {
  monitorAgent.stop(sessionId);
  balancerAgent.stop(sessionId);

  // Phase 3B: clean up engagementService state
  engagementService.clearSession(sessionId);
  analyticsService.clearSession(sessionId);
  participationService.clearSession(sessionId);

  advanceState(sessionId, 'SESSION_END');
  bus.publish(bus.EVENTS.SESSION_END, { sessionId });

  // Remove session context to free memory
  sessions.delete(sessionId);

  console.log(`[Orchestrator] Session ended + cleaned: ${sessionId}`);
}

function getState(sessionId) {
  return getCtx(sessionId)?.state || STATES.IDLE;
}

// ─── Alert → state machine transitions ─────────────────────────────────────────────
// Each alert drives the graph: MONITOR → CLASSIFY → BALANCE → INTERVENE/LOG → MONITOR

bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  const { sessionId, type } = payload;
  const ctx = getCtx(sessionId);
  if (!ctx || ctx.state === STATES.ENDED) return;

  ctx.lastAlertType = type;
  ctx.cycleCount   += 1;

  advanceState(sessionId, 'ALERT_FIRED');  // MONITOR → CLASSIFY
  advanceState(sessionId, 'CLASSIFIED');   // CLASSIFY → BALANCE

  const isImbalance = [
    'PARTICIPATION_IMBALANCE',
    'SILENT_PARTICIPANTS',
    'CONFUSION_SPIKE',         // confusion spikes also route through INTERVENE
  ].includes(type);

  advanceState(sessionId, isImbalance ? 'IMBALANCE' : 'OK');
  advanceState(sessionId, 'DONE');         // INTERVENE → LOG (if applicable)
  advanceState(sessionId, 'NEXT_CYCLE');   // LOG → MONITOR
});

module.exports = { startSession, endSession, getState, STATES, transition };
