// AlertFeed.jsx — Phase 5A / emoji-free (Phase 5A.1)
// Lucide icons replace all emojis. AI badge, expand/collapse, relative time.
import { useState } from 'react';
import { UserX, Scale, BrainCircuit, TrendingDown, Bell, ChevronDown, ChevronUp, Sparkles, Tag, Mail } from 'lucide-react';

const TYPE_CONFIG = {
  SILENT_PARTICIPANTS:     { label: 'Silent',    Icon: UserX,        bg: 'bg-blue-500/15',   text: 'text-blue-300',   border: 'border-blue-500/30'   },
  PARTICIPATION_IMBALANCE: { label: 'Imbalance', Icon: Scale,        bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/30' },
  CONFUSION_SPIKE:         { label: 'Confused',  Icon: BrainCircuit, bg: 'bg-rose-500/15',   text: 'text-rose-300',   border: 'border-rose-500/30'   },
  ENGAGEMENT_DROP:         { label: 'Drop',      Icon: TrendingDown, bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  DEFAULT:                 { label: 'Alert',     Icon: Bell,         bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/30'  },
};

function relTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function AlertCard({ alert }) {
  const [expanded, setExpanded] = useState(false);
  const cfg  = TYPE_CONFIG[alert.type] || TYPE_CONFIG.DEFAULT;
  const Icon = cfg.Icon;

  return (
    <div
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 cursor-pointer select-none`}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon size={15} className={`mt-0.5 shrink-0 ${cfg.text}`} />
          <div>
            <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
            <p className="text-sm text-slate-200 leading-snug mt-0.5">{alert.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500">{relTime(alert.receivedAt)}</span>
          {expanded ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
        </div>
      </div>

      {expanded && alert.suggestion && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <Tag size={11} className="text-slate-400" />
            <span className="text-xs text-slate-400">Suggested action</span>
            {alert.suggestionAI
              ? <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30"><Sparkles size={10} /> AI</span>
              : <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/20">suggested</span>
            }
          </div>
          <p className="text-sm text-white leading-relaxed">{alert.suggestion}</p>
        </div>
      )}
    </div>
  );
}

export default function AlertFeed({ alerts }) {
  if (!alerts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-500 gap-2">
        <Mail size={24} className="text-slate-600" />
        <p className="text-xs">No alerts yet. Agents are watching...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px] pr-1">
      {alerts.map((a, i) => (
        <AlertCard key={`${a.type}-${a.receivedAt || i}`} alert={a} />
      ))}
    </div>
  );
}
