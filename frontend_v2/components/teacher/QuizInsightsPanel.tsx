/**
 * QuizInsightsPanel.tsx — Phase 13
 *
 * Displays quiz insights from the Quiz Crew (received via Socket.IO
 * quiz_insights event or fetched on demand).
 *
 * Shows:
 *  - confusion ratio bar
 *  - option distribution bar chart
 *  - misconception options highlighted
 *  - analyst summary + suggestions
 *  - Analyse button that triggers POST /api/quiz/{quiz_id}/analyse
 */

'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export interface QuizInsights {
  confusion_ratio:        number;
  response_rate:          number;
  non_responder_count:    number;
  total_students:         number;
  total_responses:        number;
  misconception_options:  string[];
  option_distribution:    Record<string, number>;
  analyst_summary:        string;
  analyst_suggestions:    string[];
  low_engagement_students: string[];
}

interface Props {
  sessionId: string;
  quizId:    string;
  question:  string;
  insights?: QuizInsights | null;
}

function ConfusionBar({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const color = pct >= 50 ? 'bg-red-400' : pct >= 25 ? 'bg-amber-400' : 'bg-green-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Confusion rate</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function QuizInsightsPanel({ sessionId, quizId, question, insights: initialInsights }: Props) {
  const [insights,  setInsights]  = useState<QuizInsights | null>(initialInsights ?? null);
  const [loading,   setLoading]   = useState(false);
  const [triggered, setTriggered] = useState(false);

  async function triggerAnalysis() {
    setLoading(true);
    setTriggered(true);
    try {
      await fetch(`${API}/api/quiz/${quizId}/analyse?session_id=${sessionId}`, { method: 'POST' });
      // Insights will arrive via Socket.IO quiz_insights event — handled by parent
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Option distribution chart data
  const distData = insights
    ? Object.entries(insights.option_distribution).map(([id, count]) => ({ id, count }))
    : [];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Quiz insights</p>
          <p className="text-sm font-medium text-gray-800 mt-0.5 truncate" title={question}>{question}</p>
        </div>
        {!insights && (
          <button
            onClick={triggerAnalysis}
            disabled={loading || triggered}
            className="flex-shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
          >
            {triggered ? 'Analysing…' : '🧠 Analyse'}
          </button>
        )}
      </div>

      {!insights && !triggered && (
        <p className="text-xs text-gray-400">Click Analyse to get Quiz Crew insights for this question.</p>
      )}
      {!insights && triggered && (
        <p className="text-xs text-gray-400 animate-pulse">Quiz Crew is analysing… insights will appear here shortly.</p>
      )}

      {insights && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-lg font-bold text-gray-900">{Math.round(insights.response_rate * 100)}%</p>
              <p className="text-xs text-gray-400">Response rate</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-lg font-bold text-gray-900">{insights.total_responses}</p>
              <p className="text-xs text-gray-400">Responded</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <p className="text-lg font-bold text-gray-900">{insights.non_responder_count}</p>
              <p className="text-xs text-gray-400">No response</p>
            </div>
          </div>

          <ConfusionBar ratio={insights.confusion_ratio} />

          {/* Option distribution */}
          {distData.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Answer distribution</p>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={distData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                  <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distData.map((d) => (
                      <Cell
                        key={d.id}
                        fill={insights.misconception_options.includes(d.id) ? '#f87171' : '#6366f1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {insights.misconception_options.length > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Most chosen wrong: {insights.misconception_options.join(', ').toUpperCase()}
                </p>
              )}
            </div>
          )}

          {/* Analyst summary */}
          {insights.analyst_summary && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-indigo-600 mb-1">🧠 AI Analysis</p>
              <p className="text-sm text-indigo-900">{insights.analyst_summary}</p>
            </div>
          )}

          {/* Suggestions */}
          {insights.analyst_suggestions.length > 0 && (
            <ul className="space-y-1">
              {insights.analyst_suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5">→</span>{s}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
