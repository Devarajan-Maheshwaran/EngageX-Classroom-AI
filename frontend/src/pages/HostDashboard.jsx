// HostDashboard.jsx — Phase 5A / emoji-free (Phase 5A.1)
// All emojis replaced with Lucide icons.
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Home, Bug } from 'lucide-react';
import { useMeetingSocket }  from '../hooks/useMeetingSocket';
import SessionHeader        from '../components/SessionHeader';
import ParticipantGrid      from '../components/ParticipantGrid';
import SentimentTimeline    from '../components/SentimentTimeline';
import AlertFeed            from '../components/AlertFeed';
import SummaryDrawer        from '../components/SummaryDrawer';

export default function HostDashboard() {
  const [searchParams] = useSearchParams();
  const sessionId      = searchParams.get('sessionId') || '';
  const debug          = searchParams.get('debug') === '1';

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const {
    participants, alerts, sentiments,
    connected, sessionError, roomMood,
    endSession,
  } = useMeetingSocket({ role: 'teacher', sessionId, name: 'Host' });

  const handleEndSession = async () => {
    endSession();
    setIsSummaryOpen(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/session/${sessionId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to load summary', err);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:4001'}/api/report/generate-pdf/${sessionId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.reports && data.reports.length > 0) {
          // Trigger download of the first report or a combined report
          // Note: In real app, you might download a zip or multiple. Let's just download the first one.
          const studentId = data.reports[0].student_id;
          window.open(`${import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:4001'}/api/report/pdf/${sessionId}/${studentId}`, '_blank');
        }
      }
    } catch (err) {
      console.error('Failed to generate PDF', err);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 gap-2">
        No session ID.
        <Link to="/" className="flex items-center gap-1 text-brand underline">
          <Home size={14} /> Go home
        </Link>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
        <Home size={40} className="text-slate-600" />
        <p className="text-white">{sessionError}</p>
        <Link to="/" className="text-brand underline text-sm">Back to home</Link>
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
        onEnd={handleEndSession}
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
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <Bug size={13} /> Debug
              </p>
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

      <SummaryDrawer 
        isOpen={isSummaryOpen} 
        onClose={() => setIsSummaryOpen(false)}
        summaryData={summaryData}
        onDownloadPdf={handleDownloadPdf}
      />
    </div>
  );
}
