const TYPE_CONFIG = {
  SILENT_PARTICIPANTS:    { emoji: '🔇', color: 'border-red-500/40    bg-red-900/20',    badge: 'bg-red-800/50    text-red-300'    },
  PARTICIPATION_IMBALANCE:{ emoji: '⚖️', color: 'border-yellow-500/40 bg-yellow-900/20', badge: 'bg-yellow-800/50 text-yellow-300' },
  CONFUSION_SPIKE:        { emoji: '❓', color: 'border-orange-500/40  bg-orange-900/20', badge: 'bg-orange-800/50  text-orange-300'  },
  MENTOR_SUGGESTION:      { emoji: '🤖', color: 'border-brand/40       bg-brand/10',      badge: 'bg-brand/20       text-brand'       },
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AlertCard({ alert }) {
  const cfg = TYPE_CONFIG[alert.type] || TYPE_CONFIG.MENTOR_SUGGESTION;
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 ${cfg.color}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{cfg.emoji}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {alert.type?.replace(/_/g, ' ')}
          </span>
        </div>
        <span className="text-xs text-gray-600 shrink-0">{formatTime(alert.id)}</span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{alert.message}</p>
      {alert.suggestion && (
        <div className="bg-surface/60 rounded-lg p-2.5 border border-surface-border">
          <p className="text-xs text-gray-400 mb-0.5 font-medium">AI suggestion</p>
          <p className="text-xs text-gray-300 leading-relaxed">{alert.suggestion}</p>
        </div>
      )}
    </div>
  );
}

export default function AlertFeed({ alerts }) {
  if (!alerts.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-gray-600">
        <span className="text-3xl mb-2">🟢</span>
        <p className="text-sm">All clear. Alerts appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide flex-1">
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} />
      ))}
    </div>
  );
}
