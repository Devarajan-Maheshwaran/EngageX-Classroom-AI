// eventBus.js — central pub/sub hub for all in-session events
const { EventEmitter } = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  publish(event, payload) {
    this.emit(event, payload);
  }

  subscribe(event, handler) {
    this.on(event, handler);
  }

  unsubscribe(event, handler) {
    this.off(event, handler);
  }
}

// Singleton
const bus = new EventBus();

// Named events contract
bus.EVENTS = {
  STUDENT_MESSAGE: 'student:message',
  STUDENT_JOIN:    'student:join',
  STUDENT_LEAVE:   'student:leave',
  ENGAGEMENT_ALERT:'engagement:alert',
  SESSION_END:     'session:end',
};

module.exports = bus;
