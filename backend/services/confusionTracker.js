// confusionTracker.js — tracks consecutive 'confused'/'frustrated' signals per session
// Fires CONFUSION_SPIKE alert when threshold is hit
const bus              = require('./eventBus');
const analyticsService = require('./analyticsService');

// Map<sessionId, { count, lastTopic, window: [] }>
const state = new Map();

const SPIKE_THRESHOLD = 3;          // 3+ confused/frustrated in a rolling window
const WINDOW_MS       = 5 * 60 * 1000; // within 5 minutes

function init(sessionId) {
  state.set(sessionId, { count: 0, window: [] });
}

/**
 * record(sessionId, label, text)
 * Call after every classifyEngagement result.
 * Returns true if a spike was just fired.
 */
function record(sessionId, label, text) {
  if (!state.has(sessionId)) init(sessionId);
  const s   = state.get(sessionId);
  const now = Date.now();

  // Slide window
  s.window = s.window.filter((e) => now - e.ts < WINDOW_MS);

  if (label === 'confused' || label === 'frustrated') {
    s.window.push({ ts: now, text });
  } else {
    // Positive signal resets the spike counter partially
    s.window = s.window.filter((e) => now - e.ts < 60000); // keep last 1 min only
  }

  if (s.window.length >= SPIKE_THRESHOLD) {
    // Fire spike alert and reset window to avoid repeated firing
    const preview = s.window.map((e) => `"${e.text.slice(0, 40)}"`).join(', ');
    const msg = `Confusion spike detected — ${s.window.length} participants signaled confusion recently: ${preview}`;
    const payload = {
      sessionId,
      type:       'CONFUSION_SPIKE',
      count:      s.window.length,
      message:    msg,
    };
    bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, payload);
    analyticsService.logAlert(sessionId, 'CONFUSION_SPIKE', msg);
    // Reset window after firing
    s.window = [];
    return true;
  }
  return false;
}

function clear(sessionId) {
  state.delete(sessionId);
}

module.exports = { init, record, clear };
