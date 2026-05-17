import { useState } from 'react';

const MOOD_CONFIG = {
  positive: { label: 'Positive',  color: 'bg-green-900/40  text-green-400',  dot: 'bg-green-400'  },
  neutral:  { label: 'Neutral',   color: 'bg-gray-800      text-gray-400',   dot: 'bg-gray-400'   },
  confused: { label: 'Confused',  color: 'bg-yellow-900/40 text-yellow-400', dot: 'bg-yellow-400' },
};

export default function SessionHeader({ sessionId, connected, mood, onEnd }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(sessionId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const m = MOOD_CONFIG[mood] || MOOD_CONFIG.neutral;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-surface-border bg-surface-card">
      {/* Left: brand + session code */}
      <div className="flex items-center gap-4">
        <span className="font-bold text-brand text-lg tracking-tight">EngageX</span>
        <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-lg px-3 py-1.5">
          <span className="text-xs text-gray-400">Code</span>
          <span className="font-mono font-bold text-white tracking-widest">{sessionId}</span>
          <button
            onClick={copyCode}
            className="text-xs text-brand hover:text-white transition ml-1"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Center: share hint */}
      <p className="hidden md:block text-xs text-gray-500">
        Keep your Meet/Zoom call open · Share this code so participants can join EngageX
      </p>

      {/* Right: mood pill + status + end button */}
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${m.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
          Room mood: {m.label}
        </span>
        <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
          connected ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
          {connected ? 'Live' : 'Disconnected'}
        </span>
        <button
          onClick={onEnd}
          className="text-xs bg-red-900/30 hover:bg-red-800/50 text-red-400 px-3 py-1.5 rounded-lg transition border border-red-800/40"
        >
          End session
        </button>
      </div>
    </header>
  );
}
