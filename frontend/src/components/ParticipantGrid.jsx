// ParticipantGrid.jsx — Phase 5A / emoji-free (Phase 5A.1)
// Lucide icons replace all intent emojis.
import { HelpCircle, Frown, Zap, CheckCircle, Moon, MessageSquare, Clock, Users } from 'lucide-react';

const INTENT_ICON = {
  confused:   { Icon: HelpCircle, color: 'text-rose-400'   },
  frustrated: { Icon: Frown,       color: 'text-orange-400' },
  excited:    { Icon: Zap,         color: 'text-emerald-400'},
  engaged:    { Icon: CheckCircle, color: 'text-blue-400'   },
  bored:      { Icon: Moon,        color: 'text-slate-400'  },
};

function scoreRing(score) {
  if (score >= 70) return 'ring-emerald-500';
  if (score >= 40) return 'ring-yellow-400';
  return 'ring-rose-500';
}

function formatSilent(ms) {
  if (ms < 60000) return null;
  return `${Math.floor(ms / 60000)}m silent`;
}

function initials(name) {
  return name.split(' ').map((w) => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

function ParticipantTile({ p }) {
  const intent    = p.lastIntentLabel || 'engaged';
  const cfg       = INTENT_ICON[intent] || INTENT_ICON.engaged;
  const IntentIcon = cfg.Icon;
  const ring      = scoreRing(p.participationScore ?? 100);
  const silentStr = formatSilent(p.silentDurationMs || 0);

  return (
    <div className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/8 transition-colors">
      {/* Avatar ring — colour = participation score */}
      <div className={`w-14 h-14 rounded-full ring-2 ${ring} flex items-center justify-center bg-slate-700 text-white font-bold text-lg select-none`}>
        {initials(p.name)}
      </div>

      {/* Intent icon — top-right corner */}
      <span className={`absolute top-2 right-2 ${cfg.color}`} title={intent}>
        <IntentIcon size={15} />
      </span>

      {/* Name */}
      <span className="text-sm font-medium text-white truncate max-w-full">{p.name}</span>

      {/* Score + message count */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>{p.participationScore ?? 100}pts</span>
        {p.messageCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare size={10} className="text-blue-400" />
            {p.messageCount}
          </span>
        )}
      </div>

      {/* Silent warning */}
      {silentStr && (
        <span className="flex items-center gap-1 text-xs text-rose-400 font-medium">
          <Clock size={11} /> {silentStr}
        </span>
      )}
    </div>
  );
}

export default function ParticipantGrid({ participants }) {
  if (!participants.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
        <Users size={32} className="text-slate-600" />
        <p className="text-sm">Waiting for participants to join...</p>
        <p className="text-xs">Share the session code above</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {participants.map((p) => <ParticipantTile key={p.studentId} p={p} />)}
    </div>
  );
}
