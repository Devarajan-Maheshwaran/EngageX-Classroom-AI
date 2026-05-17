// mentorAgent.js — attaches actionable suggestions to every engagement alert
// If HF_API_KEY is set: uses mistralai/Mistral-7B-Instruct-v0.2 via HF Inference API (free tier)
// Otherwise: falls back to curated static suggestions (always fast, always works)
const bus              = require('../services/eventBus');
const analyticsService = require('../services/analyticsService');

const STATIC = {
  SILENT_PARTICIPANTS: [
    'Ask a quick open question: "Drop a 1-word reaction to what we just covered."',
    'Run a 60-second anonymous poll to re-anchor quiet participants.',
    'Try think-pair-share: ask everyone to type their understanding before continuing.',
    'Call a short 2-minute break — silence often means cognitive overload.',
  ],
  PARTICIPATION_IMBALANCE: [
    'Call on a specific participant gently: "[Name], what\'s your take?"',
    'Switch to breakout rooms for 5 min — quieter participants open up in smaller groups.',
    'Use anonymous mode: "Type your answer — I won\'t show names, just read patterns."',
    'Pose a yes/no question and ask everyone to reply in chat simultaneously.',
  ],
  CONFUSION_SPIKE: [
    'Pause and re-explain the last concept with a concrete real-world analogy.',
    'Live-code or sketch a minimal example — visual resets mental models faster.',
    'Ask the room: "On a scale of 1–5, how clear is this? Reply in chat."',
    'Backtrack one step — confusion spikes often mean the prior concept wasn\'t solid.',
  ],
};

async function fetchHFSuggestion(alertMessage) {
  const key = process.env.HF_API_KEY;
  if (!key) return null;
  try {
    const prompt = `[INST] You are an expert teaching coach. A live classroom alert just fired:\n"${alertMessage}"\nGive the teacher ONE specific, actionable suggestion in under 30 words. Be direct. No preamble. [/INST]`;
    const res = await fetch(
      'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 60, temperature: 0.7 } }),
        signal:  AbortSignal.timeout(4000), // 4s timeout — never block an alert
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.[0]?.generated_text || '';
    // Strip the prompt echo that Mistral returns
    const clean = text.replace(prompt, '').replace(/\[\/?INST\]/g, '').trim();
    return clean.length > 10 ? clean : null;
  } catch {
    return null; // silently fall through to static
  }
}

function getStaticSuggestion(type) {
  const list = STATIC[type] || ['Consider checking in with the room to gauge understanding.'];
  return list[Math.floor(Math.random() * list.length)];
}

// Auto-wire: intercept every alert, attach suggestion before it reaches the socket layer
bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, async (payload) => {
  // Try HF first (async, non-blocking — static is the guaranteed fallback)
  const hfSuggestion = await fetchHFSuggestion(payload.message);
  payload.suggestion = hfSuggestion || getStaticSuggestion(payload.type);
  analyticsService.logAlert(payload.sessionId, 'MENTOR_SUGGESTION', payload.suggestion);
  console.log(`[MentorAgent] ${payload.type} → "${payload.suggestion.slice(0, 60)}..."`);
});

module.exports = { getStaticSuggestion };
