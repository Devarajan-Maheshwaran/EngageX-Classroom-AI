/**
 * EngagementChart.tsx — Phase 13
 *
 * Recharts line chart: class-average engagement vs time.
 * Vertical reference lines for quiz launches.
 * Data is derived from classState snapshots stored locally.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import type { StudentSnapshot } from '@/hooks/useTeacherSocket';

interface ChartPoint {
  time:  string;    // HH:MM:SS
  avg:   number;
  min:   number;
  max:   number;
}

interface QuizMarker {
  time:     string;
  question: string;
}

interface Props {
  classState: StudentSnapshot[];
  quizMarkers?: QuizMarker[];
}

function hms(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function EngagementChart({ classState, quizMarkers = [] }: Props) {
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const lastRef = useRef<string>('');

  useEffect(() => {
    if (!classState.length) return;
    const scores = classState.map((s) => s.fused_score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const min = Math.round(Math.min(...scores));
    const max = Math.round(Math.max(...scores));
    const time = hms(new Date());
    if (time === lastRef.current) return; // dedupe same-second update
    lastRef.current = time;
    setHistory((prev) => [...prev.slice(-59), { time, avg, min, max }]); // keep last 60 points
  }, [classState]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400 bg-gray-50 rounded-xl">
        Waiting for engagement data…
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Class engagement over time</h3>
        <span className="text-xs text-gray-400">{history.length} data points</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={history} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval={Math.max(1, Math.floor(history.length / 8))}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(val: number, name: string) => [`${val}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {/* Quiz launch markers */}
          {quizMarkers.map((m, i) => (
            <ReferenceLine
              key={i}
              x={m.time}
              stroke="#8b5cf6"
              strokeDasharray="4 2"
              label={{ value: '\u2753', position: 'top', fontSize: 12 }}
            />
          ))}

          <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2}
            dot={false} name="Avg" activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="min" stroke="#f87171" strokeWidth={1}
            dot={false} strokeDasharray="3 2" name="Min" />
          <Line type="monotone" dataKey="max" stroke="#4ade80" strokeWidth={1}
            dot={false} strokeDasharray="3 2" name="Max" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
