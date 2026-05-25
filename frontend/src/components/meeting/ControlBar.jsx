import { 
  Mic, MicOff,
  Video, VideoOff,
  MonitorUp,
  Hand,
  Smile,
  MoreVertical,
  PhoneOff,
  Users,
  MessageSquare,
  LayoutGrid,
  Layout,
  Settings,
  Info,
} from 'lucide-react';

function ControlButton({ icon: Icon, label, active, danger, highlight, badge, onClick }) {
  return (
    <div className="relative flex flex-col items-center group">
      <button
        onClick={onClick}
        className={`
          relative p-3 rounded-full transition-all duration-150 flex items-center justify-center shadow-sm outline-none
          ${danger    ? 'bg-[#ea4335] hover:bg-[#d93025] text-white border border-transparent' : ''}
          ${highlight ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30' : ''}
          ${!danger && !highlight && active  
              ? 'bg-white/20 text-white hover:bg-white/25 border border-transparent' : ''}
          ${!danger && !highlight && !active 
              ? 'text-slate-300 hover:bg-white/10 hover:text-white border border-[#3c3c3c]' : ''}
        `}
        title={label}
      >
        <Icon size={18} />
        {/* Badge (participant count) */}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] 
                           rounded-full bg-[#8a6240] text-white text-[10px] 
                           font-bold flex items-center justify-center px-1 shadow border border-[#202124]">
            {badge}
          </span>
        )}
      </button>
      {/* Tooltip — appears on hover */}
      <span className="absolute -top-9 left-1/2 -translate-x-1/2 
                       bg-[#3c4043] text-white text-[10px] font-bold rounded-md px-2 py-1 
                       whitespace-nowrap opacity-0 group-hover:opacity-100 
                       transition-opacity pointer-events-none z-50 shadow-md">
        {label}
      </span>
    </div>
  );
}

export default function ControlBar({
  isMuted,
  isCameraOff,
  isHandRaised,
  isScreenSharing,
  isTileView,
  activePanel,
  onMuteToggle,
  onCameraToggle,
  onHandToggle,
  onShareToggle,
  onChatToggle,
  onParticipantsToggle,
  onViewToggle,
  onLeave,
  participantCount,
}) {
  // Simple time formatter for left info
  const date = new Date();
  const formatTime = () => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  return (
    <footer className="h-20 bg-[#202124] border-t border-[#3c3c3c] flex items-center justify-between px-6 shrink-0 relative z-30 select-none">
      {/* LEFT SECTION: meeting info */}
      <div className="flex items-center gap-3 min-w-[240px]">
        <div>
          <p className="text-white text-sm font-semibold">EngageX Daily</p>
          <p className="text-slate-400 text-xs mt-0.5">{formatTime()} · {participantCount} people</p>
        </div>
        <button className="p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center border border-[#3c3c3c]">
          <Info size={16} className="text-slate-300" />
        </button>
      </div>

      {/* CENTER SECTION: meeting core triggers */}
      <div className="flex items-center gap-2">
        <ControlButton
          icon={isMuted ? MicOff : Mic}
          label={isMuted ? 'Unmute' : 'Mute microphone'}
          danger={isMuted}
          onClick={onMuteToggle}
        />
        <ControlButton
          icon={isCameraOff ? VideoOff : Video}
          label={isCameraOff ? 'Start camera' : 'Stop camera'}
          danger={isCameraOff}
          onClick={onCameraToggle}
        />
        <ControlButton
          icon={MonitorUp}
          label={isScreenSharing ? 'Stop presenting' : 'Present now'}
          active={isScreenSharing}
          onClick={onShareToggle}
        />
        <ControlButton
          icon={Hand}
          label={isHandRaised ? 'Lower hand' : 'Raise hand'}
          highlight={isHandRaised}
          onClick={onHandToggle}
        />
        <ControlButton
          icon={Smile}
          label="Send reaction"
          onClick={() => {}}
        />
        <ControlButton
          icon={MoreVertical}
          label="More options"
          onClick={() => {}}
        />

        {/* Red leave button */}
        <button
          onClick={onLeave}
          className="ml-4 flex items-center gap-2 px-5 py-2.5 rounded-full 
                     bg-[#ea4335] hover:bg-[#d93025] text-white font-bold text-xs 
                     transition-colors shadow-md shadow-[#ea4335]/10 shrink-0 uppercase tracking-wider outline-none"
        >
          <PhoneOff size={14} />
          Leave
        </button>
      </div>

      {/* RIGHT SECTION: panel toggles */}
      <div className="flex items-center gap-2 min-w-[240px] justify-end">
        <ControlButton
          icon={Users}
          label="Show participants"
          active={activePanel === 'participants'}
          badge={participantCount}
          onClick={onParticipantsToggle}
        />
        <ControlButton
          icon={MessageSquare}
          label="In-call messages"
          active={activePanel === 'chat'}
          onClick={onChatToggle}
        />
        <ControlButton
          icon={isTileView ? Layout : LayoutGrid}
          label={isTileView ? 'Switch to spotlight' : 'Switch to grid'}
          onClick={onViewToggle}
        />
        <ControlButton
          icon={Settings}
          label="Meeting settings"
          onClick={() => {}}
        />
      </div>
    </footer>
  );
}
