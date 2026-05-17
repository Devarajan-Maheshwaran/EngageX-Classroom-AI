// sentimentService.js — local sentiment via Transformers.js (no API key needed)
// Phase 4B: graceful model failure — if inference throws, returns safe fallback
// so the session pipeline never breaks even on resource-constrained Railway cold starts.

let classifier  = null;
let loadPromise = null;

async function loadModel() {
  if (classifier) return;
  if (loadPromise) return loadPromise; // prevent concurrent double-load

  loadPromise = (async () => {
    const { pipeline } = await import('@xenova/transformers');
    console.log('[SentimentService] Loading distilbert-sst-2 (~67MB, first run only)...');
    classifier = await pipeline(
      'sentiment-analysis',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
    );
    console.log('[SentimentService] Model ready.');
  })();

  return loadPromise;
}

/**
 * analyzeSentiment(text)
 * @param {string} text
 * @returns {Promise<{ label: 'POSITIVE'|'NEGATIVE', score: number }>}
 *
 * Never throws — returns safe neutral fallback on any error.
 */
async function analyzeSentiment(text) {
  if (!text || text.trim().length === 0) {
    return { label: 'POSITIVE', score: 0.5 };
  }
  try {
    await loadModel();
    const [result] = await classifier(text.trim(), { topk: 1 });
    return { label: result.label, score: parseFloat(result.score.toFixed(4)) };
  } catch (err) {
    console.error('[SentimentService] Inference error:', err.message);
    return { label: 'POSITIVE', score: 0.5 }; // safe neutral fallback
  }
}

module.exports = { analyzeSentiment, loadModel };
