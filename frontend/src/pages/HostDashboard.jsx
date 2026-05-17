import { useSearchParams } from 'react-router-dom';
import { useMeetingSocket }  from '../hooks/useMeetingSocket';
import SessionHeader          from '../components/SessionHeader';
import ParticipantGrid        from '../components/ParticipantGrid';
import SentimentTimeline      from '../components/SentimentTimeline';
import AlertFeed              from '../components/AlertFeed';

// Derive room mood from last 10 sentiment events
function computeMood(sentiments) {
  const recent = sentiments.slice(-10);
  if (!recent.length) return 'neutral';
  const avg = recent.reduce((acc, s) => {
    const score = s.sentiment
      ? (s.sentiment.label === 'POSITIVE' ? s.sentiment.score : 1 - s.sentiment.score)
      : 0.5;
    return acc + score;
  }, 0) / recent.length;
  if (avg >= 0.65) return 'positive';
  if (avg <= 0.38) return 'confused';
  return 'neutral';
}

// Derive engagement breakdown from participant list
function computeStats(participants) {
  const total     = participants.length;
  const engaged   = participants.filter((p) => (p.participationScore ?? 100) >= 70).length;
  const passive   = participants.filter((p) => { const s = p.participationScore ?? 100; return s >= 35 && s < 70; }).length;
  const silent    = participants.filter((p) => (p.participationScore ?? 100) < 35).length;
  return { total, engaged, passive, silent };
}

export default function HostDashboard() {
  const [params]  = useSearchParams();
  const sessionId = params.get('sessionId');

  const { participants, alerts, sentiments, connected, endSession } =
    useMeetingSocket({ role: 'teacher', sessionId, name: 'Host' });

  const mood  = computeMood(sentiments);
  const stats = computeStats(participants);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        No session ID. <a href="/" className="text-brand ml-2 underline">Start one here</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SessionHeader sessionId={sessionId} connected={connected} mood={mood} onEnd={endSession} />

      {/* Quick stats bar */}
      <div className="flex gap-4 px-4 pt-3 pb-1 text-sm">
        {[
          { label: 'Total',   value: stats.total,   color: 'text-gray-400'   },
          { label: 'Engaged', value: stats.engaged,  color: 'text-green-400'  },
          { label: 'Passive', value: stats.passive,  color: 'text-yellow-400' },
          { label: 'Silent',  value: stats.silent,   color: 'text-red-400'    },
          { label: 'Alerts',  value: alerts.length,  color: 'text-brand'      },
        ].map((s) => (
          <div key={s.label} className="bg-surface-card border border-surface-border rounded-xl px-4 py-2 flex flex-col items-center min-w-[70px]">
            <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Left: 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">
              Participants ({participants.length})
            </h2>
            <ParticipantGrid participants={participants} />
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">
              Live Sentiment &amp; Intent
            </h2>
            <SentimentTimeline sentiments={sentiments} />
          </div>
        </div>

        {/* Right: alert feed */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col min-h-[400px]">
          <h2 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">
            AI Alerts
          </h2>
          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
