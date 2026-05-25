import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

export default function TopBar({ participantCount }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function updateClock() {
      const date = new Date();
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      setTime(`${hours}:${minutes} ${ampm}`);
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-[#202124] border-b border-[#3c3c3c] flex items-center justify-between px-6 shrink-0 relative z-30 select-none">
      {/* Left: Recording indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#ea4335]/15 border border-[#ea4335]/30 rounded px-2 py-0.5">
          <span className="w-2 h-2 rounded-full bg-[#ea4335] animate-pulse" />
          <span className="text-[10px] font-bold text-[#ea4335] uppercase tracking-wider">REC</span>
        </div>
        <div className="hidden sm:inline-block w-px h-3 bg-[#3c3c3c] mx-2" />
        <span className="hidden sm:inline-block text-xs font-semibold text-slate-400 font-sans">Host session active</span>
      </div>

      {/* Centre: Meeting title */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
        <span className="text-white text-sm font-semibold tracking-wide font-sans">EngageX Daily</span>
      </div>

      {/* Right: Clock & Participant summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold bg-[#2d2e30] border border-[#3c3c3c] rounded-lg px-2.5 py-1">
          <Users size={12} className="text-[#8a6240]" />
          <span className="font-sans">{participantCount} participants</span>
        </div>
        <span className="text-white text-sm font-medium tabular-nums select-none font-sans">{time}</span>
      </div>
    </header>
  );
}
