// sentimentService.js — local sentiment via Transformers.js (no API key)
let pipeline;
let classifier;

async function loadModel() {
  if (classifier) return;
  // Dynamic import because @xenova/transformers is ESM-first; we shim with require
  const { pipeline: pipelineFn } = await import('@xenova/transformers');
  pipeline = pipelineFn;
  console.log('[SentimentService] Loading distilbert-sst-2 (first run downloads ~67MB)...');
  classifier = await pipeline(
    'sentiment-analysis',
    'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
  );
  console.log('[SentimentService] Model ready.');
}

/**
 * analyzeSentiment(text) → { label: 'POSITIVE'|'NEGATIVE', score: 0-1 }
 */
async function analyzeSentiment(text) {
  await loadModel();
  const [result] = await classifier(text, { topk: 1 });
  return { label: result.label, score: parseFloat(result.score.toFixed(4)) };
}

module.exports = { analyzeSentiment, loadModel };
