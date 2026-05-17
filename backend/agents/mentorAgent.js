// mentorAgent.js — attaches actionable suggestions to every engagement alert
// Phase 3 will replace static map with HuggingFace Inference API
const bus              = require('../services/eventBus');
const analyticsService = require('../services/analyticsService');

const SUGGESTIONS = {
  SILENT_PARTICIPANTS: [
    'Ask a quick open question: "Drop a 1-word reaction to what we just covered."',
    'Run a 60-second anonymous poll to re-anchor quiet participants.',
    'Try think-pair-share: ask everyone to type their understanding before continuing.',
  ],
  PARTICIPATION_IMBALANCE: [
    'Call on a specific participant gently: "[Name], what's your take?"',
    'Switch to breakout rooms for 5 min — quieter participants open up in smaller groups.',
    'Use anonymous mode: "Type your answer — I won\'t show names."',
  ],
  CONFUSION_SPIKE: [
    'Pause and re-explain the last concept with a concrete real-world analogy.',
    'Live-code or sketch a minimal example — visual resets mental models faster.',
    'Ask the room: "On a scale of 1–5, how clear is this? Reply in chat."',
  ],
};

function getSuggestion(type) {
  const list = SUGGESTIONS[type] || ['Consider checking in with the room.'];
  return list[Math.floor(Math.random() * list.length)];
}

// Auto-wire: attaches suggestion to every alert payload before it reaches the host
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  payload.suggestion = getSuggestion(payload.type);
  analyticsService.logAlert(payload.sessionId, 'MENTOR_SUGGESTION', payload.suggestion);
});

module.exports = { getSuggestion };
