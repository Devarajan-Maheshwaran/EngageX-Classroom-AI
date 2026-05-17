// ParticipantGrid.jsx — Meet-style participant tiles with intent badge

const SCORE_STATUS = (score) =>
  score >= 70 ? 'engaged' : score >= 35 ? 'passive' : 'silent';

const STATUS_STYLES = {
  engaged: { ring: 'ring-green-500/50',  bg: 'bg-green-900/20',  dot: 'bg-green-400',  bar: 'bg-green-400'  },
  passive: { ring: 'ring-yellow-500/50', bg: 'bg-yellow-900/20', dot: 'bg-yellow-400', bar: 'bg-yellow-400' },
  silent:  { ring: 'ring-red-500/50',    bg: 'bg-red-900/20',    dot: 'bg-red-400',    bar: 'bg-red-400'    },
};

const INTENT_BADGE = {
  confused:   'bg-orange-900/50 text-orange-300 border-orange-700/50',
  frustrated: 'bg-red-900/50    text-red-300    border-red-700/50',
  excited:    'bg-green-900/50  text-green-300  border-green-700/50',
  engaged:    'bg-blue-900/50   text-blue-300   border-blue-700/50',
};

const INTENT_EMOJI = {
  confused: '😕', frustrated: '😤', excited: '🔥', engaged: '👍',
};

function initials(name) {
  return name.split(' ').map((w) => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

function ParticipantTile({ p }) {
  const status = SCORE_STATUS(p.participationScore ?? 100);
  const s      = STATUS_STYLES[status];
  const intent = p.lastIntent || 'engaged';
  const silentMins = Math.floor((p.silentDurationMs || 0) / 60000);

  return (
    <div className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-surface-border ring-2 ${s.ring} ${s.bg} transition-all duration-500`}>
      {/* Status dot */}
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${s.dot}`} />
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full bg-surface-border flex items-center justify-center font-bold text-sm text-white select-none">
        {initials(p.name)}
      </div>
      {/* Name */}
      <span className="text-sm font-medium text-white text-center leading-tight max-w-full truncate">{p.name}</span>
      {/* Intent badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${INTENT_BADGE[intent] || INTENT_BADGE.engaged}`}>
        {INTENT_EMOJI[intent]} {intent}
      </span>
      {/* Score bar */}
      <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
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
      {participants.map((p) => <ParticipantTile key={p.studentId} p={p} />)}
    </div>
  );
}
