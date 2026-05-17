// Home.jsx — Phase 7
// Full marketing landing page for EngageX:
//   AuroraBackground, ShinyText, BlurText, SpotlightCard, LogoLoop
//   Sections: Nav | Hero | Pain points | Features | How it works | Tech stack | CTA | Footer
//   Color scheme: pure dark (#030712) + white/slate accents (no colour emojis)

import { useState }       from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Radio, MessageSquare, Scale, Sparkles,
  AlertCircle, Loader2, Monitor, UserPlus, BrainCircuit,
  WifiOff, ShieldOff, BarChart2,
  ArrowRight, FileCode2, Cpu, Layers, Zap, BookOpen,
} from 'lucide-react';

import { AuroraBackground } from '../components/reactbits/AuroraBackground';
import { ShinyText }        from '../components/reactbits/ShinyText';
import { SpotlightCard }    from '../components/reactbits/SpotlightCard';
import { BlurText }         from '../components/reactbits/BlurText';
import { LogoLoop }         from '../components/reactbits/LogoLoop';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// ─── data ────────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    Icon: WifiOff,
    title: 'Silent students are invisible',
    desc: 'In remote or large classrooms, dozens of participants can be completely disengaged. Without active participation signals, teachers have no way to know.',
  },
  {
    Icon: ShieldOff,
    title: 'Chat floods hide real signals',
    desc: 'A noisy chat thread obscures who is confused, who stopped reading, and who typed "ok" while actually lost.',
  },
  {
    Icon: BarChart2,
    title: 'Post-session data comes too late',
    desc: 'Analytics tools show you what happened after class ends. By then, the confused student has already fallen behind.',
  },
];

const FEATURES = [
  {
    Icon: Radio,
    title: 'Silent Detection',
    desc: 'MonitorAgent tracks every participant score and fires an alert the moment someone goes quiet for too long — without interrupting the session.',
    tag: 'Agent-powered',
  },
  {
    Icon: MessageSquare,
    title: 'Live Sentiment',
    desc: 'Transformers.js runs DistilBERT locally in-browser. Every message is scored positive or negative in real time — zero API keys required.',
    tag: 'Local AI',
  },
  {
    Icon: Scale,
    title: 'Participation Balance',
    desc: 'BalancerAgent runs every N cycles to detect when top participants are dominating. It surfaces targeted suggestions to re-involve quiet voices.',
    tag: 'Agent-powered',
  },
  {
    Icon: Sparkles,
    title: 'AI Suggestions',
    desc: 'MentorAgent attaches a concrete next action to every alert: "Ask a direct question to the silent group" or "Slow down — 40 % are confused."',
    tag: 'LLM fallback',
  },
];

const HOW_IT_WORKS = [
  {
    Icon: Monitor,
    step: '01',
    title: 'Host starts a session',
    desc: 'One click calls POST /api/session/create. The backend starts the agent orchestrator cycle and returns a 6-character session code.',
  },
  {
    Icon: UserPlus,
    step: '02',
    title: 'Participants join',
    desc: 'Students open /join on any device, enter their name and the code. Socket.IO connects them; no accounts or installs required.',
  },
  {
    Icon: BrainCircuit,
    step: '03',
    title: 'AI agents watch in real time',
    desc: 'Every message triggers sentiment + intent scoring. Agents fire deduped alerts with suggestions directly into the host dashboard.',
  },
];

const TECH_STACK = [
  { label: 'Transformers.js (WASM)', detail: 'DistilBERT sentiment runs entirely in-browser via WebAssembly. No data leaves the device for any AI operation.' },
  { label: 'Socket.IO', detail: 'Bidirectional real-time messaging between host, participants, and the agent orchestrator — sub-100 ms latency.' },
  { label: 'Node.js Agent Orchestrator', detail: 'MonitorAgent, BalancerAgent, and MentorAgent run on a configurable cycle timer with cooldowns and alert deduplication.' },
  { label: 'Recharts', detail: 'Session recap sentiment heatmap — 1-minute bucketed bar charts showing when confusion spiked across the session.' },
];

const LOGO_ITEMS = [
  { label: 'Transformers.js', Icon: Cpu },
  { label: 'Socket.IO',       Icon: Zap },
  { label: 'React + Vite',    Icon: Layers },
  { label: 'Node.js',         Icon: FileCode2 },
  { label: 'Recharts',        Icon: BarChart2 },
  { label: 'Tailwind CSS',    Icon: Sparkles },
];

// ─── component ───────────────────────────────────────────────────────────────

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
      setError(err.message.includes('fetch') ? 'Could not reach the server. Is the backend running?' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuroraBackground>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/[0.07] sticky top-0 z-50 bg-[#030712]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-white text-xl font-black tracking-tight">EngageX</span>
          <span className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-medium border border-white/10">AI Co-Pilot</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/docs" className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1">
            <BookOpen size={13} /> Docs
          </Link>
          <Link to="/join" className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-1">
            Join session <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 text-center max-w-4xl mx-auto fade-in-section">
        <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/10 px-4 py-1.5 rounded-full text-xs text-white/50 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Zero paid AI APIs. All sentiment runs locally in-browser.
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-4">
          <BlurText text="Real-time AI engagement" className="justify-center" animateBy="words" direction="top" />
          <br />
          <ShinyText text="for every classroom." className="text-5xl md:text-7xl font-black mt-1" />
        </h1>

        <p className="text-white/50 text-lg max-w-2xl mx-auto mt-6 mb-4 leading-relaxed">
          EngageX runs alongside your existing video call. Participants join with a 6-character code.
          AI agents detect silent students, confusion spikes, and participation imbalance in real time
          — surfacing concrete suggestions before the moment passes.
        </p>
        <p className="text-white/25 text-sm max-w-xl mx-auto mb-10">
          Works alongside Google Meet, Zoom and Teams. No browser extension. No account required for participants.
        </p>

        {error && (
          <div className="flex items-center justify-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2 mb-6 max-w-md mx-auto">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={startSession}
            disabled={loading}
            className="flex items-center gap-2 bg-white text-[#030712] hover:bg-white/90 disabled:opacity-50 font-bold px-8 py-3.5 rounded-xl transition text-sm"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Starting...</>
              : <><Monitor size={15} /> Start a new session</>
            }
          </button>
          <Link
            to="/join"
            className="flex items-center gap-2 border border-white/20 hover:border-white/50 text-white/70 hover:text-white font-medium px-8 py-3.5 rounded-xl transition text-sm"
          >
            <UserPlus size={15} /> Join as participant
          </Link>
          <Link
            to="/docs"
            className="flex items-center gap-2 text-white/40 hover:text-white/70 font-medium px-4 py-3.5 transition text-sm"
          >
            <BookOpen size={15} /> Read the docs
          </Link>
        </div>
      </section>

      {/* ── Pain points ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="section-eyebrow">The problem</p>
          <h2 className="section-title">Why live classrooms fail quietly</h2>
          <p className="section-sub">Engagement gaps are invisible by default. EngageX makes them visible before it is too late.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {PAIN_POINTS.map(({ Icon, title, desc }, i) => (
            <SpotlightCard key={i} className="p-6 group">
              <div className="mb-4 p-2.5 rounded-xl bg-white/[0.06] w-fit group-hover:scale-110 transition-transform duration-300">
                <Icon size={18} className="text-white/70" />
              </div>
              <h3 className="text-white font-bold text-sm mb-2 group-hover:text-white transition-colors">{title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="section-eyebrow">Feature highlights</p>
          <h2 className="section-title">What the agents do</h2>
          <p className="section-sub">Each feature is backed by a dedicated AI agent running on a configurable cycle timer.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {FEATURES.map(({ Icon, title, desc, tag }, i) => (
            <SpotlightCard key={i} className="p-6 group flex gap-4">
              <div className="p-2.5 rounded-xl bg-white/[0.06] w-fit h-fit group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Icon size={18} className="text-white/70" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-white font-bold text-sm">{title}</h3>
                  <span className="text-[10px] font-mono text-white/30 bg-white/[0.05] border border-white/10 px-1.5 py-0.5 rounded">{tag}</span>
                </div>
                <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="section-eyebrow">How to use EngageX</p>
          <h2 className="section-title">Three steps, live in under a minute</h2>
          <p className="section-sub">Host creates a session, participants join, agents take over.</p>
        </div>
        <div className="space-y-4">
          {HOW_IT_WORKS.map(({ Icon, step, title, desc }, i) => (
            <div
              key={i}
              className="flex gap-5 items-start rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] p-5 transition-all duration-300 group"
            >
              <div className="flex-shrink-0 font-black text-2xl text-white/[0.08] w-10 text-right leading-none pt-1 group-hover:text-white/20 transition-colors">{step}</div>
              <div className="p-2.5 rounded-xl bg-white/[0.05] w-fit h-fit flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon size={16} className="text-white/60" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm mb-1">{title}</p>
                <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech stack ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="section-eyebrow">Powered by</p>
          <h2 className="section-title">Modern open-source tech</h2>
          <p className="section-sub mb-8">No proprietary backends. Every component is auditable and self-hostable.</p>
          <LogoLoop items={LOGO_ITEMS} speed={28} gap={72} />
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-10">
          {TECH_STACK.map(({ label, detail }, i) => (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 hover:border-white/[0.14] hover:bg-white/[0.04] transition-all duration-200">
              <p className="text-white font-semibold text-sm mb-1">{label}</p>
              <p className="text-white/40 text-xs leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Ready to see who is struggling?</h2>
        <p className="text-white/35 mb-2 text-sm">No registration. No downloads. Open the host view and share the code.</p>
        <p className="text-white/20 mb-10 text-xs">Participants join from any device on the same link — no account, no install.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={startSession}
            disabled={loading}
            className="flex items-center gap-2 bg-white text-[#030712] hover:bg-white/90 disabled:opacity-50 font-bold px-8 py-3.5 rounded-xl transition text-sm"
          >
            {loading ? <><Loader2 size={15} className="animate-spin" />Starting...</> : <><Monitor size={15} />Start a session now</>}
          </button>
          <Link to="/docs" className="flex items-center gap-2 border border-white/20 hover:border-white/40 text-white/60 hover:text-white font-medium px-8 py-3.5 rounded-xl transition text-sm">
            <BookOpen size={15} /> Read the docs
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-6 px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/20 max-w-6xl mx-auto">
          <span>EngageX — Agentic AI Classroom Intelligence</span>
          <div className="flex items-center gap-4">
            <span>Built with Transformers.js</span>
            <span>No API keys required</span>
            <Link to="/docs" className="hover:text-white/50 transition-colors">Docs</Link>
            <Link to="/join" className="hover:text-white/50 transition-colors">Join session</Link>
          </div>
        </div>
      </footer>
    </AuroraBackground>
  );
}
