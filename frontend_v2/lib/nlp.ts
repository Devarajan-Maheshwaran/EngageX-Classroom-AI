/**
 * lib/nlp.ts — Phase 6
 *
 * Browser-side NLP using Transformers.js.
 * Runs entirely in the student's browser → zero API cost, better privacy.
 *
 * Models chosen:
 * - Sentiment: Xenova/distilbert-base-uncased-finetuned-sst-2-english
 * - Intent (zero-shot): Xenova/distilbart-mnli-12-3
 */

import { pipeline, env } from '@xenova/transformers';

// Reduce console noise and force browser-friendly settings
env.allowLocalModels = false;
env.useBrowserCache = true;

type SentimentLabel = 'POSITIVE' | 'NEGATIVE';

export interface NLPResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number;
  intent: string;
  intent_scores: Record<string, number>;
  engagement_score: number;
}

const INTENT_LABELS = [
  'understanding',
  'confusion',
  'question',
  'frustration',
  'agreement',
  'disengagement',
] as const;

let sentimentPipePromise: Promise<any> | null = null;
let intentPipePromise: Promise<any> | null = null;

async function getSentimentPipe() {
  if (!sentimentPipePromise) {
    sentimentPipePromise = pipeline(
      'sentiment-analysis',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
    );
  }
  return sentimentPipePromise;
}

async function getIntentPipe() {
  if (!intentPipePromise) {
    intentPipePromise = pipeline(
      'zero-shot-classification',
      'Xenova/distilbart-mnli-12-3'
    );
  }
  return intentPipePromise;
}

function normalizeSentiment(label: string, score: number): NLPResult['sentiment'] {
  const upper = label.toUpperCase() as SentimentLabel;
  if (score < 0.6) return 'neutral';
  return upper === 'POSITIVE' ? 'positive' : 'negative';
}

function scoresToMap(labels: string[], scores: number[]): Record<string, number> {
  return labels.reduce<Record<string, number>>((acc, label, idx) => {
    acc[label] = Number((scores[idx] ?? 0).toFixed(4));
    return acc;
  }, {});
}

function computeEngagementScore(params: {
  sentiment: NLPResult['sentiment'];
  sentimentScore: number;
  intent: string;
  isDeleted: boolean;
  editCount: number;
  silenceDurationMs: number;
  participationFreq: number;
}): number {
  let score = 60;

  if (params.sentiment === 'positive') score += 10 * params.sentimentScore;
  if (params.sentiment === 'negative') score -= 12 * params.sentimentScore;

  switch (params.intent) {
    case 'understanding': score += 18; break;
    case 'agreement':     score += 10; break;
    case 'question':      score += 5;  break;
    case 'confusion':     score -= 10; break;
    case 'frustration':   score -= 18; break;
    case 'disengagement': score -= 22; break;
    default: break;
  }

  if (params.isDeleted) score -= 8;
  if (params.editCount >= 6) score -= 6;
  else if (params.editCount >= 3) score -= 3;

  if (params.silenceDurationMs > 8 * 60 * 1000) score -= 10;
  else if (params.silenceDurationMs > 3 * 60 * 1000) score -= 5;

  if (params.participationFreq >= 5) score += 8;
  else if (params.participationFreq === 0) score -= 4;

  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

export async function analyzeText(text: string, behavior?: {
  isDeleted?: boolean;
  editCount?: number;
  silenceDurationMs?: number;
  participationFreq?: number;
}): Promise<NLPResult> {
  const clean = text.trim();
  if (!clean) {
    return {
      sentiment: 'neutral',
      sentiment_score: 0,
      intent: 'disengagement',
      intent_scores: { disengagement: 1 },
      engagement_score: 20,
    };
  }

  const [sentimentPipe, intentPipe] = await Promise.all([
    getSentimentPipe(),
    getIntentPipe(),
  ]);

  const sentimentOut = await sentimentPipe(clean);
  const sentimentTop = Array.isArray(sentimentOut) ? sentimentOut[0] : sentimentOut;
  const sentiment = normalizeSentiment(sentimentTop.label, sentimentTop.score);
  const sentimentScore = Number((sentimentTop.score ?? 0).toFixed(4));

  const intentOut = await intentPipe(clean, [...INTENT_LABELS], {
    hypothesis_template: 'This student message expresses {}.',
    multi_label: true,
  });

  const labels = intentOut.labels as string[];
  const scores = intentOut.scores as number[];
  const intentScores = scoresToMap(labels, scores);
  const topIntent = labels[0] ?? 'disengagement';

  const engagement = computeEngagementScore({
    sentiment,
    sentimentScore,
    intent: topIntent,
    isDeleted: behavior?.isDeleted ?? false,
    editCount: behavior?.editCount ?? 0,
    silenceDurationMs: behavior?.silenceDurationMs ?? 0,
    participationFreq: behavior?.participationFreq ?? 0,
  });

  return {
    sentiment,
    sentiment_score: sentimentScore,
    intent: topIntent,
    intent_scores: intentScores,
    engagement_score: engagement,
  };
}

export async function warmupNLP(): Promise<void> {
  await Promise.all([getSentimentPipe(), getIntentPipe()]);
}
