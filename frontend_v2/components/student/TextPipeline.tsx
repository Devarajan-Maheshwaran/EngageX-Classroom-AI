/**
 * TextPipeline.tsx — Phase 5
 *
 * Captures ALL student text interactions:
 *   - Sent messages (text + metadata)
 *   - DELETED messages (typed but never sent — highest-value signal)
 *   - Behavioral metrics: edit count, silence duration, participation frequency
 *
 * Phase 6 adds Transformers.js NLP on top; this phase sends raw signals only.
 *
 * Usage:
 *   <TextPipeline sessionId={...} studentId={...} />
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

// If user types but doesn't send within this window → abandoned signal
const ABANDON_TIMEOUT_MS = 8000;
// Participation frequency sliding window
const FREQ_WINDOW_MS = 10 * 60 * 1000;

interface TextPipelineProps {
  sessionId:    string;
  studentId:    string;
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
  // NLP fields — filled by Phase 6
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
  const [text,   setText]   = useState('');
  const [status, setStatus] = useState<'idle' | 'sent'>('idle');

  const editCountRef      = useRef(0);
  const lastSentAtRef     = useRef<number>(Date.now());
  const msgTimestamps     = useRef<number[]>([]);
  const abandonTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTextRef       = useRef('');

  function getSilenceMs()  { return Date.now() - lastSentAtRef.current; }

  function recordAndGetFreq(): number {
    const now = Date.now();
    msgTimestamps.current.push(now);
    msgTimestamps.current = msgTimestamps.current.filter(t => now - t <= FREQ_WINDOW_MS);
    return msgTimestamps.current.length;
  }

  const fireAbandoned = useCallback((partialText: string, editCount: number) => {
    if (!partialText.trim()) return;
    const payload: TextSignalPayload = {
      session_id: sessionId, student_id: studentId,
      text: partialText, is_deleted: true,
      edit_count: editCount,
      silence_duration_ms: getSilenceMs(),
      participation_freq:  msgTimestamps.current.length,
    };
    sendSignal(payload);
    onSignalSent?.(payload);
    console.log('[TextPipeline] deleted-msg signal:', partialText.slice(0, 40));
  }, [sessionId, studentId, onSignalSent]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    if (prevTextRef.current.length > 0 || val.length > 1) editCountRef.current++;
    prevTextRef.current = val;
    setText(val);

    if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
    if (val.trim().length > 0) {
      abandonTimerRef.current = setTimeout(() => {
        fireAbandoned(val, editCountRef.current);
        setText('');
        editCountRef.current = 0;
        prevTextRef.current  = '';
      }, ABANDON_TIMEOUT_MS);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    if (abandonTimerRef.current) { clearTimeout(abandonTimerRef.current); abandonTimerRef.current = null; }

    const payload: TextSignalPayload = {
      session_id: sessionId, student_id: studentId,
      text: text.trim(), is_deleted: false,
      edit_count:          editCountRef.current,
      silence_duration_ms: getSilenceMs(),
      participation_freq:  recordAndGetFreq(),
    };

    setText(''); editCountRef.current = 0; prevTextRef.current = '';
    lastSentAtRef.current = Date.now();

    await sendSignal(payload);
    onSignalSent?.(payload);
    setStatus('sent');
    setTimeout(() => setStatus('idle'), 1500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  useEffect(() => () => { if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current); }, []);

  return (
    <div className="w-full">
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
          disabled={!text.trim()}
          className="px-4 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors"
        >
          {status === 'sent' ? '✓' : 'Send'}
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-1 ml-1">Shift+Enter for new line · Enter to send</p>
    </div>
  );
}
