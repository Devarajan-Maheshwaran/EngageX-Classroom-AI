import { useSearchParams } from 'react-router-dom';
import { useMeetingSocket }  from '../hooks/useMeetingSocket';
import SessionHeader          from '../components/SessionHeader';
import ParticipantGrid        from '../components/ParticipantGrid';
import SentimentTimeline      from '../components/SentimentTimeline';
import AlertFeed              from '../components/AlertFeed';

export default function HostDashboard() {
  const [params]  = useSearchParams();
  const sessionId = params.get('sessionId');

  const { participants, alerts, sentiments, connected, endSession } =
    useMeetingSocket({ role: 'teacher', sessionId, name: 'Host' });

  // Derive room mood from last 10 sentiment events
  const recentSentiments = sentiments.slice(-10);
  const mood = (() => {
    if (!recentSentiments.length) return 'neutral';
    const avg = recentSentiments.reduce((a, s) => a + (s.label === 'POSITIVE' ? s.score : 1 - s.score), 0) / recentSentiments.length;
    if (avg >= 0.65) return 'positive';
    if (avg <= 0.4)  return 'confused';
    return 'neutral';
  })();

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        No session ID. <a href="/" className="text-brand ml-2 underline">Go back</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SessionHeader sessionId={sessionId} connected={connected} mood={mood} onEnd={endSession} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Left: participant grid — takes 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              Participants ({participants.length})
            </h2>
            <ParticipantGrid participants={participants} />
          </div>

          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              Live Sentiment
            </h2>
            <SentimentTimeline sentiments={sentiments} />
          </div>
        </div>

        {/* Right: alert feed */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            AI Alerts
          </h2>
          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
