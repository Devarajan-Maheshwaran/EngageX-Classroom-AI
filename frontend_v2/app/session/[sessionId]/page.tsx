'use client';

import { useEffect, useState }         from 'react';
import { useParams }                   from 'next/navigation';
import { useSessionSocket }            from '@/hooks/useSessionSocket';
import { useQuizSocket }               from '@/hooks/useQuizSocket';
import TextPipeline                    from '@/components/student/TextPipeline';
import ReactionBar                     from '@/components/student/ReactionBar';
import VisionPipelineComponent         from '@/components/student/VisionPipeline';
import AudioPipelineComponent          from '@/components/student/AudioPipeline';
import QuizWidget                      from '@/components/student/QuizWidget';
import type { TextSignalPayload }      from '@/components/student/TextPipeline';

export default function StudentSessionPage() {
  const params    = useParams();
  const sessionId = params.sessionId as string;

  const [studentId,    setStudentId]    = useState('');
  const [studentName,  setStudentName]  = useState('');
  const [signalLog,    setSignalLog]    = useState<string[]>([]);

  useEffect(() => {
    setStudentId(sessionStorage.getItem('engagex_student_id')    ?? '');
    setStudentName(sessionStorage.getItem('engagex_student_name') ?? 'Student');
  }, []);

  const { connected } = useSessionSocket({
    sessionId, role: 'student', name: studentName, studentId,
  });

  const { activeQuiz, dismissQuiz } = useQuizSocket(sessionId, studentId);

  function handleSignalSent(s: TextSignalPayload) {
    const parts = [
      s.is_deleted ? '❌' : '✅',
      s.intent   ? `[${s.intent}]` : '',
      typeof s.engagement_score === 'number' ? `score:${Math.round(s.engagement_score)}` : '',
      `"${s.text.slice(0, 24)}${s.text.length > 24 ? '…' : ''}"`,
    ].filter(Boolean);
    setSignalLog((prev) => [parts.join(' '), ...prev].slice(0, 6));
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      {/* Quiz overlay */}
      {activeQuiz && studentId && (
        <QuizWidget
          quiz={activeQuiz}
          sessionId={sessionId}
          studentId={studentId}
          onDismiss={dismissQuiz}
        />
      )}

      <div className="flex items-center gap-2 mb-6">
        <span className={`w-3 h-3 rounded-full ${ connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300' }`} />
        <span className="text-sm text-gray-600">{connected ? `Connected as ${studentName}` : 'Connecting…'}</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{studentName}</p>
            <p className="text-xs text-gray-400">Multimodal engagement tracking active</p>
          </div>
        </div>

        {studentId && <VisionPipelineComponent sessionId={sessionId} studentId={studentId} />}
        <div className="border-t border-gray-100" />
        {studentId && <AudioPipelineComponent  sessionId={sessionId} studentId={studentId} />}
        <div className="border-t border-gray-100" />
        {studentId && <ReactionBar sessionId={sessionId} studentId={studentId} />}
        <div className="border-t border-gray-100" />
        {studentId && (
          <TextPipeline sessionId={sessionId} studentId={studentId} onSignalSent={handleSignalSent} />
        )}

        {signalLog.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-400 mb-1">Signal log</p>
            {signalLog.map((entry, i) => (
              <p key={i} className="text-xs text-gray-500 truncate">{entry}</p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
