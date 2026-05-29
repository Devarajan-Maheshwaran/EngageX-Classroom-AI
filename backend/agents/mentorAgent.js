// mentorAgent.js — attaches actionable suggestions to every engagement alert
//
// Tiered suggestion strategy (Phase 3B):
//   Tier 1 — Groq REST API
//             Used when GROQ_API_KEY env var is set.
//             Generates context-aware, natural-language suggestions.
//   Tier 2 — Curated static suggestions (always fast, always works)
//             Randomly selected from a per-alert-type pool.
//             Each pool has 5 varied, high-quality suggestions.
//
// The mentor auto-wires itself by subscribing to ENGAGEMENT_ALERT on require.
// It mutates payload.suggestion BEFORE the alert reaches server.js’s bus subscriber
// (which emits to the socket room), so the suggestion is always present in the
// engagement:alert event the frontend receives.

const bus              = require('../services/eventBus');
const analyticsService = require('../services/analyticsService');

// ─── Static suggestion pools ─────────────────────────────────────────────────────
// 5 suggestions per type — varied in approach so repeated alerts don’t feel stale.
const STATIC = {
  SILENT_PARTICIPANTS: [
    'Drop a direct question: “Type one word describing what you just heard.”',
    'Run a quick 30-second anonymous poll — re-anchor silent participants.',
    'Try think-pair-share: ask everyone to type their current understanding.',
    'Call a 2-minute break — prolonged silence often signals cognitive overload.',
    'Ask participants to rate their understanding 1–5 in chat right now.',
  ],
  PARTICIPATION_IMBALANCE: [
    'Gently direct: “[quieter participant], what’s your take on this?”',
    'Switch to breakout rooms for 5 min — quieter voices open up in smaller groups.',
    'Use anonymous mode: “Type your answer, I’ll read patterns, not names.”',
    'Pose a yes/no question — ask everyone to reply in chat simultaneously.',
    'Pause the dominant speaker and explicitly invite others: “Let’s hear from the rest.”',
  ],
  CONFUSION_SPIKE: [
    'Pause and re-explain the last concept with a concrete real-world analogy.',
    'Live-demonstrate or sketch a minimal example — visuals reset mental models faster.',
    'Ask the room: “Scale of 1–5, how clear is this right now? Reply in chat.”',
    'Backtrack one step — spikes often mean the prior concept wasn’t fully absorbed.',
    'Break the concept into smaller chunks and check in after each one.',
  ],
  ENGAGEMENT_DROP: [
    'Introduce a quick interactive element: a poll, a question, or a live challenge.',
    'Acknowledge the energy dip openly: “Let’s take a quick stretch break.”',
    'Change the pace — switch from lecture to a discussion or hands-on activity.',
    'Share a surprising fact or short story to re-spark curiosity.',
    'Ask participants to predict what comes next before revealing it.',
  ],
  DEFAULT: [
    'Check in with the room: ask how everyone is following along.',
    'Pause and invite open questions before continuing.',
    'Consider summarising the last 5 minutes in 2 sentences.',
  ],
};

// ─── Groq REST API (Tier 1) ──────────────────────────────────────────

async function fetchGroqSuggestion(alertType, alertMessage) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  // Clean alert type for readability in prompt
  const typeLabel = alertType.replace(/_/g, ' ').toLowerCase();

  const prompt = [
    '[INST]',
    'You are an expert meeting facilitator and engagement coach.',
    `A real-time alert just fired during a live session: "${typeLabel}"`,
    `Alert details: "${alertMessage}"`,
    'Give the host ONE specific, immediately actionable suggestion in under 30 words.',
    'Be direct. No preamble. No label. Just the suggestion.',
    '[/INST]',
  ].join(' ');

  try {
    const res = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama3-8b-8192',
          messages: [
            { role: 'system', content: 'You are an expert meeting facilitator and engagement coach.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 60,
          temperature: 0.65,
        }),
        signal: AbortSignal.timeout(5000), // 5s hard timeout — never block an alert
      }
    );

    if (!res.ok) {
      console.warn(`[MentorAgent] Groq API returned ${res.status} — falling back to static.`);
      return null;
    }

    const data  = await res.json();
    const clean = data?.choices?.[0]?.message?.content?.trim() || '';
    return clean && clean.length > 10 ? clean : null;
  } catch (err) {
    // Timeout, network error, JSON parse error — all fall through silently
    console.warn('[MentorAgent] Groq call failed:', err.message, '— using static fallback.');
    return null;
  }
}

// ─── Static fallback (Tier 2) ────────────────────────────────────────────────────────────

function getStaticSuggestion(type) {
  const pool = STATIC[type] || STATIC.DEFAULT;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Auto-wire: subscribe to ENGAGEMENT_ALERT ────────────────────────────────────────
// Runs BEFORE server.js’s bus subscriber (socket emit) because bus is FIFO.
// Mutates payload.suggestion in place — always present by the time frontend receives it.
// Also marks whether suggestion was AI-generated (used in AlertFeed Phase 5A badge).

bus.subscribe(bus.EVENTS.ENGAGEMENT_ALERT, async (payload) => {
  const aiSuggestion = await fetchGroqSuggestion(payload.type, payload.message);

  payload.suggestion    = aiSuggestion || getStaticSuggestion(payload.type);
  payload.suggestionAI  = Boolean(aiSuggestion); // true = Groq-generated, false = static

  console.log(
    `[MentorAgent] ${payload.type} → [${payload.suggestionAI ? 'AI' : 'static'}] "${payload.suggestion.slice(0, 70)}..."`
  );
});

module.exports = { getStaticSuggestion, fetchGroqSuggestion };
