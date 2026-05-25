import { Mic, MicOff, Video, VideoOff, Hand, X } from 'lucide-react';

export default function ParticipantsPanel({ participants, onClose }) {
  return (
    <aside className="w-[360px] h-full flex flex-col bg-[#2d2e30] border-l border-[#3c3c3c] shrink-0 relative z-20 select-none">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#3c3c3c] shrink-0">
        <span className="text-white font-semibold text-sm">People ({participants.length})</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Title section */}
      <div className="px-4 py-3 bg-[#252627]/60 border-b border-[#3c3c3c]/50 text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">
        In this call ({participants.length})
      </div>

      {/* Participants list container */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scroll">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors duration-150 group"
          >
            {/* Avatar circle */}
            <div className={`w-9 h-9 rounded-full ${p.avatarColor} flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0 select-none`}>
              {p.initials}
            </div>

            {/* Name + Sublabels */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {p.name}
                {p.isLocal ? ' (You)' : ''}
              </p>
              {p.handRaised && (
                <span className="text-yellow-400 text-[10px] flex items-center gap-1 mt-0.5 font-bold uppercase tracking-wider animate-pulse">
                  <Hand size={10} /> Hand raised
                </span>
              )}
            </div>

            {/* Right-aligned Mic & Camera status indicators */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`p-1.5 rounded-full ${p.isMuted ? 'bg-[#ea4335]/15 border border-[#ea4335]/25' : 'bg-[#202124]'}`}>
                {p.isMuted ? (
                  <MicOff size={13} className="text-[#ea4335]" />
                ) : (
                  <Mic size={13} className="text-slate-400" />
                )}
              </div>
              <div className={`p-1.5 rounded-full ${p.isCameraOff ? 'bg-[#ea4335]/15 border border-[#ea4335]/25' : 'bg-[#202124]'}`}>
                {p.isCameraOff ? (
                  <VideoOff size={13} className="text-[#ea4335]" />
                ) : (
                  <Video size={13} className="text-slate-400" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
