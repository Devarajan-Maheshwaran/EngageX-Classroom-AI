/**
 * QuizLauncher.tsx — Phase 11
 *
 * Teacher control panel to create and push quizzes/polls.
 * Embedded in the teacher dashboard sidebar.
 */

'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface Props {
  sessionId:  string;
  teacherId:  string;
}

type QuizType = 'mcq' | 'poll' | 'short';

interface Option { id: string; text: string; }

const DEFAULT_OPTIONS: Option[] = [
  { id: 'a', text: '' },
  { id: 'b', text: '' },
  { id: 'c', text: '' },
  { id: 'd', text: '' },
];

export default function QuizLauncher({ sessionId, teacherId }: Props) {
  const [open,       setOpen]       = useState(false);
  const [quizType,   setQuizType]   = useState<QuizType>('mcq');
  const [question,   setQuestion]   = useState('');
  const [options,    setOptions]    = useState<Option[]>(DEFAULT_OPTIONS);
  const [correctId,  setCorrectId]  = useState('a');
  const [durationS,  setDurationS]  = useState(30);
  const [loading,    setLoading]    = useState(false);
  const [pushed,     setPushed]     = useState(false);

  function updateOption(id: string, text: string) {
    setOptions((prev) => prev.map((o) => o.id === id ? { ...o, text } : o));
  }

  async function handlePush() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        session_id: sessionId,
        teacher_id: teacherId,
        question:   question.trim(),
        quiz_type:  quizType,
        duration_s: durationS,
      };
      if (quizType !== 'short') {
        body.options    = options.filter((o) => o.text.trim());
        body.correct_id = quizType === 'mcq' ? correctId : null;
      }
      const res = await fetch(`${API}/api/quiz/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) throw new Error('push failed');
      setPushed(true);
      setTimeout(() => {
        setPushed(false); setOpen(false);
        setQuestion(''); setOptions(DEFAULT_OPTIONS); setCorrectId('a');
      }, 2000);
    } catch (e) {
      alert('Failed to push quiz. Check console.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          ➕ Push Quiz / Poll
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">New Quiz</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {/* Type selector */}
          <div className="flex gap-2">
            {(['mcq', 'poll', 'short'] as QuizType[]).map((t) => (
              <button
                key={t}
                onClick={() => setQuizType(t)}
                className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                  quizType === t
                    ? 'bg-brand-50 border-brand-400 text-brand-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {t === 'mcq' ? '❓ MCQ' : t === 'poll' ? '📊 Poll' : '✏️ Short'}
              </button>
            ))}
          </div>

          {/* Question */}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question…"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
          />

          {/* Options (MCQ / Poll) */}
          {quizType !== 'short' && (
            <div className="space-y-1.5">
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  {quizType === 'mcq' && (
                    <input
                      type="radio" name="correct"
                      checked={correctId === opt.id}
                      onChange={() => setCorrectId(opt.id)}
                      className="accent-brand-600"
                    />
                  )}
                  <span className="text-xs font-bold text-gray-400 uppercase w-4">{opt.id}</span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(opt.id, e.target.value)}
                    placeholder={`Option ${opt.id.toUpperCase()}`}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300"
                  />
                </div>
              ))}
              {quizType === 'mcq' && (
                <p className="text-xs text-gray-400">● = correct answer</p>
              )}
            </div>
          )}

          {/* Duration */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Duration</span>
            <input
              type="range" min={10} max={120} step={5}
              value={durationS}
              onChange={(e) => setDurationS(Number(e.target.value))}
              className="flex-1 accent-brand-600"
            />
            <span className="text-xs font-medium text-gray-700 w-10 text-right">{durationS}s</span>
          </div>

          {/* Push button */}
          <button
            onClick={handlePush}
            disabled={loading || !question.trim()}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm"
          >
            {pushed ? '✅ Pushed to students!' : loading ? 'Pushing…' : '🚀 Push to all students'}
          </button>
        </div>
      )}
    </div>
  );
}
