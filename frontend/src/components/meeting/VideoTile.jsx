import { Mic, MicOff, Hand, Pin } from 'lucide-react';

const tileGradients = {
  '1': '#5c3e21', // rich dark chocolate
  '2': '#8a6240', // warm cognac
  '3': '#78350f', // amber espresso
  '4': '#451a03', // warm dark sand
  '5': '#7c2d12', // warm terracotta
  '6': '#854d0e', // dark mustard
};

export default function VideoTile({ participant, width, height }) {
  const isSpeaking = participant.isSpeaking && !participant.isMuted;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl group select-none
        ${isSpeaking ? 'ring-4 ring-[#8a6240]' : 'ring-1 ring-white/10'}
        transition-all duration-300
      `}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        background: '#231c15', // warm chocolate-tinted dark tile base
      }}
    >
      {/* === VIDEO SIMULATOR LAYER === */}
      {participant.isCameraOff ? (
        /* Camera Off state - Initial Avatar */
        <div className="absolute inset-0 flex items-center justify-center bg-[#2d251d]">
          <div
            className={`
              ${participant.avatarColor} rounded-full flex items-center justify-center
              text-white font-bold shadow-md select-none transition-all duration-300
              ${height > 180 ? 'w-20 h-20 text-3xl font-serif' : 'w-12 h-12 text-lg font-serif'}
            `}
          >
            {participant.initials}
          </div>
        </div>
      ) : (
        /* Camera On state - Simulated live stream gradient blur */
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${tileGradients[participant.id] || '#451a03'} 0%, #1c0e04 100%)`,
            transform: participant.isLocal ? 'scaleX(-1)' : 'none',
          }}
        />
      )}

      {/* === TOP OVERLAYS === */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
        {/* Hand raised indicator */}
        {participant.handRaised && (
          <div className="bg-amber-600 rounded-full p-1.5 shadow-md flex items-center justify-center animate-bounce">
            <Hand size={12} className="text-white" />
          </div>
        )}

        {/* Pin action on hover */}
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 rounded-full p-1.5 cursor-pointer shadow-md flex items-center justify-center border border-white/10"
          title="Pin participant"
        >
          <Pin size={12} className="text-white" />
        </button>
      </div>

      {/* === BOTTOM TEXT & STATE OVERLAYS === */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-15 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1 rounded-full ${participant.isMuted ? 'bg-[#ea4335]/80' : 'bg-black/30'}`}>
            {participant.isMuted ? (
              <MicOff size={11} className="text-white" />
            ) : (
              <Mic size={11} className="text-white/80" />
            )}
          </div>
          <span className="text-white text-xs font-bold font-sans truncate">
            {participant.name}
            {participant.isLocal ? ' (You)' : ''}
          </span>
        </div>

        {/* Audio bouncing bars - styled matching our warm brand */}
        {isSpeaking && (
          <div className="flex items-end gap-[2px] h-3 shrink-0 pb-[1px]">
            <div className="w-[3px] bg-[#8a6240] rounded-full animate-pulse h-3" style={{ animationDuration: '400ms' }} />
            <div className="w-[3px] bg-[#8a6240] rounded-full animate-pulse h-2" style={{ animationDuration: '500ms', animationDelay: '100ms' }} />
            <div className="w-[3px] bg-[#8a6240] rounded-full animate-pulse h-3.5" style={{ animationDuration: '300ms', animationDelay: '200ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}
