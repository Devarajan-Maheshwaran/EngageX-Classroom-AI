// eventBus.js — lightweight pub/sub for decoupled agent communication
// Phase 4A: added CYCLE_LOG event type

const subscribers = {};

const EVENTS = {
  STUDENT_JOIN:           'student:join',
  STUDENT_LEAVE:          'student:leave',
  STUDENT_MESSAGE:        'student:message',
  ENGAGEMENT_ALERT:       'engagement:alert',
  SESSION_END:            'session:end',
  CYCLE_LOG:              'cycle:log',       // Phase 4A: emitted after every master cycle
};

function subscribe(event, handler) {
  if (!subscribers[event]) subscribers[event] = [];
  subscribers[event].push(handler);
}

function publish(event, payload) {
  (subscribers[event] || []).forEach((handler) => handler(payload));
}

module.exports = { subscribe, publish, EVENTS };
