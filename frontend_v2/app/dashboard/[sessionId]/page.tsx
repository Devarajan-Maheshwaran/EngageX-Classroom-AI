/**
 * Teacher Dashboard — Phase 13
 * Adds EngagementChart + QuizInsightsPanel.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams }           from 'next/navigation';
import { useTeacherSocket }    from '@/hooks/useTeacherSocket';
import ClassEngagementGrid     from '@/components/teacher/ClassEngagementGrid';
import AlertFeed               from '@/components/teacher/AlertFeed';
import QuizLauncher            from '@/components/teacher/QuizLauncher';
import SessionSummaryPanel     from '@/components/teacher/SessionSummaryPanel';
import EngagementChart         from '@/components/teacher/EngagementChart';
import QuizInsightsPanel       from '@/components/teacher/QuizInsightsPanel';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface QuizMeta { id: string; question: string; created_at: string; }

export default function TeacherDashboard() {
  const params    = useParams();
  const sessionId = params.sessionId as string;
  const teacherId = typeof window !== 'undefined'
    ? (sessionStorage.getItem('engagex_teacher_id') ?? 'teacher')
    : 'teacher';

  const { connected, classState, alerts, dismissAlert, quizInsights } = useTeacherSocket(sessionId);
  const [quizzes, setQuizzes] = useState<QuizMeta[]>([]);
  const [quizMarkers, setQuizMarkers] = useState<{ time: string; question: string }[]>([]);

  // Track quiz launches as chart markers
  useEffect(() => {
    async function loadQuizzes() {
      try {
        const res = await fetch(`${API}/api/quiz/session/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setQuizzes(data.quizzes ?? []);
        }
      } catch {}
    }
    if (sessionId) loadQuizzes();
  }, [sessionId]);

  const avgScore      = classState.length
    ? Math.round(classState.reduce((s, x) => s + x.fused_score, 0) / classState.length)
    : null;
  const criticalCount = classState.filter((s) => s.alert_level === 'intervene').length;
  const watchCount    = classState.filter((s) => s.alert_level === 'watch').length;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-gray-900">EngageX</span>
          <span className="text-sm text-gray-400">/ Teacher Dashboard</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {avgScore !== null && (
            <span className="font-medium text-gray-700">Class avg: <strong>{avgScore}</strong>/100</span>
          )}
          {criticalCount > 0 && (
            <span className="bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full text-xs">
              {criticalCount} critical
            </span>
          )}
          {watchCount > 0 && (
            <span className="bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full text-xs">
              {watchCount} watch
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${ connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300' }`} />
            <span className="text-gray-500">{connected ? 'Live' : 'Connecting…'}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left column */}
        <section className="space-y-6">
          {/* Live grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                Students
                {classState.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">{classState.length} connected</span>
                )}
              </h2>
              <span className="text-xs text-gray-400">Updated every 15s</span>
            </div>
            <ClassEngagementGrid students={classState} sessionId={sessionId} />
          </div>

          {/* Engagement chart */}
          <EngagementChart classState={classState} quizMarkers={quizMarkers} />

          {/* Quiz insights panels */}
          {quizzes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-800">Quiz insights</h2>
              {quizzes.map((q) => (
                <QuizInsightsPanel
                  key={q.id}
                  sessionId={sessionId}
                  quizId={q.id}
                  question={q.question}
                  insights={quizInsights[q.id] ?? null}
                />
              ))}
            </div>
          )}

          {/* Session summary */}
          <SessionSummaryPanel sessionId={sessionId} />
        </section>

        {/* Right sidebar */}
        <aside className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Quiz / Poll</h2>
            <QuizLauncher sessionId={sessionId} teacherId={teacherId} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-800">Alerts</h2>
              {alerts.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
            <AlertFeed alerts={alerts} onDismiss={dismissAlert} />
          </div>
        </aside>
      </div>
    </main>
  );
}
