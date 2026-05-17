// ParticipantGrid.jsx — Meet-style participant tiles
// Green ≥ 70, Yellow 35–69, Red < 35 (participationScore)

function scoreToStatus(score) {
  if (score >= 70) return 'engaged';
  if (score >= 35) return 'passive';
  return 'silent';
}

const STATUS_STYLES = {
  engaged: { ring: 'ring-green-500/60',  bg: 'bg-green-900/20',  dot: 'bg-green-400',  label: 'Engaged'  },
  passive: { ring: 'ring-yellow-500/60', bg: 'bg-yellow-900/20', dot: 'bg-yellow-400', label: 'Passive'  },
  silent:  { ring: 'ring-red-500/60',    bg: 'bg-red-900/20',    dot: 'bg-red-400',    label: 'Silent'   },
};

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
}

function ParticipantTile({ p }) {
  const status = scoreToStatus(p.participationScore ?? 100);
  const s = STATUS_STYLES[status];
  const silentMins = Math.floor((p.silentDurationMs || 0) / 60000);

  return (
    <div className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-surface-border ring-2 ${s.ring} ${s.bg} transition-all`}>
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-surface-border flex items-center justify-center font-bold text-base text-white">
        {initials(p.name)}
      </div>
      {/* Status dot */}
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${s.dot}`} />
      {/* Name */}
      <span className="text-sm font-medium text-white text-center leading-tight">{p.name}</span>
      {/* Score bar */}
      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ status === 'engaged' ? 'bg-green-400' : status === 'passive' ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${p.participationScore ?? 100}%` }}
        />
      </div>
      {/* Meta */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{p.messageCount || 0} msg{p.messageCount !== 1 ? 's' : ''}</span>
        {silentMins > 1 && <span className="text-red-400">{silentMins}m silent</span>}
      </div>
    </div>
  );
}

export default function ParticipantGrid({ participants }) {
  if (!participants.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
        <span className="text-4xl mb-3">👥</span>
        <p className="text-sm">No participants yet. Share the session code.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
      {participants.map((p) => (
        <ParticipantTile key={p.studentId} p={p} />
      ))}
    </div>
  );
}
