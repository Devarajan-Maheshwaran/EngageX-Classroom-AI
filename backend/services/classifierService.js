// classifierService.js — zero-shot intent classification via Transformers.js
// Model: Xenova/nli-deberta-v3-small (~85MB, downloads once, cached on disk)
// Labels map to the 5 real engagement states we care about for a meeting

let classifier  = null;
let loadPromise = null;

// Engagement states — ordered with most common first for better NLI recall
const CANDIDATE_LABELS = ['confused', 'engaged', 'excited', 'frustrated', 'bored'];

async function loadModel() {
  if (classifier) return;
  if (loadPromise) return loadPromise; // prevent concurrent double-load

  loadPromise = (async () => {
    const { pipeline } = await import('@xenova/transformers');
    console.log('[ClassifierService] Loading nli-deberta-v3-small (~85MB, first run only)...');
    classifier = await pipeline(
      'zero-shot-classification',
      'Xenova/nli-deberta-v3-small'
    );
    console.log('[ClassifierService] Model ready.');
  })();

  return loadPromise;
}

/**
 * classifyIntent(text)
 * Returns the dominant engagement intent for a single message.
 *
 * @param {string} text
 * @returns {Promise<{ label: string, score: number, allScores: Object }>}
 *
 * Edge cases:
 * - Text < 4 chars  → instant safe return, no inference
 * - Model not ready → auto-loads (loadPromise prevents double-load)
 * - Inference error → safe fallback { label: 'engaged', score: 0.5 }, never throws
 */
async function classifyIntent(text) {
  if (!text || text.trim().length < 4) {
    return { label: 'engaged', score: 0.5, allScores: {} };
  }

  try {
    await loadModel();
    const result = await classifier(text.trim(), CANDIDATE_LABELS, {
      multi_label: false, // single dominant label per message
    });

    // result.labels is already sorted descending by score
    const allScores = {};
    result.labels.forEach((l, i) => {
      allScores[l] = parseFloat(result.scores[i].toFixed(4));
    });

    return {
      label: result.labels[0],
      score: parseFloat(result.scores[0].toFixed(4)),
      allScores,
    };
  } catch (err) {
    console.error('[ClassifierService] Inference error:', err.message);
    return { label: 'engaged', score: 0.5, allScores: {} };
  }
}

module.exports = { loadModel, classifyIntent, CANDIDATE_LABELS };
