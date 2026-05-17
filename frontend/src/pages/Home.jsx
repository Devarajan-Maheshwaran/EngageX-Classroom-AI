// Home.jsx — Phase 6
// Landing page:
//   - Nav: logo, AI Co-Pilot badge, "Join a session" link
//   - Hero: headline, subline, two CTAs
//   - Features grid: 4 cards with Lucide icons (no emojis)
//   - How it works: 3-step horizontal flow
//   - Footer
//
// Create session flow:
//   POST /api/session/create → navigate /host?sessionId=XXXX
//   On error: inline error message, button re-enables.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Radio, MessageSquare, Scale, Sparkles,
  ArrowRight, UserPlus, Loader2, AlertCircle,
  Monitor, Users, BrainCircuit,
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const FEATURES = [
  {
    Icon: Radio,
    title: 'Silent Detection',
    desc:  "Flags participants who haven't engaged — without interrupting the call.",
    color: 'text-emerald-400',
    bg:    'bg-emerald-500/10',
  },
  {
    Icon: MessageSquare,
    title: 'Live Sentiment',
    desc:  'AI reads the emotional tone of every message: confused, frustrated, excited.',
    color: 'text-blue-400',
    bg:    'bg-blue-500/10',
  },
  {
    Icon: Scale,
    title: 'Participation Balance',
    desc:  "Tracks who's spoken vs. invisible and surfaces targeted interventions.",
    color: 'text-yellow-400',
    bg:    'bg-yellow-500/10',
  },
  {
    Icon: Sparkles,
    title: 'AI Suggestions',
    desc:  'Every alert comes with a concrete action you can take in the next 30 seconds.',
    color: 'text-violet-400',
    bg:    'bg-violet-500/10',
  },
];

const HOW_IT_WORKS = [
  { Icon: Monitor,     step: '01', title: 'Host starts a session',     desc: 'One click creates a live session and gives you a 6-character code.' },
  { Icon: UserPlus,    step: '02', title: 'Participants join',          desc: 'Students open /join on any device and enter the code. No accounts needed.' },
  { Icon: BrainCircuit,step: '03', title: 'AI watches in real time',   desc: 'Agents detect silence, confusion spikes, and imbalance — and suggest actions instantly.' },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  async function startSession() {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${BACKEND}/api/session/create`, { method: 'POST' });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      navigate(`/host?sessionId=${data.sessionId}`);
    } catch (err) {
      setError(err.message.includes('fetch')
        ? 'Could not reach the server. Is the backend running?'
        : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-brand text-xl font-bold tracking-tight">EngageX</span>
          <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full font-medium">AI Co-Pilot</span>
        </div>
        <Link
          to="/join"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Join a session <ArrowRight size={14} />
        </Link>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-6 pt-20 pb-10 gap-10">

        {/* Live badge */}
        <div className="flex items-center gap-2 bg-white/5 border border-border rounded-full px-4 py-1.5 text-sm text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Works alongside Google Meet, Zoom &amp; Teams
        </div>

        {/* Headline */}
        <div className="text-center max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-white">
            The AI engagement layer
            <span className="text-brand"> your calls are missing.</span>
          </h1>
          <p className="mt-5 text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Open EngageX alongside your existing call. Participants join with a code.
            AI agents watch engagement signals and surface live alerts — so no one
            gets left behind silently.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <button
            onClick={startSession}
            disabled={loading}
            className="flex items-center gap-2 bg-brand hover:opacity-90 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition text-base"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Starting...</>
              : <><Monitor size={16} /> Start a new session</>
            }
          </button>
          <Link
            to="/join"
            className="flex items-center gap-2 border border-border hover:border-brand text-slate-300 hover:text-white font-medium px-8 py-3 rounded-xl transition text-base"
          >
            <UserPlus size={16} /> Join as participant
          </Link>
        </div>

        {/* ── Features grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
          {FEATURES.map(({ Icon, title, desc, color, bg }) => (
            <div key={title} className="bg-white/5 border border-border rounded-2xl p-5 text-left hover:bg-white/8 transition-colors">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${bg} mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <h3 className="font-semibold text-white mb-1">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* ── How it works ────────────────────────────────────────── */}
        <div className="w-full max-w-2xl">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-6">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map(({ Icon, step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center gap-3 p-4 rounded-2xl bg-white/5 border border-border">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand/10 border border-brand/20">
                  <Icon size={18} className="text-brand" />
                </div>
                <span className="text-xs font-mono text-slate-500">{step}</span>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-5 px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>EngageX — Agentic AI Classroom Intelligence</span>
          <div className="flex items-center gap-4">
            <span>Built with Transformers.js</span>
            <span>No API keys required</span>
            <Link to="/join" className="text-slate-500 hover:text-white transition-colors">Join session</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
