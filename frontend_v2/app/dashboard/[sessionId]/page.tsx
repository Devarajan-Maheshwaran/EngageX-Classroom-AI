/**
 * Teacher Dashboard — Phase 10
 * Real-time class engagement overview.
 * Polls via Socket.IO engagement_update every 15s.
 * Receives instant alerts via Socket.IO alert event.
 */

'use client';

import { useParams }              from 'next/navigation';
import { useTeacherSocket }       from '@/hooks/useTeacherSocket';
import ClassEngagementGrid        from '@/components/teacher/ClassEngagementGrid';
import AlertFeed                  from '@/components/teacher/AlertFeed';

export default function TeacherDashboard() {
  const params    = useParams();
  const sessionId = params.sessionId as string;

  const { connected, classState, alerts, dismissAlert } = useTeacherSocket(sessionId);

  const avgScore = classState.length
    ? Math.round(classState.reduce((s, x) => s + x.fused_score, 0) / classState.length)
    : null;

  const criticalCount = classState.filter((s) => s.alert_level === 'intervene').length;
  const watchCount    = classState.filter((s) => s.alert_level === 'watch').length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-gray-900">EngageX</span>
          <span className="text-sm text-gray-400">∕ Teacher Dashboard</span>
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
        {/* Left: engagement grid */}
        <section>
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
        </section>

        {/* Right: alert feed */}
        <aside>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Alerts</h2>
            {alerts.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
          <AlertFeed alerts={alerts} onDismiss={dismissAlert} />
        </aside>
      </div>
    </main>
  );
}
