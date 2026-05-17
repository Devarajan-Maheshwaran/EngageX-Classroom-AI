import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SentimentTimeline({ sentiments }) {
  const data = sentiments.map((s) => ({
    time:  formatTime(s.ts),
    score: s.label === 'POSITIVE' ? parseFloat((s.score * 100).toFixed(1)) : parseFloat(((1 - s.score) * 100).toFixed(1)),
    name:  s.name,
    label: s.label,
  }));

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-28 text-gray-600 text-sm">
        Waiting for participant messages…
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#3b3b52" />
        <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#2a2a3e', border: '1px solid #3b3b52', borderRadius: 10 }}
          labelStyle={{ color: '#9ca3af', fontSize: 11 }}
          formatter={(v, _, { payload }) => [
            `${v}% ${payload.label === 'POSITIVE' ? '😊' : '😕'}`,
            payload.name,
          ]}
        />
        <ReferenceLine y={50} stroke="#4b5563" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#sentGrad)"
          dot={{ fill: '#6366f1', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
