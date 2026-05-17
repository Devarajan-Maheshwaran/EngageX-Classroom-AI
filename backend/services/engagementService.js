// engagementService.js — room-level engagement intelligence
// Phase 3B: confusion spike detection using the analyticsService sliding window.
//
// A "confusion spike" is defined as:
//   ≥ CONFUSION_MIN_HITS messages in the last CONFUSION_WINDOW_SIZE messages
//   where intentLabel is 'confused' or 'frustrated',
//   OR where sentiment.label is 'NEGATIVE' and score > NEGATIVE_SCORE_THRESHOLD.
//
// Cooldown prevents the same session from firing back-to-back spikes within
// CONFUSION_COOLDOWN_MINS minutes — avoids alert fatigue.

const bus              = require('./eventBus');
const analyticsService = require('./analyticsService');

// ─── Config ─────────────────────────────────────────────────────────────────
// All thresholds read from env with safe numeric defaults.
const WINDOW_SIZE      = parseInt(process.env.CONFUSION_WINDOW_SIZE   || '10',  10);
const MIN_HITS         = parseInt(process.env.CONFUSION_MIN_HITS       || '3',   10);
const COOLDOWN_MS      = parseInt(process.env.CONFUSION_COOLDOWN_MINS  || '2',   10) * 60 * 1000;
const NEG_THRESHOLD    = parseFloat(process.env.CONFUSION_NEG_THRESHOLD || '0.72');

// ─── Per-session state ──────────────────────────────────────────────────────────
// Map<sessionId, { lastSpikeAt: number }>
const sessionState = new Map();

function initSession(sessionId) {
  sessionState.set(sessionId, { lastSpikeAt: 0 });
}

function clearSession(sessionId) {
  sessionState.delete(sessionId);
}

/**
 * checkForConfusionSpike(sessionId)
 *
 * Evaluates the sliding window from analyticsService.
 * Fires an ENGAGEMENT_ALERT of type CONFUSION_SPIKE if conditions are met.
 * Respects cooldown — will not fire again within COOLDOWN_MS.
 *
 * Called after every student:message (from server.js).
 *
 * @param {string} sessionId
 * @returns {boolean} true if a spike was detected and fired
 */
function checkForConfusionSpike(sessionId) {
  const state = sessionState.get(sessionId);
  if (!state) return false;

  // Respect cooldown
  const now = Date.now();
  if (now - state.lastSpikeAt < COOLDOWN_MS) return false;

  const window = analyticsService.getRecentWindow(sessionId, WINDOW_SIZE);
  if (window.length < MIN_HITS) return false; // not enough data yet

  let hits = 0;
  window.forEach(({ intentLabel, label, score }) => {
    const isIntentConfused  = intentLabel === 'confused' || intentLabel === 'frustrated';
    const isStrongNegative  = label === 'NEGATIVE' && score > NEG_THRESHOLD;
    if (isIntentConfused || isStrongNegative) hits++;
  });

  if (hits < MIN_HITS) return false;

  // Spike detected — update cooldown timestamp before publishing
  // (prevents re-entry if publish triggers synchronous subscribers)
  state.lastSpikeAt = now;

  const hitPct = Math.round((hits / window.length) * 100);
  bus.publish(bus.EVENTS.ENGAGEMENT_ALERT, {
    sessionId,
    type:    'CONFUSION_SPIKE',
    message: `Confusion spike: ${hits}/${window.length} recent messages show confusion or frustration (${hitPct}%).`,
    // suggestion attached by mentorAgent subscriber before alert reaches socket layer
  });

  console.log(`[EngagementService] CONFUSION_SPIKE fired for ${sessionId} (${hits}/${window.length} hits)`);
  return true;
}

/**
 * getRoomMood(sessionId)
 *
 * Derives a simple 3-state room mood from the most recent window.
 * Used by the host dashboard SessionHeader mood pill.
 * Returns: 'positive' | 'neutral' | 'confused'
 *
 * Logic:
 *   - If > 40% of recent window is confused/frustrated/bored → 'confused'
 *   - If > 40% is excited/engaged and sentiment POSITIVE          → 'positive'
 *   - Otherwise                                                    → 'neutral'
 */
function getRoomMood(sessionId) {
  const window = analyticsService.getRecentWindow(sessionId, 10);
  if (!window.length) return 'neutral';

  let negCount = 0;
  let posCount = 0;

  window.forEach(({ intentLabel, label }) => {
    if (intentLabel === 'confused' || intentLabel === 'frustrated' || intentLabel === 'bored') {
      negCount++;
    } else if (intentLabel === 'excited' || intentLabel === 'engaged') {
      if (label === 'POSITIVE') posCount++;
    }
  });

  const total = window.length;
  if (negCount / total > 0.4) return 'confused';
  if (posCount / total > 0.4) return 'positive';
  return 'neutral';
}

module.exports = { initSession, clearSession, checkForConfusionSpike, getRoomMood };
