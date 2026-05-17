// Docs.jsx — Phase 7
// Hackathon-style documentation page for EngageX:
//   Sidebar nav (sticky, scrollspy)
//   Sections: Overview | Problem Statement | Agent Architecture |
//             Build Phases | UI Pages | API Reference | Socket Events |
//             Local Development | Environment Variables
//   Uses SpotlightCard for agent cards, inline CodeBlock for snippets

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, AlertTriangle, BrainCircuit, Layers, Monitor,
  Terminal, Cpu, Zap, FileCode2, CheckCircle2, Circle,
  ChevronRight, BarChart2, Home, ExternalLink,
} from 'lucide-react';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { ShinyText }     from '../components/reactbits/ShinyText';

// ─── mini components ────────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'bash' }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="relative rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">{lang}</span>
        <button onClick={copy} className="text-[10px] text-white/30 hover:text-white/70 transition-colors font-mono">
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>
      <pre className="px-4 py-4 text-xs text-white/70 font-mono overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

function Callout({ type = 'info', children }) {
  const styles = {
    info:    'border-white/20  bg-white/[0.03]  text-white/60',
    warn:    'border-yellow-500/30 bg-yellow-500/[0.05] text-yellow-300/80',
    success: 'border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-300/80',
  };
  const icons = {
    info:    <AlertTriangle size={14} className="text-white/40 flex-shrink-0 mt-0.5" />,
    warn:    <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />,
    success: <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />,
  };
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 my-4 text-xs leading-relaxed ${styles[type]}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, sub }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="section-eyebrow mb-2">{eyebrow}</p>}
      <h2 className="text-2xl md:text-3xl font-black text-white mb-3">{title}</h2>
      {sub && <p className="text-white/40 text-sm leading-relaxed max-w-xl">{sub}</p>}
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto my-4 rounded-xl border border-white/[0.07]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.07]">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-3 text-white/40 font-semibold uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-white/60 font-mono leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── sidebar sections ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',      label: 'Overview',              Icon: BookOpen },
  { id: 'problem',       label: 'Problem Statement',     Icon: AlertTriangle },
  { id: 'agents',        label: 'Agent Architecture',    Icon: BrainCircuit },
  { id: 'phases',        label: 'Build Phases',          Icon: Layers },
  { id: 'ui-pages',      label: 'UI Pages',              Icon: Monitor },
  { id: 'api',           label: 'API Reference',         Icon: FileCode2 },
  { id: 'socket',        label: 'Socket Events',         Icon: Zap },
  { id: 'local-dev',     label: 'Local Development',     Icon: Terminal },
  { id: 'env',           label: 'Environment Variables', Icon: Cpu },
];

// ─── main component ─────────────────────────────────────────────────────────

export default function Docs() {
  const [active, setActive] = useState('overview');
  const sectionRefs = useRef({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) { sectionRefs.current[id] = el; obs.observe(el); }
    });
    return () => obs.disconnect();
  }, []);

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* ── Top nav ─── */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/[0.07] sticky top-0 z-50 bg-[#030712]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-white/40 hover:text-white transition-colors">
            <Home size={15} />
          </Link>
          <ChevronRight size={12} className="text-white/20" />
          <span className="text-white font-semibold text-sm">Documentation</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors">Home</Link>
          <Link
            to="/host"
            className="flex items-center gap-1.5 text-sm bg-white text-[#030712] font-bold px-4 py-1.5 rounded-lg hover:bg-white/90 transition"
          >
            <Monitor size={13} /> Start session
          </Link>
        </div>
      </nav>

      <div className="flex max-w-7xl mx-auto">
        {/* ── Sidebar ─── */}
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-[57px] self-start h-[calc(100vh-57px)] overflow-y-auto py-8 px-4 border-r border-white/[0.06]">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-4 px-2">On this page</p>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-all duration-150 text-left w-full ${
                  active === id
                    ? 'bg-white/[0.07] text-white font-semibold'
                    : 'text-white/35 hover:text-white/70 hover:bg-white/[0.03]'
                }`}
              >
                <Icon size={12} className="flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content ─── */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-12 space-y-20">

          {/* OVERVIEW */}
          <section id="overview">
            <SectionHeader
              eyebrow="What is EngageX"
              title={<ShinyText text="EngageX — Agentic Classroom Engagement Co-Pilot" className="text-2xl md:text-3xl font-black" />}
              sub="Real-time AI agents that detect silent students, confusion spikes, and participation imbalance — and surface actionable suggestions to the host before the moment passes."
            />
            <Callout type="success">
              All sentiment analysis runs locally in-browser via Transformers.js (WebAssembly). Zero paid AI APIs. No student data is ever sent to an external server for AI inference.
            </Callout>
            <Table
              headers={['Layer', 'Technology']}
              rows={[
                ['Frontend',       'Vite + React 18, Tailwind CSS, Lucide Icons, Recharts'],
                ['Realtime',       'Socket.IO v4 (bidirectional, reconnect-aware)'],
                ['AI — Sentiment', 'Transformers.js → Xenova/distilbert-base-uncased-finetuned-sst-2-english (WASM)'],
                ['AI — Suggestions', 'HF Inference API (Mistral-7B) or static fallback — no key needed'],
                ['Backend',        'Node.js + Express, in-memory state machine, configurable agent orchestrator'],
                ['Analytics',      'analyticsService: sentiment log, alert log, cycle history, per-student scores'],
              ]}
            />
          </section>

          {/* PROBLEM STATEMENT */}
          <section id="problem">
            <SectionHeader
              eyebrow="Problem Statement"
              title="The engagement gap in live classrooms"
              sub="Teachers in remote or large hybrid classrooms cannot see who is silently lost. Chat floods are noisy. Analytics tools only show you what went wrong after class."
            />
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { title: 'Silent students', body: 'A student who stops typing is indistinguishable from one who is following along. Without a signal, the teacher never knows.' },
                { title: 'Confusion spikes', body: 'When 40 % of the class sends negative-sentiment messages in a short window, there is a real-time teaching moment — but it is easy to miss.' },
                { title: 'Participation imbalance', body: '3 students dominate the chat while 20 others go invisible. BalancerAgent catches this and suggests direct re-engagement.' },
              ].map(({ title, body }, i) => (
                <SpotlightCard key={i} className="p-5">
                  <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{body}</p>
                </SpotlightCard>
              ))}
            </div>
            <Callout type="warn">
              <strong>Constraints:</strong> Must run with zero paid APIs when HF_API_KEY is unset. Must be demoable on a single laptop with 20+ concurrent Socket.IO connections. Must provide at least three distinct agent behaviours: silence detection, confusion spike detection, and participation imbalance detection.
            </Callout>
          </section>

          {/* AGENT ARCHITECTURE */}
          <section id="agents">
            <SectionHeader
              eyebrow="Agent Architecture"
              title="Three agents, one orchestrator"
              sub="Each agent has a single responsibility. The orchestrator coordinates cycles, deduplicates alerts, and logs every decision."
            />
            <CodeBlock lang="text" code={`backend/services/
  agentOrchestrator.js   # state machine + cycle timer + alert dedup + logging
  monitorAgent.js        # per-cycle: decay scores, detect silence, tag intent
  balancerAgent.js       # every N cycles: detect participation imbalance
  mentorAgent.js         # per-alert: attach human-readable suggestion text
  analyticsService.js    # sentiment log, alert log, cycle history, report builder
  participationService.js# per-student score, message count, intent, joined/left`}
            />
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              {[
                {
                  name: 'MonitorAgent',
                  tag: 'Runs every cycle',
                  Icon: BrainCircuit,
                  desc: 'Decays all participant scores over time. Detects any participant whose score falls below SILENT_THRESHOLD. Tags each message with an intent label (confused / understood / excited / idle). Fires a silence alert with the participant list.',
                },
                {
                  name: 'BalancerAgent',
                  tag: 'Every N cycles (configurable)',
                  Icon: BarChart2,
                  desc: 'Computes the standard deviation of message counts across all active participants. If the top contributor has sent more than IMBALANCE_FACTOR × the median, fires a participation-imbalance alert.',
                },
                {
                  name: 'MentorAgent',
                  tag: 'Attached to every alert',
                  Icon: Sparkles,
                  desc: 'Calls the HF Inference API (Mistral-7B) with a prompt describing the alert type and context. Falls back to a curated static suggestion library when the API key is absent or the call fails.',
                },
                {
                  name: 'Orchestrator',
                  tag: 'Central state machine',
                  Icon: Zap,
                  desc: 'Runs on AGENT_CYCLE_SECS interval. Calls each agent in sequence. Deduplicates alerts within a cooldown window. Emits engagement:alert to all sockets in the session room. Logs every cycle to analyticsService.',
                },
              ].map(({ name, tag, Icon, desc }, i) => (
                <SpotlightCard key={i} className="p-5 flex gap-4">
                  <div className="p-2.5 rounded-xl bg-white/[0.06] w-fit h-fit flex-shrink-0">
                    <Icon size={16} className="text-white/60" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold text-sm">{name}</span>
                      <span className="text-[10px] font-mono text-white/25 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded">{tag}</span>
                    </div>
                    <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </section>

          {/* BUILD PHASES */}
          <section id="phases">
            <SectionHeader
              eyebrow="Development log"
              title="Build phases"
              sub="Seven phases from project scaffold to production-ready landing and docs."
            />
            <Table
              headers={['Phase', 'Status', 'Description']}
              rows={[
                ['Phase 1', '✅ Complete', 'Project scaffold — Vite+React frontend, Express backend, Socket.IO baseline'],
                ['Phase 2', '✅ Complete', 'Sentiment pipeline — Transformers.js DistilBERT WASM, in-browser inference, sentiment score events'],
                ['Phase 3', '✅ Complete', 'Intent classification — confused / understood / excited / idle labels, confusion spike detection'],
                ['Phase 4', '✅ Complete', 'Agent orchestrator — MonitorAgent, BalancerAgent, MentorAgent, cycle timer, alert dedup, cooldowns'],
                ['Phase 5A', '✅ Complete', 'Robustness — reconnect handling, error socket events, max message length, rate limiting'],
                ['Phase 5B', '✅ Complete', 'Session Recap — post-session summary page, sentiment heatmap, participant breakdown, export JSON'],
                ['Phase 6', '✅ Complete', 'Production routing — App.jsx route table, main.jsx entry, NotFound 404 page'],
                ['Phase 7', '✅ Complete', 'Home + Docs pages — Reactbits components (AuroraBackground, ShinyText, SpotlightCard, BlurText, LogoLoop), full hackathon docs'],
              ]}
            />
          </section>

          {/* UI PAGES */}
          <section id="ui-pages">
            <SectionHeader
              eyebrow="Application pages"
              title="UI pages"
              sub="Every route in the application and what it renders."
            />
            <div className="space-y-3">
              {[
                { route: '/',            title: 'Home (Landing)',       desc: 'Marketing landing page with pain-point cards, feature highlights, how-it-works steps, tech stack, and a CTA to create a session.' },
                { route: '/docs',        title: 'Docs',                 desc: 'This page. Full hackathon-spec documentation with sidebar navigation, code snippets, tables, and callouts.' },
                { route: '/host',        title: 'Host Dashboard',       desc: 'Live 2-column view: left panel shows the participant engagement grid with score rings and intent badges; right panel shows the AI alert feed.' },
                { route: '/join',        title: 'Participant Join',      desc: 'Student-facing page. Enter name + session code, connect to the room, send reaction messages, see live sentiment feedback.' },
                { route: '/recap',       title: 'Session Recap',        desc: 'Post-session summary. Duration, stat cards, sentiment heatmap (Recharts bar chart), participant breakdown table, alert log, export JSON.' },
                { route: '*',            title: 'Not Found',            desc: 'Clean 404 page with Go Home and Go Back actions.' },
              ].map(({ route, title, desc }, i) => (
                <div key={i} className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 hover:bg-white/[0.04] transition-all">
                  <code className="text-xs font-mono text-white/30 w-20 flex-shrink-0 pt-0.5">{route}</code>
                  <div>
                    <p className="text-white font-semibold text-sm mb-0.5">{title}</p>
                    <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* API REFERENCE */}
          <section id="api">
            <SectionHeader
              eyebrow="REST API"
              title="API reference"
              sub="All backend HTTP endpoints. Base URL: http://localhost:4000 in development."
            />
            <div className="space-y-6">
              {[
                {
                  method: 'POST', path: '/api/session/create',
                  desc: 'Creates a new live session. Starts the agent orchestrator cycle.',
                  response: `{ sessionId: "AB12CD" }`,
                },
                {
                  method: 'GET', path: '/api/session/:id/state',
                  desc: 'Returns the current live state of a session (participants, scores, recent alerts).',
                  response: `{ participants: [...], recentAlerts: [...], mood: "positive" }`,
                },
                {
                  method: 'GET', path: '/api/session/:id/mood',
                  desc: 'Returns the current overall mood label for the session.',
                  response: `{ mood: "positive" | "negative" | "neutral", score: 0.73 }`,
                },
                {
                  method: 'GET', path: '/api/session/:id/summary',
                  desc: 'Returns the full session report (for recap page). Merges participation data with analytics.',
                  response: `{ sessionId, startedAt, endedAt, totalMessages, totalAlerts,\n  sentimentLog, alertLog, cycleHistory, students }`,
                },
              ].map(({ method, path, desc, response }, i) => (
                <div key={i} className="rounded-xl border border-white/[0.07] overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                    <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded ${
                      method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>{method}</span>
                    <code className="text-sm font-mono text-white/80">{path}</code>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-white/50 text-xs mb-2">{desc}</p>
                    <CodeBlock lang="json" code={response} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SOCKET EVENTS */}
          <section id="socket">
            <SectionHeader
              eyebrow="WebSocket"
              title="Socket.IO events"
              sub="All real-time events. Connect to the same base URL as the REST API."
            />
            <p className="text-white/40 text-xs mb-4 font-semibold uppercase tracking-wider">Client → Server</p>
            <Table
              headers={['Event', 'Payload', 'Description']}
              rows={[
                ['student:message',   '{ sessionId, name, message }', 'Student sends a chat message. Backend scores sentiment + intent and broadcasts updates.'],
                ['session:join',      '{ sessionId, name }',          'Student or host joins a session room.'],
                ['session:end',       '{ sessionId }',                'Host ends the session. Backend stamps endedAt and emits session:ended to all participants.'],
              ]}
            />
            <p className="text-white/40 text-xs mb-4 font-semibold uppercase tracking-wider mt-6">Server → Client</p>
            <Table
              headers={['Event', 'Payload', 'Description']}
              rows={[
                ['room:state',          '{ participants, mood, recentAlerts }', 'Full room state snapshot, emitted on join and after each cycle.'],
                ['sentiment:update',    '{ participantId, score, label }',       'Emitted after each message is scored.'],
                ['engagement:alert',    '{ type, message, suggestion, ts }',     'Emitted by the orchestrator when an agent fires an alert.'],
                ['participant:joined',  '{ name, id }',                          'Broadcast when a new student joins the session.'],
                ['participant:left',    '{ name, id }',                          'Broadcast when a student disconnects.'],
                ['session:ended',       '{ sessionId }',                         'Broadcast to all when the host ends the session.'],
                ['error:session',       '{ message }',                           'Session not found or already ended.'],
                ['error:message',       '{ message }',                           'Message rejected (too long, rate limited, bad format).'],
              ]}
            />
          </section>

          {/* LOCAL DEV */}
          <section id="local-dev">
            <SectionHeader
              eyebrow="Getting started"
              title="Local development"
              sub="Clone the repo, set your environment, and run both servers."
            />
            <CodeBlock lang="bash" code={`# 1. Clone
git clone https://github.com/Devarajan-Maheshwaran/EngageX-Classroom-AI.git
cd EngageX-Classroom-AI

# 2. Backend
cd backend
cp .env.example .env        # edit values as needed
npm install
npm run dev                 # starts on :4000

# 3. Frontend (new terminal)
cd ../frontend
npm install
npm run dev                 # starts on :5173`}
            />
            <Callout type="info">
              The frontend dev server proxies /api and /socket.io to :4000. No CORS configuration is needed in development.
            </Callout>
            <CodeBlock lang="bash" code={`# Production build
cd frontend && npm run build   # outputs to frontend/dist
# Serve frontend/dist with any static host (Vercel, Netlify, nginx)
# Deploy backend to Railway, Render, or any Node.js host`}
            />
          </section>

          {/* ENV VARIABLES */}
          <section id="env">
            <SectionHeader
              eyebrow="Configuration"
              title="Environment variables"
              sub="All variables live in backend/.env. The frontend only needs VITE_BACKEND_URL."
            />
            <Table
              headers={['Variable', 'Default', 'Description']}
              rows={[
                ['PORT',                  '4000',  'Backend HTTP port'],
                ['AGENT_CYCLE_SECS',      '30',    'How often the orchestrator cycle runs (seconds)'],
                ['BALANCER_EVERY_N',      '3',     'Run BalancerAgent every N orchestrator cycles'],
                ['SILENT_THRESHOLD_MINS', '2',     'Minutes of inactivity before a participant is flagged silent'],
                ['CONFUSION_THRESHOLD',   '0.4',   'Fraction of negative messages in a window to trigger confusion alert'],
                ['CONFUSION_WINDOW',      '5',     'Rolling message window size for confusion detection'],
                ['IMBALANCE_FACTOR',      '3',     'Top contributor must be > N × median to trigger imbalance alert'],
                ['ALERT_COOLDOWN_SECS',   '120',   'Minimum seconds between identical alert types'],
                ['MAX_MSG_LEN',           '500',   'Maximum message length (characters). Longer messages are rejected.'],
                ['HF_API_KEY',            '—',     'Optional Hugging Face API key for MentorAgent LLM suggestions. Falls back to static suggestions if absent.'],
                ['VITE_BACKEND_URL',      'http://localhost:4000', '(Frontend .env) Backend base URL for fetch and Socket.IO'],
              ]}
            />
            <CodeBlock lang="bash" code={`# backend/.env
PORT=4000
AGENT_CYCLE_SECS=30
BALANCER_EVERY_N=3
SILENT_THRESHOLD_MINS=2
CONFUSION_THRESHOLD=0.4
CONFUSION_WINDOW=5
IMBALANCE_FACTOR=3
ALERT_COOLDOWN_SECS=120
MAX_MSG_LEN=500
HF_API_KEY=          # optional

# frontend/.env
VITE_BACKEND_URL=http://localhost:4000`}
            />
          </section>

        </main>
      </div>
    </div>
  );
}
