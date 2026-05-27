import { useState, useEffect } from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';

const MOOD_LABEL = {
  confused: 'Distressed',
  positive: 'Focused',
  neutral: 'Mixed',
};

export default function TopBar({ sessionId, connected, roomMood = 'neutral', participantCount }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function updateClock() {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-[#151515] border-b border-white/10 flex items-center justify-between px-6 shrink-0 relative z-30 select-none">
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 rounded px-2 py-0.5 border ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="text-[10px] font-bold uppercase tracking-wider">{connected ? 'Live' : 'Offline'}</span>
        </div>
        <span className="hidden sm:inline-block text-xs font-semibold text-slate-400">Session</span>
        <span className="font-mono text-xs text-amber-300">{sessionId}</span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <span className="text-white text-sm font-semibold tracking-wide">EngageX Classroom</span>
        <span className="text-[10px] text-slate-500">{MOOD_LABEL[roomMood] || MOOD_LABEL.neutral}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
          <Users size={12} className="text-amber-400" />
          <span>{participantCount} participants</span>
        </div>
        <span className="text-white text-sm font-medium tabular-nums select-none">{time}</span>
      </div>
    </header>
  );
}
