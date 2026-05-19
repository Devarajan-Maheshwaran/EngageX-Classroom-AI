/**
 * QuizWidget.tsx — Phase 11
 *
 * Appears on the student session page when a quiz_push event arrives.
 * Supports MCQ, poll (no correct answer), and short-answer types.
 * Auto-dismisses after duration_s + 3s grace period.
 * Submits via POST /api/quiz/respond.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export interface QuizPayload {
  quiz_id:    string;
  question:   string;
  quiz_type:  'mcq' | 'poll' | 'short';
  options?:   { id: string; text: string }[];
  duration_s: number;
}

interface Props {
  quiz:       QuizPayload;
  sessionId:  string;
  studentId:  string;
  onDismiss:  () => void;
}

export default function QuizWidget({ quiz, sessionId, studentId, onDismiss }: Props) {
  const [selected,    setSelected]    = useState<string | null>(null);
  const [shortAnswer, setShortAnswer] = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const [isCorrect,   setIsCorrect]   = useState<boolean | null>(null);
  const [timeLeft,    setTimeLeft]    = useState(quiz.duration_s);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setTimeout(onDismiss, 3000);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  async function handleSubmit() {
    if (submitted) return;
    const body: Record<string, unknown> = {
      quiz_id:    quiz.quiz_id,
      session_id: sessionId,
      student_id: studentId,
    };
    if (quiz.quiz_type === 'short') {
      body.answer_text = shortAnswer;
    } else {
      if (!selected) return;
      body.answer_id = selected;
    }

    try {
      const res  = await fetch(`${API}/api/quiz/respond`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      setIsCorrect(data.is_correct ?? null);
      setSubmitted(true);
      setTimeout(onDismiss, 3000);
    } catch {
      setSubmitted(true);
      setTimeout(onDismiss, 2000);
    }
  }

  const progress = (timeLeft / quiz.duration_s) * 100;
  const urgentColor = timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-amber-400' : 'bg-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {quiz.quiz_type === 'short' ? '✏️ Short Answer' : quiz.quiz_type === 'poll' ? '📊 Poll' : '❓ Quiz'}
          </span>
          <span className={`text-sm font-bold tabular-nums ${ timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-500' }`}>
            {timeLeft}s
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${ urgentColor }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question */}
        <p className="text-sm font-semibold text-gray-900 leading-snug">{quiz.question}</p>

        {/* Options — MCQ / Poll */}
        {(quiz.quiz_type === 'mcq' || quiz.quiz_type === 'poll') && quiz.options && (
          <div className="space-y-2">
            {quiz.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => !submitted && setSelected(opt.id)}
                disabled={submitted}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                  submitted && isCorrect !== null
                    ? opt.id === selected
                      ? isCorrect ? 'bg-green-50 border-green-400 text-green-800' : 'bg-red-50 border-red-400 text-red-800'
                      : 'border-gray-200 text-gray-400'
                    : selected === opt.id
                    ? 'bg-brand-50 border-brand-400 text-brand-800'
                    : 'border-gray-200 hover:border-brand-300 text-gray-700'
                }`}
              >
                <span className="font-medium mr-2 uppercase">{opt.id}.</span>{opt.text}
              </button>
            ))}
          </div>
        )}

        {/* Short answer */}
        {quiz.quiz_type === 'short' && (
          <textarea
            value={shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Type your answer…"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
          />
        )}

        {/* Feedback / Submit */}
        {submitted ? (
          <div className={`text-center text-sm font-semibold py-2 rounded-xl ${
            isCorrect === true  ? 'bg-green-50 text-green-700' :
            isCorrect === false ? 'bg-red-50 text-red-700' :
                                  'bg-gray-50 text-gray-600'
          }`}>
            {isCorrect === true  ? '✅ Correct!' :
             isCorrect === false ? '❌ Incorrect' :
                                   '✅ Response submitted'}
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={quiz.quiz_type !== 'short' ? !selected : shortAnswer.trim().length === 0}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm"
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
}
