import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const FEATURES = [
  { icon: '🟢', title: 'Silent Detection', desc: 'Flags participants who haven\'t engaged — without interrupting the call.' },
  { icon: '💬', title: 'Live Sentiment', desc: 'AI reads the emotional tone of chat in real time: confused, frustrated, excited.' },
  { icon: '⚖️', title: 'Participation Balance', desc: 'Tracks who\'s spoken vs. invisible and suggests targeted interventions.' },
  { icon: '🤖', title: 'AI Suggestions', desc: 'Every alert comes with a concrete action you can take in the next 30 seconds.' },
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
      const data = await res.json();
      navigate(`/host?sessionId=${data.sessionId}`);
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="text-brand text-2xl font-bold tracking-tight">EngageX</span>
          <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full font-medium">AI Co-Pilot</span>
        </div>
        <a href="/join" className="text-sm text-gray-400 hover:text-white transition">
          Join a session →
        </a>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 py-20">
        <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-full px-4 py-1.5 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Works alongside Google Meet, Zoom &amp; Teams
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight max-w-3xl">
          The AI engagement layer
          <span className="text-brand"> your calls are missing.</span>
        </h1>

        <p className="text-gray-400 text-lg max-w-xl leading-relaxed">
          Open EngageX alongside your existing call. Participants join with a code.
          EngageX watches engagement signals and surfaces live AI alerts — so no one
          gets left behind silently.
        </p>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <button
            onClick={startSession}
            disabled={loading}
            className="bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-xl transition text-base"
          >
            {loading ? 'Starting…' : '🚀 Start a new session'}
          </button>
          <a
            href="/join"
            className="border border-surface-border hover:border-brand text-gray-300 hover:text-white font-medium px-8 py-3 rounded-xl transition text-base"
          >
            Join as participant
          </a>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full mt-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-surface-card border border-surface-border rounded-2xl p-5 text-left">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center text-xs text-gray-600 py-4">
        EngageX — Agentic AI Classroom Intelligence · Built with Transformers.js · No API keys
      </footer>
    </div>
  );
}
