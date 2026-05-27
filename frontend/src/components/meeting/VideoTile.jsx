import { Mic, MicOff, Hand, Pin, AlertTriangle } from 'lucide-react';

const tileGradients = {
  1: '#3f3528',
  2: '#4f5d4f',
  3: '#5b4b33',
  4: '#3c4658',
  5: '#5a3f45',
  6: '#405059',
};

const EMOTION_LABELS = {
  happy: 'happy',
  surprise: 'surprised',
  neutral: 'neutral',
  sad: 'sad',
  fearful: 'fearful',
  fear: 'fearful',
  angry: 'angry',
  disgusted: 'disgusted',
  disgust: 'disgusted',
  engaged: 'engaged',
  confused: 'confused',
  frustrated: 'frustrated',
  bored: 'bored',
  excited: 'excited',
};

export default function VideoTile({
  participant,
  width,
  height,
  videoRef,
  engagementScore = null,
  emotionLabel = 'neutral',
  alertLevel = null,
}) {
  const isSpeaking = participant.isSpeaking && !participant.isMuted;
  const engagementRingClass =
    alertLevel === 'intervene' ? 'ring-4 ring-red-500 animate-pulse' :
    engagementScore === null ? 'ring-1 ring-white/10' :
    engagementScore >= 70 ? 'ring-2 ring-emerald-500' :
    engagementScore >= 40 ? 'ring-2 ring-amber-400' :
    'ring-2 ring-red-500';

  return (
    <div
      className={`relative overflow-hidden rounded-lg group select-none ${engagementRingClass} transition-all duration-300`}
      style={{ width: `${width}px`, height: `${height}px`, background: '#171717' }}
    >
      {isSpeaking && <div className="absolute inset-1 rounded-md ring-2 ring-inset ring-white/50 z-10 pointer-events-none" />}

      {participant.isCameraOff ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#242424]">
          <div
            className={`${participant.avatarColor || 'bg-slate-700'} rounded-full flex items-center justify-center text-white font-bold shadow-md select-none ${height > 180 ? 'w-20 h-20 text-3xl' : 'w-12 h-12 text-lg'}`}
          >
            {participant.initials}
          </div>
        </div>
      ) : participant.isLocal ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      ) : (
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${tileGradients[participant.id] || '#3f3528'} 0%, #111111 100%)`,
          }}
        />
      )}

      {emotionLabel && (
        <div className="absolute top-2 left-2 z-20 bg-black/65 rounded-full px-2 py-0.5 text-[10px] font-medium text-white flex items-center gap-1 border border-white/10">
          <span className={`w-1.5 h-1.5 rounded-full ${
            engagementScore === null ? 'bg-slate-400' :
            engagementScore >= 70 ? 'bg-emerald-400' :
            engagementScore >= 40 ? 'bg-amber-400' :
            'bg-red-400'
          }`} />
          <span className="capitalize">{EMOTION_LABELS[emotionLabel] || emotionLabel}</span>
          {engagementScore !== null && <span className="text-white/60">{Math.round(engagementScore)}%</span>}
        </div>
      )}

      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
        {alertLevel && (
          <div className="bg-red-600 rounded-full p-1.5 shadow-md flex items-center justify-center">
            <AlertTriangle size={12} className="text-white" />
          </div>
        )}
        {participant.handRaised && (
          <div className="bg-amber-600 rounded-full p-1.5 shadow-md flex items-center justify-center">
            <Hand size={12} className="text-white" />
          </div>
        )}
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 rounded-full p-1.5 cursor-pointer shadow-md flex items-center justify-center border border-white/10"
          title="Pin participant"
        >
          <Pin size={12} className="text-white" />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent z-20 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1 rounded-full ${participant.isMuted ? 'bg-red-600/80' : 'bg-black/30'}`}>
            {participant.isMuted ? <MicOff size={11} className="text-white" /> : <Mic size={11} className="text-white/80" />}
          </div>
          <span className="text-white text-xs font-bold truncate">
            {participant.name}
            {participant.isLocal ? ' (You)' : ''}
          </span>
        </div>

        {isSpeaking && (
          <div className="flex items-end gap-[2px] h-3 shrink-0 pb-[1px]">
            <div className="w-[3px] bg-emerald-400 rounded-full animate-pulse h-3" style={{ animationDuration: '400ms' }} />
            <div className="w-[3px] bg-emerald-400 rounded-full animate-pulse h-2" style={{ animationDuration: '500ms', animationDelay: '100ms' }} />
            <div className="w-[3px] bg-emerald-400 rounded-full animate-pulse h-3.5" style={{ animationDuration: '300ms', animationDelay: '200ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}
