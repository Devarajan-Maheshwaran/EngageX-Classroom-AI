// mentorAgent.js — generates intervention suggestions on alert events
const bus = require('../services/eventBus');
const analyticsService = require('../services/analyticsService');

// Static suggestion map (Phase 3 will replace with local LLM via HF Inference API)
const SUGGESTIONS = {
  SILENT_STUDENTS: [
    'Ask a quick open question like: "Can everyone drop a 1-word reaction to what we just covered?"',
    'Run a 60-second poll to re-anchor silent students.',
    'Try a think-pair-share: ask students to type their understanding before you continue.',
  ],
  PARTICIPATION_IMBALANCE: [
    'Call on a student by name gently: "[Name], what\'s your take on this?"',
    'Split into breakout rooms for 5 minutes — quieter students often speak more in small groups.',
    'Use anonymous response mode: "Type your answer — I won\'t show names, just aggregate."',
  ],
  CONFUSION_SPIKE: [
    'Pause and re-explain the last concept with a concrete analogy.',
    'Live code a minimal example — visual demonstration reduces confusion faster than re-reading.',
    'Share a quick diagram or whiteboard sketch to reset mental models.',
  ],
};

function getSuggestion(alertType) {
  const list = SUGGESTIONS[alertType] || ['Consider checking in with the class.'];
  return list[Math.floor(Math.random() * list.length)];
}

// Listen to all alerts and attach a suggestion
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, (payload) => {
  const suggestion = getSuggestion(payload.type);
  payload.suggestion = suggestion;
  // Re-emit enriched alert (same channel — teacher dashboard will pick this up)
  // No infinite loop risk: we mutate payload in-place, not re-publish
  console.log(`[MentorAgent] Suggestion for ${payload.type}: ${suggestion}`);
  analyticsService.logAlert(payload.sessionId, 'MENTOR_SUGGESTION', suggestion);
});

module.exports = { getSuggestion };
