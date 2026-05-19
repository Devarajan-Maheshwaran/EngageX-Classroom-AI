'use client';

import { useEffect, useState } from 'react';
import { useParams }           from 'next/navigation';
import { useSessionSocket }    from '@/hooks/useSessionSocket';

export default function TeacherDashboard() {
  const params    = useParams();
  const sessionId = params.sessionId as string;

  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    setJoinCode(sessionStorage.getItem('engagex_join_code') ?? '');
  }, []);

  const { participants, connected } = useSessionSocket({
    sessionId,
    role: 'teacher',
    name: 'Teacher',
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Join code:{' '}
            <span className="font-mono font-bold text-brand-600 text-base tracking-widest">
              {joinCode || '———'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300'
            }`}
          />
          <span className="text-sm text-gray-500">
            {connected ? 'Live' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* Participant grid (Phase 4 minimal version) */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Students ({participants.length})
        </h2>
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Waiting for students to join…</p>
            <p className="text-brand-500 font-mono font-bold text-2xl tracking-widest mt-2">
              {joinCode}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {participants.map((p) => (
              <div
                key={p.student_id}
                className="bg-white rounded-xl p-4 border border-gray-200 flex flex-col items-center gap-2 shadow-sm"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">
                  {p.student_name.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-medium text-gray-800 text-center truncate w-full text-center">
                  {p.student_name}
                </p>
                <span className="text-xs text-gray-400">Active</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
