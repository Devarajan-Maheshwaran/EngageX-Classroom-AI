// classifierService.js — zero-shot engagement intent classifier
// Model: Xenova/nli-deberta-v3-small (~85MB, runs locally, no API key)
// Labels: confused | frustrated | excited | engaged
// Falls back gracefully if model isn't loaded yet

let classifier = null;
let loading = false;

const LABELS = ['confused', 'frustrated', 'excited', 'engaged'];

async function loadModel() {
  if (classifier || loading) return;
  loading = true;
  try {
    const { pipeline } = await import('@xenova/transformers');
    console.log('[Classifier] Loading nli-deberta-v3-small (~85MB)...');
    classifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small');
    console.log('[Classifier] Model ready.');
  } catch (err) {
    console.error('[Classifier] Failed to load model:', err.message);
  } finally {
    loading = false;
  }
}

/**
 * classifyEngagement(text)
 * → { label: 'confused'|'frustrated'|'excited'|'engaged', score: 0-1, all: {...} }
 * Returns null if model not ready yet (non-blocking fallback).
 */
async function classifyEngagement(text) {
  if (!classifier) {
    // Model still loading — return a lightweight heuristic fallback
    const lower = text.toLowerCase();
    if (/confus|don.?t understand|lost|unclear|what do you mean/i.test(lower)) return { label: 'confused',   score: 0.85, all: {} };
    if (/frustrat|annoying|stuck|can.?t|ugh|why/i.test(lower))               return { label: 'frustrated', score: 0.80, all: {} };
    if (/amazing|love|great|excited|wow|nice/i.test(lower))                  return { label: 'excited',    score: 0.80, all: {} };
    return { label: 'engaged', score: 0.70, all: {} };
  }
  const result = await classifier(text, LABELS, { multi_label: false });
  const topIdx = result.scores.indexOf(Math.max(...result.scores));
  return {
    label: result.labels[topIdx],
    score: parseFloat(result.scores[topIdx].toFixed(4)),
    all:   Object.fromEntries(result.labels.map((l, i) => [l, parseFloat(result.scores[i].toFixed(4))])),
  };
}

module.exports = { classifyEngagement, loadModel, LABELS };
