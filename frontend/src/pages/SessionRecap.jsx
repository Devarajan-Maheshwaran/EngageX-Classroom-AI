// SessionRecap.jsx — Phase 5B
// Full post-session recap page.
// Route: /recap?sessionId=XXXX
//
// Sections:
//   1. Header  — session ID, duration, total messages, alert count
//   2. Participant breakdown table — per-student score, messages, top intent
//   3. Sentiment heatmap — bar chart (positive vs negative counts per minute bucket)
//   4. Alert log — full ordered list with timestamps
//   5. Export — download JSON report
//
// Data source: GET /api/session/:sessionId/summary
// (analyticsService.getSessionReport — already built in Phases 2-4)

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowLeft, Download, Users, MessageSquare,
  Bell, Clock, TrendingUp, TrendingDown,
  CheckCircle, HelpCircle, Zap, Moon, Frown,
  AlertCircle, Trophy,
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const PYTHON_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:4001';

// ─── Intent icon map ────────────────────────────────────────────────────────
const INTENT_ICON = {
  confused:   { Icon: HelpCircle,  color: 'text-rose-400'    },
  frustrated: { Icon: Frown,        color: 'text-orange-400'  },
  excited:    { Icon: Zap,          color: 'text-emerald-400' },
  engaged:    { Icon: CheckCircle,  color: 'text-blue-400'    },
  bored:      { Icon: Moon,         color: 'text-slate-400'   },
};

// ─── Alert type colours ──────────────────────────────────────────────────────
const ALERT_COLOR = {
  SILENT_PARTICIPANTS:     'text-blue-400',
  PARTICIPATION_IMBALANCE: 'text-yellow-400',
  CONFUSION_SPIKE:         'text-rose-400',
  ENGAGEMENT_DROP:         'text-orange-400',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDuration(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ Icon, label, value, sub, color = 'text-brand' }) {
  return (
    <div className="flex items-center gap-3 bg-white/5 border border-border rounded-xl p-4">
      <div className={`${color} shrink-0`}><Icon size={22} /></div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Participant table ───────────────────────────────────────────────────────
function ParticipantTable({ students }) {
  if (!students?.length) {
    return <p className="text-slate-500 text-sm">No participant data.</p>;
  }

  const sorted = [...students].sort((a, b) => (b.participationScore ?? 0) - (a.participationScore ?? 0));

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-white/5">
            <th className="text-left px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">Rank</th>
            <th className="text-left px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">Name</th>
            <th className="text-left px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">Score</th>
            <th className="text-left px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">Messages</th>
            <th className="text-left px-4 py-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">Top intent</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const intent = s.lastIntentLabel || 'engaged';
            const icfg   = INTENT_ICON[intent] || INTENT_ICON.engaged;
            const IntentIcon = icfg.Icon;
            return (
              <tr key={s.studentId || i} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  {i === 0
                    ? <Trophy size={15} className="text-yellow-400" />
                    : <span className="text-slate-400">{i + 1}</span>
                  }
                </td>
                <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                <td className="px-4 py-3">
                  <span className={`font-mono font-bold ${
                    s.participationScore >= 70 ? 'text-emerald-400'
                    : s.participationScore >= 40 ? 'text-yellow-400'
                    : 'text-rose-400'
                  }`}>
                    {s.participationScore ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{s.messageCount ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1.5 ${icfg.color}`}>
                    <IntentIcon size={13} />
                    {intent}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sentiment heatmap bar chart ─────────────────────────────────────────────
function SentimentHeatmap({ sentimentLog }) {
  if (!sentimentLog?.length) {
    return <p className="text-slate-500 text-sm">No sentiment data recorded.</p>;
  }

  // Bucket into 1-minute intervals
  const start = sentimentLog[0]?.ts || 0;
  const buckets = {};

  sentimentLog.forEach(({ ts, label }) => {
    const minBucket = Math.floor((ts - start) / 60000);
    const key = `${minBucket}m`;
    if (!buckets[key]) buckets[key] = { name: key, positive: 0, negative: 0 };
    if (label === 'POSITIVE') buckets[key].positive++;
    else buckets[key].negative++;
  });

  const data = Object.values(buckets);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="positive" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="negative" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Alert log ───────────────────────────────────────────────────────────────
function AlertLog({ alertLog }) {
  if (!alertLog?.length) {
    return <p className="text-slate-500 text-sm">No alerts were fired this session.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {alertLog.map((a, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-border">
          <AlertCircle size={14} className={`mt-0.5 shrink-0 ${ALERT_COLOR[a.type] || 'text-slate-400'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-semibold ${ALERT_COLOR[a.type] || 'text-slate-400'}`}>
                {a.type?.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-500 shrink-0">{fmtTime(a.ts)}</span>
            </div>
            <p className="text-sm text-slate-200 mt-0.5">{a.message}</p>
            {a.suggestion && (
              <p className="text-xs text-slate-400 mt-1 italic">{a.suggestion}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SessionRecap() {
  const [searchParams]  = useSearchParams();
  const sessionId       = searchParams.get('sessionId') || '';
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    async function loadRecap() {
      try {
        const live = await fetch(`${BACKEND_URL}/api/session/${sessionId}/summary`);
        if (live.ok) {
          const data = await live.json();
          if (!data.error) {
            setReport(data);
            return;
          }
        }

        const saved = await fetch(`${PYTHON_URL}/api/report/session/${sessionId}`);
        if (!saved.ok) throw new Error(`HTTP ${saved.status}`);
        const row = await saved.json();
        setReport(row.report_data || row);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadRecap();
  }, [sessionId]);

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `engagex-recap-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Loading / error / no-id states ────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
        <AlertCircle size={36} className="text-slate-600" />
        <p>No session ID provided.</p>
        <Link to="/" className="text-brand underline text-sm">Go home</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <Clock size={20} className="animate-spin mr-2" /> Loading recap...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
        <AlertCircle size={36} className="text-rose-500" />
        <p className="text-white">Failed to load recap: {error}</p>
        <Link to="/" className="text-brand underline text-sm">Go home</Link>
      </div>
    );
  }

  const {
    sessionId: sid,
    startedAt, endedAt,
    totalMessages  = 0,
    totalAlerts    = 0,
    students       = [],
    sentimentLog   = [],
    alertLog       = [],
  } = report || {};

  const duration  = startedAt && endedAt ? endedAt - startedAt : null;
  const posCount  = sentimentLog.filter((s) => s.label === 'POSITIVE').length;
  const negCount  = sentimentLog.length - posCount;
  const posRatio  = sentimentLog.length ? Math.round((posCount / sentimentLog.length) * 100) : 0;
  const topStudent = [...students].sort((a, b) => (b.participationScore ?? 0) - (a.participationScore ?? 0))[0];

  return (
    <div className="min-h-screen bg-bg">
      {/* Page header */}
      <div className="px-6 py-4 bg-surface border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={15} /> Back
          </Link>
          <div className="w-px h-4 bg-border" />
          <h1 className="text-white font-semibold">Session recap</h1>
          <span className="font-mono text-brand text-sm">{sid || sessionId}</span>
        </div>
        <button
          onClick={downloadJSON}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30 transition-colors"
        >
          <Download size={13} /> Export JSON
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-8">

        {/* ── Stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard Icon={Clock}        label="Duration"        value={fmtDuration(duration)} color="text-slate-400" />
          <StatCard Icon={Users}        label="Participants"     value={students.length}       color="text-blue-400" />
          <StatCard Icon={MessageSquare}label="Total messages"  value={totalMessages}          color="text-emerald-400" />
          <StatCard Icon={Bell}         label="Alerts fired"    value={totalAlerts}            color="text-yellow-400" />
        </div>

        {/* ── Sentiment overview ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard Icon={TrendingUp}   label="Positive messages" value={`${posCount} (${posRatio}%)`}           color="text-emerald-400" />
          <StatCard Icon={TrendingDown} label="Negative messages" value={`${negCount} (${100 - posRatio}%)`}     color="text-rose-400" />
          {topStudent && (
            <StatCard Icon={Trophy} label="Top participant" value={topStudent.name}
              sub={`Score: ${topStudent.participationScore}`} color="text-yellow-400" />
          )}
        </div>

        {/* ── Sentiment heatmap ──────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sentiment over time</h2>
          <div className="bg-white/5 border border-border rounded-xl p-4">
            <SentimentHeatmap sentimentLog={sentimentLog} />
          </div>
        </section>

        {/* ── Participant breakdown ──────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Participant breakdown</h2>
          <ParticipantTable students={students} />
        </section>

        {/* ── Alert log ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Alert log ({alertLog.length})
          </h2>
          <AlertLog alertLog={alertLog} />
        </section>

      </div>
    </div>
  );
}
