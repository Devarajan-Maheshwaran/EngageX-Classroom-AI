// SentimentTimeline.jsx — Phase 5A
// Recharts AreaChart of sentiment scores over time.
// New in 5A:
//   • Dynamic gradient: majority confused/frustrated → red; majority excited/engaged → green
//   • Custom tooltip shows both sentiment label + intentLabel
//   • Second stacked area for intent score (lighter, overlaid)

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, defs, linearGradient, stop,
} from 'recharts';

const INTENT_LABEL_COLOR = {
  confused:   '#f87171', // rose-400
  frustrated: '#fb923c', // orange-400
  excited:    '#34d399', // emerald-400
  engaged:    '#60a5fa', // blue-400
  bored:      '#94a3b8', // slate-400
};

function deriveGradientId(sentiments) {
  if (!sentiments.length) return 'grad-neutral';
  const last10 = sentiments.slice(-10);
  let neg = 0, pos = 0;
  last10.forEach(({ intentLabel, label }) => {
    if (['confused', 'frustrated', 'bored'].includes(intentLabel)) neg++;
    else if (['excited', 'engaged'].includes(intentLabel) && label === 'POSITIVE') pos++;
  });
  const total = last10.length;
  if (neg / total > 0.4) return 'grad-confused';
  if (pos / total > 0.4) return 'grad-positive';
  return 'grad-neutral';
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-white font-medium">{d.name}</p>
      <p className="text-slate-300">"{d.text?.slice(0, 60)}{d.text?.length > 60 ? '…' : ''}"</p>
      <p className="mt-1">
        <span className="text-slate-400">Sentiment: </span>
        <span style={{ color: d.label === 'POSITIVE' ? '#34d399' : '#f87171' }}>
          {d.label} ({(d.score * 100).toFixed(0)}%)
        </span>
      </p>
      <p>
        <span className="text-slate-400">Intent: </span>
        <span style={{ color: INTENT_LABEL_COLOR[d.intentLabel] || '#94a3b8' }}>
          {d.intentLabel} ({(d.intentScore * 100).toFixed(0)}%)
        </span>
      </p>
    </div>
  );
}

export default function SentimentTimeline({ sentiments }) {
  if (!sentiments.length) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
        Waiting for messages to chart sentiment…
      </div>
    );
  }

  // Convert score to 0–100 scale for the chart
  const data = sentiments.map((s) => ({
    ...s,
    sentimentVal: s.label === 'POSITIVE' ? s.score * 100 : (1 - s.score) * 100,
    intentVal:    s.intentScore * 100,
  }));

  const gradId = deriveGradientId(sentiments);

  const gradColors = {
    'grad-positive': { stroke: '#34d399', fill: '#34d399' },
    'grad-confused':  { stroke: '#f87171', fill: '#f87171' },
    'grad-neutral':   { stroke: '#60a5fa', fill: '#60a5fa' },
  };
  const { stroke, fill } = gradColors[gradId];

  return (
    <div>
      <p className="text-xs text-slate-400 mb-2">Sentiment timeline — last {sentiments.length} messages</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={fill} stopOpacity={0.35} />
              <stop offset="95%" stopColor={fill} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="ts" hide />
          <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          {/* Primary: sentiment score */}
          <Area
            type="monotone"
            dataKey="sentimentVal"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: stroke }}
          />
          {/* Secondary: intent confidence (lighter overlay) */}
          <Area
            type="monotone"
            dataKey="intentVal"
            stroke={stroke}
            strokeWidth={1}
            strokeOpacity={0.4}
            fill="none"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
