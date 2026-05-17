// SessionHeader.jsx — Phase 5A / emoji-free (Phase 5A.1)
// Lucide icons replace all emojis.
import { useState } from 'react';
import { Copy, Check, Wifi, WifiOff, Users, TrendingUp, Minus, AlertCircle, X } from 'lucide-react';

const MOOD_CONFIG = {
  positive: {
    label: 'Room engaged',
    bg: 'bg-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400',
    Icon: TrendingUp,
  },
  neutral: {
    label: 'Room neutral',
    bg: 'bg-slate-500/20', text: 'text-slate-300', dot: 'bg-slate-400',
    Icon: Minus,
  },
  confused: {
    label: 'Room confused',
    bg: 'bg-rose-500/20', text: 'text-rose-300', dot: 'bg-rose-400',
    Icon: AlertCircle,
  },
};

export default function SessionHeader({ sessionId, connected, roomMood, participantCount, onEnd }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const mood = MOOD_CONFIG[roomMood] || MOOD_CONFIG.neutral;
  const MoodIcon = mood.Icon;

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface border-b border-border">
      {/* Left: branding + session code */}
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-white tracking-tight">EngageX</span>
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Code</span>
          <span className="font-mono font-bold text-white text-sm">{sessionId}</span>
          <button
            onClick={copyCode}
            className="ml-1 flex items-center gap-1 text-xs text-brand hover:text-white transition-colors"
            title="Copy session code"
          >
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Centre: room mood pill */}
      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${mood.bg} ${mood.text}`}>
        <span className={`w-2 h-2 rounded-full animate-pulse ${mood.dot}`} />
        <MoodIcon size={14} />
        {mood.label}
      </div>

      {/* Right: status + participants + end */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {connected
            ? <Wifi size={13} className="text-emerald-400" />
            : <WifiOff size={13} className="text-rose-400" />}
          {connected ? 'Live' : 'Offline'}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Users size={13} />
          {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </div>
        {onEnd && (
          <button
            onClick={onEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 transition-colors"
          >
            <X size={12} /> End Session
          </button>
        )}
      </div>
    </header>
  );
}
