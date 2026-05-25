import { Volume2 } from 'lucide-react';

export default function ActiveSpeakerBar({ activeSpeaker }) {
  if (!activeSpeaker || activeSpeaker.isMuted) return null;

  return (
    <div className="h-9 bg-[#8a6240]/10 border-b border-[#8a6240]/30 flex items-center justify-center gap-2 px-4 select-none animate-fade-in relative z-25">
      <Volume2 size={13} className="text-[#8a6240] animate-pulse" />
      <span className="text-[#8a6240] text-xs font-bold uppercase tracking-wider font-sans">
        {activeSpeaker.name} is speaking...
      </span>
      <div className="flex items-end gap-[2px] h-2.5 pb-[1px]">
        <div className="w-[2.5px] bg-[#8a6240] rounded-full animate-pulse h-2.5" style={{ animationDuration: '450ms' }} />
        <div className="w-[2.5px] bg-[#8a6240] rounded-full animate-pulse h-1.5" style={{ animationDuration: '550ms', animationDelay: '80ms' }} />
        <div className="w-[2.5px] bg-[#8a6240] rounded-full animate-pulse h-3" style={{ animationDuration: '350ms', animationDelay: '160ms' }} />
      </div>
    </div>
  );
}
