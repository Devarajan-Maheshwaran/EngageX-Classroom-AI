import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  MessageSquare,
  Zap,
} from 'lucide-react';

function IconButton({ icon: Icon, label, active, danger, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-xl transition-colors flex items-center justify-center ${
        danger ? 'bg-red-600 hover:bg-red-700 text-white' :
        active ? 'bg-amber-700 text-white' :
        'bg-white/10 hover:bg-white/20 text-white'
      }`}
      title={label}
    >
      <Icon size={18} />
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function ControlBar({
  isMuted,
  isCameraOff,
  activePanel,
  onToggleMute,
  onToggleCamera,
  onPanelChange,
  isTeacher,
  onLeave,
  participantCount = 0,
}) {
  return (
    <footer className="h-20 bg-[#151515] border-t border-white/10 flex items-center justify-between px-6 shrink-0 relative z-30 select-none">
      <div className="min-w-[220px]">
        <p className="text-white text-sm font-semibold">EngageX Live</p>
        <p className="text-slate-400 text-xs mt-0.5">{participantCount} people</p>
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          icon={isMuted ? MicOff : Mic}
          label={isMuted ? 'Unmute' : 'Mute microphone'}
          danger={isMuted}
          onClick={onToggleMute}
        />
        <IconButton
          icon={isCameraOff ? VideoOff : Video}
          label={isCameraOff ? 'Start camera' : 'Stop camera'}
          danger={isCameraOff}
          onClick={onToggleCamera}
        />
        <button
          onClick={onLeave}
          className="ml-3 flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors uppercase tracking-wider"
        >
          <PhoneOff size={14} />
          Leave
        </button>
      </div>

      <div className="flex items-center gap-2 min-w-[220px] justify-end">
        <IconButton
          icon={Users}
          label="Participants"
          active={activePanel === 'participants'}
          badge={participantCount}
          onClick={() => onPanelChange(activePanel === 'participants' ? null : 'participants')}
        />
        <IconButton
          icon={MessageSquare}
          label="Chat"
          active={activePanel === 'chat'}
          onClick={() => onPanelChange(activePanel === 'chat' ? null : 'chat')}
        />
        {isTeacher && (
          <IconButton
            icon={Zap}
            label="AI Co-pilot"
            active={activePanel === 'ai'}
            onClick={() => onPanelChange(activePanel === 'ai' ? null : 'ai')}
          />
        )}
      </div>
    </footer>
  );
}
