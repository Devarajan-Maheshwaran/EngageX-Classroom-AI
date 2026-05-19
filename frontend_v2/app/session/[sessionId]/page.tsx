'use client';

import { useEffect, useState } from 'react';
import { useParams }           from 'next/navigation';
import { useSessionSocket }    from '@/hooks/useSessionSocket';

export default function StudentSessionPage() {
  const params    = useParams();
  const sessionId = params.sessionId as string;

  const [studentId,   setStudentId]   = useState('');
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    setStudentId(sessionStorage.getItem('engagex_student_id')   ?? '');
    setStudentName(sessionStorage.getItem('engagex_student_name') ?? 'Student');
  }, []);

  const { connected } = useSessionSocket({
    sessionId,
    role:      'student',
    name:      studentName,
    studentId: studentId,
  });

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Connection status */}
      <div className="flex items-center gap-2 mb-8">
        <span
          className={`w-3 h-3 rounded-full ${
            connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300'
          }`}
        />
        <span className="text-sm text-gray-600">
          {connected ? `Connected as ${studentName}` : 'Connecting…'}
        </span>
      </div>

      {/* Main card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-md shadow-sm text-center">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-2xl mx-auto mb-4">
          {studentName.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{studentName}</h2>
        <p className="text-sm text-gray-500 mb-6">You are in the session. Your engagement is being tracked.</p>

        {/* Reaction buttons — Phase 5 will wire these to signals */}
        <div className="flex justify-center gap-3">
          {[
            { emoji: '👍', label: 'Got it',   type: 'got_it' },
            { emoji: '🤔', label: 'Confused', type: 'confused' },
            { emoji: '✋', label: 'Question', type: 'question' },
          ].map((r) => (
            <button
              key={r.type}
              className="flex flex-col items-center gap-1 px-4 py-3 bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-200 rounded-xl transition-colors"
              title={r.label}
            >
              <span className="text-2xl">{r.emoji}</span>
              <span className="text-xs text-gray-500">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quiz widget placeholder — Phase 12 */}
      <div id="quiz-widget-anchor" />
    </main>
  );
}
