/**
 * Student session page — Phase 15
 * Wraps AV pipelines behind PrivacyConsentDialog.
 * Shows SkeletonCard while connecting.
 */

'use client';

import { useState }           from 'react';
import { useParams }           from 'next/navigation';
import dynamic                 from 'next/dynamic';
import PrivacyConsentDialog    from '@/components/ui/PrivacyConsentDialog';
import { SkeletonCard }        from '@/components/ui/SkeletonCard';
import QuizWidget              from '@/components/student/QuizWidget';
import { useStudentSocket }    from '@/hooks/useStudentSocket';

// Lazy-load heavy AV pipelines
const VisionPipeline = dynamic(() => import('@/components/student/VisionPipeline'), { ssr: false });
const AudioPipeline  = dynamic(() => import('@/components/student/AudioPipeline'),  { ssr: false });
const TextPipeline   = dynamic(() => import('@/components/student/TextPipeline'),   { ssr: false });

export default function StudentSession() {
  const params    = useParams();
  const sessionId = params.sessionId as string;
  const studentId = typeof window !== 'undefined'
    ? (sessionStorage.getItem('engagex_student_id') ?? '')
    : '';

  const [avEnabled,  setAvEnabled]  = useState<boolean | null>(null); // null = pending consent
  const [connecting, setConnecting] = useState(true);

  const { connected, activeQuiz, submitQuiz } = useStudentSocket(sessionId, studentId, () => {
    setConnecting(false);
  });

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Privacy consent gate */}
      {avEnabled === null && (
        <PrivacyConsentDialog
          onAccept={() => setAvEnabled(true)}
          onDecline={() => setAvEnabled(false)}
        />
      )}

      {/* Active quiz overlay */}
      {activeQuiz && (
        <QuizWidget quiz={activeQuiz} studentId={studentId} onSubmit={submitQuiz} />
      )}

      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900">EngageX</span>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300'
          }`} />
          <span className="text-sm text-gray-500">{connected ? 'Live' : 'Connecting…'}</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        {/* Skeleton while connecting */}
        {connecting && (
          <>
            <SkeletonCard rows={2} />
            <SkeletonCard rows={3} />
          </>
        )}

        {!connecting && (
          <>
            {/* Text interaction */}
            <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Class interaction</h2>
              <TextPipeline sessionId={sessionId} studentId={studentId} />
            </section>

            {/* AV pipelines — only if consent given */}
            {avEnabled && (
              <>
                <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Attention tracking</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    🔒 Processed locally in your browser — no video is sent to any server.
                  </p>
                  <VisionPipeline sessionId={sessionId} studentId={studentId} />
                </section>

                <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Voice participation</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    🎤 Short audio clips only. No recordings are stored.
                  </p>
                  <AudioPipeline sessionId={sessionId} studentId={studentId} />
                </section>
              </>
            )}

            {avEnabled === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
                👍 You’re in text-only mode. Camera and microphone are not active.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
