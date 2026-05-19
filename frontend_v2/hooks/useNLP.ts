/**
 * useNLP.ts — Phase 6
 * Hook for browser-side NLP state and warmup.
 */

'use client';

import { useEffect, useState } from 'react';
import { analyzeText, warmupNLP, type NLPResult } from '@/lib/nlp';

export function useNLP() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    warmupNLP()
      .then(() => {
        if (!mounted) return;
        setReady(true);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load NLP models');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  async function classify(
    text: string,
    behavior?: {
      isDeleted?: boolean;
      editCount?: number;
      silenceDurationMs?: number;
      participationFreq?: number;
    }
  ): Promise<NLPResult> {
    return analyzeText(text, behavior);
  }

  return { ready, loading, error, classify };
}
