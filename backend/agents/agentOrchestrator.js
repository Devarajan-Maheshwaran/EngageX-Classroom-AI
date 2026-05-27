const { StateGraph, END, Annotation } = require('@langchain/langgraph');

const monitorAgent         = require('./monitorAgent');
const balancerAgent        = require('./balancerAgent');
require('./mentorAgent');
const participationService = require('../services/participationService');
const analyticsService     = require('../services/analyticsService');
const engagementService    = require('../services/engagementService');
const bus                  = require('../services/eventBus');

const CYCLE_MS = (parseInt(process.env.AGENT_CYCLE_SECS, 10) || 60) * 1000;
const BALANCER_EVERY_N = parseInt(process.env.BALANCER_EVERY_N, 10) || 2;
const ALERT_COOLDOWN_MS = (parseInt(process.env.SILENT_THRESHOLD_MINS, 10) || 3) * 60 * 1000;

const alertLastFired = new Map();
const sessions = new Map();

const stateSchema = Annotation.Root({
  sessionId: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => '' }),
  cycleCount: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => 0 }),
  silentCount: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => 0 }),
  silentNames: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => [] }),
  alertFired: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => false }),
  alertType: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => null }),
  balancerTriggered: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => false }),
  participationRatio: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => 1 }),
  ended: Annotation({ reducer: (_oldValue, newValue) => newValue, default: () => false }),
});

function canFire(sessionId, alertType) {
  const key = `${sessionId}:${alertType}`;
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

async function monitorNode(state) {
  const result = monitorAgent.runCycle(state.sessionId);
  return {
    silentCount: result.silentCount,
    silentNames: result.silentNames,
    alertFired: result.silentCount > 0 && canFire(state.sessionId, 'SILENT_PARTICIPANTS'),
    alertType: result.silentCount > 0 ? 'SILENT_PARTICIPANTS' : null,
    cycleCount: state.cycleCount + 1,
  };
}

async function classifyNode(state) {
  if (state.alertFired && state.alertType) markFired(state.sessionId, state.alertType);
  return {};
}

async function balanceNode(state) {
  if (state.cycleCount % BALANCER_EVERY_N !== 0) return { balancerTriggered: false };
  const result = balancerAgent.runCycle(state.sessionId);
  const canFireBalance = result.triggered && canFire(state.sessionId, 'PARTICIPATION_IMBALANCE');
  if (canFireBalance) markFired(state.sessionId, 'PARTICIPATION_IMBALANCE');
  return { balancerTriggered: canFireBalance, participationRatio: result.ratio };
}

async function interveneNode(state) {
  const cycleData = {
    cycleNum: state.cycleCount,
    silentCount: state.silentCount,
    silentNames: state.silentNames,
    participationRatio: state.participationRatio,
    balancerTriggered: state.balancerTriggered,
  };
  analyticsService.logCycle(state.sessionId, cycleData);
  bus.publish(bus.EVENTS.CYCLE_LOG, { sessionId: state.sessionId, ...cycleData });
  return {};
}

async function logNode() {
  return { alertFired: false, alertType: null, balancerTriggered: false };
}

const compiledGraph = new StateGraph(stateSchema)
  .addNode('monitor', monitorNode)
  .addNode('classify', classifyNode)
  .addNode('balance', balanceNode)
  .addNode('intervene', interveneNode)
  .addNode('log', logNode)
  .addEdge('__start__', 'monitor')
  .addEdge('monitor', 'classify')
  .addEdge('classify', 'balance')
  .addConditionalEdges('balance', (state) => (state.balancerTriggered ? 'intervene' : 'log'), {
    intervene: 'intervene',
    log: 'log',
  })
  .addEdge('intervene', 'log')
  .addEdge('log', END)
  .compile();

function initialState(sessionId) {
  return {
    sessionId,
    cycleCount: 0,
    silentCount: 0,
    silentNames: [],
    alertFired: false,
    alertType: null,
    balancerTriggered: false,
    participationRatio: 1,
    ended: false,
  };
}

async function invokeCycle(sessionId) {
  const ctx = sessions.get(sessionId);
  if (!ctx || ctx.state.ended) return;
  try {
    ctx.state = await compiledGraph.invoke(ctx.state);
  } catch (err) {
    console.error(`[Orchestrator] Cycle failed for ${sessionId}:`, err.message);
  }
}

function startSession(sessionId) {
  const existing = sessions.get(sessionId);
  if (existing && !existing.state.ended) return;

  sessions.set(sessionId, { state: initialState(sessionId), timerId: null });
  engagementService.initSession(sessionId);

  const timerId = setInterval(() => invokeCycle(sessionId), CYCLE_MS);
  sessions.get(sessionId).timerId = timerId;

  console.log(`[Orchestrator] Session ${sessionId} started (LangGraph cycle: ${CYCLE_MS / 1000}s)`);
}

function endSession(sessionId) {
  const ctx = sessions.get(sessionId);
  if (ctx?.timerId) clearInterval(ctx.timerId);
  if (ctx) ctx.state = { ...ctx.state, ended: true };

  engagementService.clearSession(sessionId);
  analyticsService.clearSession(sessionId);
  participationService.clearSession(sessionId);
  clearAlertHistory(sessionId);
  bus.publish(bus.EVENTS.SESSION_END, { sessionId });

  console.log(`[Orchestrator] Session ${sessionId} ended.`);
}

function getState(sessionId) {
  return sessions.get(sessionId)?.state || initialState(sessionId);
}

function getCycleCount(sessionId) {
  return sessions.get(sessionId)?.state?.cycleCount || 0;
}

bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, async (payload) => {
  if (payload.type !== 'CONFUSION_SPIKE') return;
  const ctx = sessions.get(payload.sessionId);
  if (!ctx || ctx.state.ended) return;
  ctx.state = {
    ...ctx.state,
    alertFired: true,
    alertType: 'CONFUSION_SPIKE',
  };
  await invokeCycle(payload.sessionId);
});

module.exports = { startSession, endSession, getState, getCycleCount };
