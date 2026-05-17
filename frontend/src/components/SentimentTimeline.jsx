import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const INTENT_COLOR = {
  confused:   '#f97316',
  frustrated: '#ef4444',
  excited:    '#22c55e',
  engaged:    '#6366f1',
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function CustomDot({ cx, cy, payload }) {
  const color = INTENT_COLOR[payload?.intent?.label] || '#6366f1';
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#1e1e2e" strokeWidth={1.5} />;
}

export default function SentimentTimeline({ sentiments }) {
  const data = sentiments.map((s) => ({
    time:   formatTime(s.ts),
    score:  s.sentiment
              ? (s.sentiment.label === 'POSITIVE'
                  ? parseFloat((s.sentiment.score * 100).toFixed(1))
                  : parseFloat(((1 - s.sentiment.score) * 100).toFixed(1)))
              : 50,
    name:   s.name,
    intent: s.intent,
    label:  s.sentiment?.label,
  }));

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-28 text-gray-600 text-sm">
        Waiting for participant messages…
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#3b3b52" />
        <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
        <ReferenceLine y={50} stroke="#4b5563" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{ background: '#2a2a3e', border: '1px solid #3b3b52', borderRadius: 10 }}
          labelStyle={{ color: '#9ca3af', fontSize: 11 }}
          formatter={(v, _, { payload }) => [
            `${v}% — ${payload.intent?.label || 'unknown'} ${payload.label === 'POSITIVE' ? '😊' : '😕'}`,
            payload.name,
          ]}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#sentGrad)"
          dot={<CustomDot />}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
