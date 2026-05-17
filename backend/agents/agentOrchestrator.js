// agentOrchestrator.js — LangGraph-style state machine coordinating all agents
// States: IDLE → MONITOR → CLASSIFY → BALANCE → INTERVENE → LOG → MONITOR (loop)
const monitorAgent = require('./monitorAgent');
const balancerAgent = require('./balancerAgent');
const mentorAgent   = require('./mentorAgent');  // auto-wires via bus on require
const participationService = require('../services/participationService');
const analyticsService     = require('../services/analyticsService');
const bus = require('../services/eventBus');

const STATE = { IDLE: 'IDLE', RUNNING: 'RUNNING', ENDED: 'ENDED' };
const sessions = new Map();

function startSession(sessionId) {
  if (sessions.get(sessionId) === STATE.RUNNING) return;
  sessions.set(sessionId, STATE.RUNNING);
  analyticsService.initSession(sessionId);
  monitorAgent.start(sessionId);
  balancerAgent.start(sessionId);
  console.log(`[Orchestrator] Session ${sessionId} → RUNNING`);
}

function endSession(sessionId) {
  monitorAgent.stop(sessionId);
  balancerAgent.stop(sessionId);
  sessions.set(sessionId, STATE.ENDED);
  bus.publish(bus.EVENTS.SESSION_END, { sessionId });
  console.log(`[Orchestrator] Session ${sessionId} → ENDED`);
  // report is available via analyticsService.getSessionReport(sessionId)
}

function getState(sessionId) {
  return sessions.get(sessionId) || STATE.IDLE;
}

module.exports = { startSession, endSession, getState, STATE };
