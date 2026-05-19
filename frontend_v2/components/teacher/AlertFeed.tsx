/**
 * AlertFeed.tsx — Phase 10
 * Live alert feed for the teacher.
 * Alerts arrive via Socket.IO 'alert' event.
 */

'use client';

import { AlertEvent } from '@/hooks/useTeacherSocket';

const LEVEL_STYLES = {
  intervene: 'bg-red-50 border-red-300 text-red-800',
  watch:     'bg-amber-50 border-amber-300 text-amber-800',
};

const LEVEL_ICON = {
  intervene: '🚨',
  watch:     '⚠️',
};

interface Props {
  alerts:       AlertEvent[];
  onDismiss:    (index: number) => void;
}

export default function AlertFeed({ alerts, onDismiss }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-6">
        No alerts — all students look engaged 🎉
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={`${alert.student_id}-${alert.timestamp}`}
          className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${ LEVEL_STYLES[alert.alert_level] }`}
        >
          <span className="text-lg mt-0.5">{LEVEL_ICON[alert.alert_level]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{alert.student_id.slice(0, 8)}</span>
              <span className="text-xs font-medium uppercase tracking-wide opacity-70">{alert.alert_level}</span>
              <span className="text-xs opacity-50">{new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="text-sm mt-0.5 opacity-90 truncate">{alert.alert_reason}</p>
            <p className="text-xs mt-0.5 opacity-60">Score: {Math.round(alert.fused_score)}/100</p>
          </div>
          <button
            onClick={() => onDismiss(i)}
            className="text-lg opacity-40 hover:opacity-80 transition-opacity ml-2"
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
