/**
 * ClassEngagementGrid.tsx — Phase 10
 *
 * Live grid of student engagement cards.
 * Colour-coded by fused_score:
 *   >= 65  → green  (engaged)
 *   40-64  → amber  (watch)
 *   < 40   → red    (intervene)
 *
 * Updates every 15s via useTeacherSocket engagement_update event.
 */

'use client';

import { StudentSnapshot } from '@/hooks/useTeacherSocket';

function scoreColor(score: number): string {
  if (score >= 65) return 'bg-green-50 border-green-200 text-green-800';
  if (score >= 40) return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function scoreBadge(score: number): string {
  if (score >= 65) return 'bg-green-100 text-green-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

const SIGNAL_ICON: Record<string, string> = {
  text: '💬', vision: '📷', audio: '🎤', none: '—',
};

interface Props {
  students:  StudentSnapshot[];
  sessionId: string;
}

export default function ClassEngagementGrid({ students, sessionId }: Props) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <p className="text-sm">No students connected yet</p>
        <p className="text-xs mt-1">Students will appear here once they join</p>
      </div>
    );
  }

  const sorted = [...students].sort((a, b) => a.fused_score - b.fused_score);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {sorted.map((s) => (
        <div
          key={s.student_id}
          className={`relative border rounded-xl p-3 transition-all ${ scoreColor(s.fused_score) }`}
        >
          {/* Alert badge */}
          {s.alert_level !== 'none' && (
            <span className={`absolute -top-1.5 -right-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
              s.alert_level === 'intervene' ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'
            }`}>
              {s.alert_level === 'intervene' ? '!' : '▲'}
            </span>
          )}

          {/* Avatar */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${ scoreBadge(s.fused_score) }`}>
              {s.student_id.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-medium truncate max-w-[80px]">{s.student_id.slice(0, 8)}</span>
          </div>

          {/* Score */}
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold">{Math.round(s.fused_score)}</span>
            <span className="text-xs mb-0.5 opacity-60">/100</span>
          </div>

          {/* Modality bars */}
          <div className="mt-2 space-y-1">
            {(['text', 'vision', 'audio'] as const).map((mod) => {
              const val = s.raw_scores[mod];
              return (
                <div key={mod} className="flex items-center gap-1">
                  <span className="text-xs w-4">{SIGNAL_ICON[mod]}</span>
                  <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden">
                    {val !== null && (
                      <div
                        className="h-full rounded-full bg-current opacity-60 transition-all duration-700"
                        style={{ width: `${val}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs w-6 text-right opacity-70">{val !== null ? Math.round(val) : '—'}</span>
                </div>
              );
            })}
          </div>

          {/* Primary signal */}
          <p className="text-xs mt-2 opacity-60">
            via {SIGNAL_ICON[s.primary_signal] ?? ''} {s.primary_signal}
          </p>
        </div>
      ))}
    </div>
  );
}
