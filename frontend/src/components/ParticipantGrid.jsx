// ParticipantGrid.jsx — Phase 5A
// Meet-style participant tiles.
// New in 5A:
//   • Live intent badge per tile (emoji from lastIntentLabel, Phase 3A)
//   • Score ring colour: green ≥ 70, yellow ≥ 40, red < 40
//   • Silent indicator: shows duration if > 60s
//   • "last spoken" dot: blue if messageCount > 0 in session

const INTENT_EMOJI = {
  confused:   '😕',
  frustrated: '😤',
  excited:    '🚀',
  engaged:    '✅',
  bored:      '😴',
};

const INTENT_COLOR = {
  confused:   'text-rose-400',
  frustrated: 'text-orange-400',
  excited:    'text-emerald-400',
  engaged:    'text-blue-400',
  bored:      'text-slate-400',
};

function scoreRing(score) {
  if (score >= 70) return 'ring-emerald-500';
  if (score >= 40) return 'ring-yellow-400';
  return 'ring-rose-500';
}

function formatSilent(ms) {
  if (ms < 60000) return null;
  const mins = Math.floor(ms / 60000);
  return `${mins}m silent`;
}

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
}

function ParticipantTile({ p }) {
  const intent    = p.lastIntentLabel || 'engaged';
  const emoji     = INTENT_EMOJI[intent]  || '✅';
  const intentClr = INTENT_COLOR[intent]  || 'text-blue-400';
  const ring      = scoreRing(p.participationScore ?? 100);
  const silentStr = formatSilent(p.silentDurationMs || 0);

  return (
    <div className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/8 transition-colors">
      {/* Avatar ring — colour = participation score */}
      <div className={`w-14 h-14 rounded-full ring-2 ${ring} flex items-center justify-center bg-slate-700 text-white font-bold text-lg select-none`}>
        {initials(p.name)}
      </div>

      {/* Intent badge — top-right corner */}
      <span
        className={`absolute top-2 right-2 text-base ${intentClr}`}
        title={intent}
      >
        {emoji}
      </span>

      {/* Name */}
      <span className="text-sm font-medium text-white truncate max-w-full">{p.name}</span>

      {/* Score + message count row */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>{p.participationScore ?? 100}pts</span>
        {p.messageCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {p.messageCount} msg{p.messageCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Silent warning */}
      {silentStr && (
        <span className="text-xs text-rose-400 font-medium">{silentStr}</span>
      )}
    </div>
  );
}

export default function ParticipantGrid({ participants }) {
  if (!participants.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
        <span className="text-3xl">👥</span>
        <p className="text-sm">Waiting for participants to join…</p>
        <p className="text-xs">Share the session code above</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {participants.map((p) => (
        <ParticipantTile key={p.studentId} p={p} />
      ))}
    </div>
  );
}
