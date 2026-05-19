/**
 * SessionSummaryPanel.tsx — Phase 12
 *
 * Teacher-side report viewer.
 * Fetches summary JSON from backend and renders:
 *   - top metrics cards
 *   - per-student report table
 *   - simple timeline sparkline blocks
 */

'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface StudentReport {
  student_id: string;
  student_name: string;
  avg_engagement: number | null;
  peak_engagement: number | null;
  low_engagement_count: number;
  alerts_count: number;
  quiz_attempts: number;
  quiz_correct: number;
  quiz_accuracy: number | null;
  dominant_signal: string;
  timeline: { t: string; score: number; type: string }[];
}

interface SessionReport {
  session_id: string;
  session_title: string;
  student_count: number;
  class_avg_engagement: number | null;
  alerts_total: number;
  alerts_watch: number;
  alerts_intervene: number;
  most_common_alert_reason: string | null;
  quiz_count: number;
  quiz_total_responses: number;
  overall_quiz_accuracy: number | null;
  students: StudentReport[];
}

function TinyTimeline({ points }: { points: { score: number }[] }) {
  if (!points.length) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div className="flex items-end gap-[2px] h-10">
      {points.slice(-18).map((p, i) => (
        <div
          key={i}
          className={`w-1 rounded-full ${
            p.score >= 65 ? 'bg-green-400' : p.score >= 40 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ height: `${Math.max(8, p.score * 0.35)}px` }}
          title={`${Math.round(p.score)}`}
        />
      ))}
    </div>
  );
}

export default function SessionSummaryPanel({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generateReport() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/report/session-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, limit_per_student: 100 }),
      });
      if (!res.ok) throw new Error('Failed to generate report');
      const data = await res.json();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await fetch(`${API}/api/report/session/${sessionId}`);
        if (res.ok) setReport(await res.json());
      } catch {}
    }
    if (sessionId) loadExisting();
  }, [sessionId]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Session summary</h2>
          <p className="text-xs text-gray-400">Generate after class ends or anytime for a snapshot.</p>
        </div>
        <button
          onClick={generateReport}
          disabled={loading}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate report'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Class avg" value={report.class_avg_engagement !== null ? `${Math.round(report.class_avg_engagement)}/100` : '—'} />
            <MetricCard label="Students" value={`${report.student_count}`} />
            <MetricCard label="Alerts" value={`${report.alerts_total}`} />
            <MetricCard label="Quiz accuracy" value={report.overall_quiz_accuracy !== null ? `${Math.round(report.overall_quiz_accuracy)}%` : '—'} />
          </div>

          {report.most_common_alert_reason && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Most common alert</p>
              <p className="text-sm text-amber-900 mt-1">{report.most_common_alert_reason}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Avg</th>
                  <th className="py-2 pr-4">Peak</th>
                  <th className="py-2 pr-4">Alerts</th>
                  <th className="py-2 pr-4">Quiz</th>
                  <th className="py-2 pr-4">Signal</th>
                  <th className="py-2 pr-4">Timeline</th>
                </tr>
              </thead>
              <tbody>
                {report.students.map((s) => (
                  <tr key={s.student_id} className="border-b last:border-0 align-middle">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-medium text-gray-800">{s.student_name}</p>
                        <p className="text-xs text-gray-400">{s.student_id.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4">{s.avg_engagement !== null ? Math.round(s.avg_engagement) : '—'}</td>
                    <td className="py-3 pr-4">{s.peak_engagement !== null ? Math.round(s.peak_engagement) : '—'}</td>
                    <td className="py-3 pr-4">{s.alerts_count}</td>
                    <td className="py-3 pr-4">
                      {s.quiz_attempts > 0
                        ? `${s.quiz_correct}/${s.quiz_attempts} (${Math.round(s.quiz_accuracy ?? 0)}%)`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 capitalize">{s.dominant_signal}</td>
                    <td className="py-3 pr-4"><TinyTimeline points={s.timeline} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
