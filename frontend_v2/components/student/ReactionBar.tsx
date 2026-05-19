/**
 * ReactionBar.tsx — Phase 5
 * One-click emoji reactions sent as text signals with preset intent.
 */

'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

const REACTIONS = [
  { emoji: '👍', label: 'Got it',   type: 'got_it'   as const, score: 80 },
  { emoji: '🤔', label: 'Confused', type: 'confused' as const, score: 30 },
  { emoji: '✋', label: 'Question', type: 'question' as const, score: 60 },
];

type ReactionType = 'got_it' | 'confused' | 'question';

interface ReactionBarProps { sessionId: string; studentId: string; }

export default function ReactionBar({ sessionId, studentId }: ReactionBarProps) {
  const [lastSent, setLastSent] = useState<ReactionType | null>(null);
  const [cooldown, setCooldown] = useState(false);

  async function sendReaction(r: typeof REACTIONS[number]) {
    if (cooldown) return;
    setCooldown(true); setLastSent(r.type);
    try {
      await fetch(`${API}/api/signals/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId, student_id: studentId,
          text: r.type, is_deleted: false, edit_count: 0,
          silence_duration_ms: 0, participation_freq: 0,
          intent: r.type, engagement_score: r.score,
        }),
      });
    } catch (err) { console.warn('[ReactionBar]', err); }
    setTimeout(() => setCooldown(false), 3000);
  }

  return (
    <div className="flex justify-center gap-3">
      {REACTIONS.map((r) => (
        <button
          key={r.type}
          onClick={() => sendReaction(r)}
          disabled={cooldown}
          className={`flex flex-col items-center gap-1 px-5 py-3 rounded-xl border transition-all ${
            lastSent === r.type && cooldown
              ? 'bg-brand-50 border-brand-300 scale-95'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          } disabled:opacity-60`}
        >
          <span className="text-2xl">{r.emoji}</span>
          <span className="text-xs text-gray-500 font-medium">{r.label}</span>
        </button>
      ))}
    </div>
  );
}
