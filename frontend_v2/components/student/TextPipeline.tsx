/**
 * TextPipeline.tsx — Phase 6
 *
 * Adds browser-side NLP on top of Phase 5 behavior capture.
 * For every sent or abandoned message, we compute:
 * - sentiment
 * - intent
 * - engagement_score
 * Then send the enriched signal to backend.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNLP } from '@/hooks/useNLP';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';
const ABANDON_TIMEOUT_MS = 8000;
const FREQ_WINDOW_MS = 10 * 60 * 1000;

interface TextPipelineProps {
  sessionId: string;
  studentId: string;
  onSignalSent?: (signal: TextSignalPayload) => void;
}

export interface TextSignalPayload {
  session_id:          string;
  student_id:          string;
  text:                string;
  is_deleted:          boolean;
  edit_count:          number;
  silence_duration_ms: number;
  participation_freq:  number;
  sentiment?:          string;
  sentiment_score?:    number;
  intent?:             string;
  intent_scores?:      Record<string, number>;
  engagement_score?:   number;
}

async function sendSignal(payload: TextSignalPayload): Promise<void> {
  try {
    await fetch(`${API}/api/signals/text`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[TextPipeline] send failed:', err);
  }
}

export default function TextPipeline({ sessionId, studentId, onSignalSent }: TextPipelineProps) {
  const { ready, loading, error, classify } = useNLP();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'sent'>('idle');

  const editCountRef = useRef(0);
  const lastSentAtRef = useRef<number>(Date.now());
  const msgTimestamps = useRef<number[]>([]);
  const abandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTextRef = useRef('');

  function getSilenceMs() {
    return Date.now() - lastSentAtRef.current;
  }

  function recordAndGetFreq(): number {
    const now = Date.now();
    msgTimestamps.current.push(now);
    msgTimestamps.current = msgTimestamps.current.filter((t) => now - t <= FREQ_WINDOW_MS);
    return msgTimestamps.current.length;
  }

  const enrichSignal = useCallback(async (base: TextSignalPayload): Promise<TextSignalPayload> => {
    if (!ready) return base;
    try {
      const nlp = await classify(base.text, {
        isDeleted: base.is_deleted,
        editCount: base.edit_count,
        silenceDurationMs: base.silence_duration_ms,
        participationFreq: base.participation_freq,
      });
      return {
        ...base,
        sentiment: nlp.sentiment,
        sentiment_score: nlp.sentiment_score,
        intent: nlp.intent,
        intent_scores: nlp.intent_scores,
        engagement_score: nlp.engagement_score,
      };
    } catch (err) {
      console.warn('[TextPipeline] NLP enrich failed:', err);
      return base;
    }
  }, [ready, classify]);

  const fireAbandoned = useCallback(async (partialText: string, editCount: number) => {
    if (!partialText.trim()) return;
    const base: TextSignalPayload = {
      session_id: sessionId,
      student_id: studentId,
      text: partialText,
      is_deleted: true,
      edit_count: editCount,
      silence_duration_ms: getSilenceMs(),
      participation_freq: msgTimestamps.current.length,
    };
    setStatus('analyzing');
    const payload = await enrichSignal(base);
    await sendSignal(payload);
    onSignalSent?.(payload);
    setStatus('sent');
    setTimeout(() => setStatus('idle'), 1200);
  }, [sessionId, studentId, enrichSignal, onSignalSent]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    if (prevTextRef.current.length > 0 || val.length > 1) editCountRef.current++;
    prevTextRef.current = val;
    setText(val);

    if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
    if (val.trim().length > 0) {
      abandonTimerRef.current = setTimeout(async () => {
        await fireAbandoned(val, editCountRef.current);
        setText('');
        editCountRef.current = 0;
        prevTextRef.current = '';
      }, ABANDON_TIMEOUT_MS);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    if (abandonTimerRef.current) {
      clearTimeout(abandonTimerRef.current);
      abandonTimerRef.current = null;
    }

    const base: TextSignalPayload = {
      session_id: sessionId,
      student_id: studentId,
      text: text.trim(),
      is_deleted: false,
      edit_count: editCountRef.current,
      silence_duration_ms: getSilenceMs(),
      participation_freq: recordAndGetFreq(),
    };

    setText('');
    editCountRef.current = 0;
    prevTextRef.current = '';
    lastSentAtRef.current = Date.now();

    setStatus('analyzing');
    const payload = await enrichSignal(base);
    await sendSignal(payload);
    onSignalSent?.(payload);
    setStatus('sent');
    setTimeout(() => setStatus('idle'), 1200);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  useEffect(() => {
    return () => {
      if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
    };
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-gray-400">
          {loading ? 'Loading on-device NLP models…' : ready ? 'On-device NLP active' : 'Behavior-only mode'}
        </p>
        {error && <p className="text-xs text-amber-500 truncate max-w-[180px]">{error}</p>}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or question… (Enter to send)"
            rows={2}
            maxLength={500}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
          />
          {editCountRef.current > 2 && (
            <span className="absolute bottom-2 right-3 text-xs text-gray-300">{editCountRef.current} edits</span>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || status === 'analyzing'}
          className="px-4 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors"
        >
          {status === 'analyzing' ? 'Analyzing…' : status === 'sent' ? '✓' : 'Send'}
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-1 ml-1">Shift+Enter for new line · Enter to send</p>
    </div>
  );
}
