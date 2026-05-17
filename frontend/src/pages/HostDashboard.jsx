// HostDashboard.jsx — Phase 5A
// Two-column live dashboard.
// Left:  SessionHeader + ParticipantGrid + SentimentTimeline
// Right: AlertFeed
// Optional debug panel: append ?debug=1 to URL

import { useSearchParams } from 'react-router-dom';
import { useMeetingSocket }  from '../hooks/useMeetingSocket';
import SessionHeader        from '../components/SessionHeader';
import ParticipantGrid      from '../components/ParticipantGrid';
import SentimentTimeline    from '../components/SentimentTimeline';
import AlertFeed            from '../components/AlertFeed';

export default function HostDashboard() {
  const [searchParams] = useSearchParams();
  const sessionId      = searchParams.get('sessionId') || '';
  const debug          = searchParams.get('debug') === '1';

  const {
    participants, alerts, sentiments,
    connected, sessionError, roomMood,
    endSession,
  } = useMeetingSocket({ role: 'teacher', sessionId, name: 'Host' });

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        No session ID. <a href="/" className="ml-2 text-brand underline">Go home</a>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
        <span className="text-3xl">🚫</span>
        <p className="text-white">{sessionError}</p>
        <a href="/" className="text-brand underline text-sm">Back to home</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <SessionHeader
        sessionId={sessionId}
        connected={connected}
        roomMood={roomMood}
        participantCount={participants.length}
        onEnd={endSession}
      />

      <main className="flex flex-1 gap-0 overflow-hidden">
        {/* Left column */}
        <div className="flex flex-col flex-1 gap-4 p-5 overflow-y-auto">
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Participants</h2>
            <ParticipantGrid participants={participants} />
          </section>

          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sentiment timeline</h2>
            <SentimentTimeline sentiments={sentiments} />
          </section>

          {/* Optional debug panel — ?debug=1 */}
          {debug && (
            <section className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Debug</p>
              <p className="text-xs text-slate-300">Session: <span className="font-mono text-white">{sessionId}</span></p>
              <p className="text-xs text-slate-300">Connected: <span className="text-white">{connected ? 'yes' : 'no'}</span></p>
              <p className="text-xs text-slate-300">Participants: <span className="text-white">{participants.length}</span></p>
              <p className="text-xs text-slate-300">Sentiments logged: <span className="text-white">{sentiments.length}</span></p>
              <p className="text-xs text-slate-300">Alerts fired: <span className="text-white">{alerts.length}</span></p>
              <details className="mt-1">
                <summary className="text-xs text-slate-500 cursor-pointer">Last sentiment payload</summary>
                <pre className="text-xs text-slate-400 mt-1 whitespace-pre-wrap break-all">
                  {JSON.stringify(sentiments[sentiments.length - 1] || {}, null, 2)}
                </pre>
              </details>
            </section>
          )}
        </div>

        {/* Right column — alert feed */}
        <div className="w-80 shrink-0 border-l border-border flex flex-col p-4 overflow-hidden">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Agent alerts ({alerts.length})
          </h2>
          <AlertFeed alerts={alerts} />
        </div>
      </main>
    </div>
  );
}
