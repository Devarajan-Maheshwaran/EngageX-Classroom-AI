import { useState, useEffect } from 'react';
import { mockParticipants } from '../data/mockParticipants';
import TopBar from '../components/meeting/TopBar';
import VideoGrid from '../components/meeting/VideoGrid';
import ControlBar from '../components/meeting/ControlBar';
import ChatPanel from '../components/meeting/ChatPanel';
import ParticipantsPanel from '../components/meeting/ParticipantsPanel';
import ActiveSpeakerBar from '../components/meeting/ActiveSpeakerBar';

const defaultMessages = [
  { id: 1, senderId: '2', senderName: 'Priya Sharma', text: 'Good morning everyone!', ts: Date.now() - 120000, isLocal: false },
  { id: 2, senderId: '3', senderName: 'Arjun Nair',   text: 'Can everyone hear me ok?', ts: Date.now() - 90000, isLocal: false },
  { id: 3, senderId: 'local', senderName: 'You',      text: 'Yes, all good!', ts: Date.now() - 60000, isLocal: true },
];

export default function MeetingRoom() {
  const [participants, setParticipants] = useState(mockParticipants);
  const [isMuted, setIsMuted]           = useState(false);
  const [isCameraOff, setIsCameraOff]   = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [sidePanel, setSidePanel]       = useState(null); // null | 'chat' | 'participants'
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages]       = useState(defaultMessages);
  const [chatInput, setChatInput]             = useState('');
  const [isTileView, setIsTileView]           = useState(true); // true=gallery, false=spotlight

  // Active Speaker simulation (Cycles every 5 seconds among non-muted people)
  useEffect(() => {
    const interval = setInterval(() => {
      setParticipants((prev) => {
        const eligible = prev.filter((p) => !p.isMuted);
        if (!eligible.length) return prev;
        const next = eligible[Math.floor(Math.random() * eligible.length)];
        return prev.map((p) => ({ ...p, isSpeaking: p.id === next.id }));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts: Space to Mute, Escape to close side panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsMuted((prev) => {
          const next = !prev;
          setParticipants((pList) => pList.map((p) => p.isLocal ? { ...p, isMuted: next } : p));
          return next;
        });
      }
      if (e.code === 'Escape') {
        setSidePanel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Control handlers
  const handleMuteToggle = () => {
    setIsMuted((v) => {
      const next = !v;
      setParticipants((prev) => prev.map((p) => p.isLocal ? { ...p, isMuted: next } : p));
      return next;
    });
  };

  const handleCameraToggle = () => {
    setIsCameraOff((v) => {
      const next = !v;
      setParticipants((prev) => prev.map((p) => p.isLocal ? { ...p, isCameraOff: next } : p));
      return next;
    });
  };

  const handleHandToggle = () => {
    setIsHandRaised((v) => {
      const next = !v;
      setParticipants((prev) => prev.map((p) => p.isLocal ? { ...p, handRaised: next } : p));
      return next;
    });
  };

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        senderId: 'local',
        senderName: 'You',
        text: chatInput.trim(),
        ts: Date.now(),
        isLocal: true,
      },
    ]);
    setChatInput('');
  };

  const activeSpeaker = participants.find((p) => p.isSpeaking && !p.isMuted);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#202124] overflow-hidden select-none font-sans relative z-10">
      {/* Top Header */}
      <TopBar participantCount={participants.length} />

      {/* Main viewport area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Speaking Banner Notification */}
          <ActiveSpeakerBar activeSpeaker={activeSpeaker} />

          {/* Videos Grid */}
          <VideoGrid
            participants={participants}
            isTileView={isTileView}
            localMuted={isMuted}
            localCameraOff={isCameraOff}
          />
        </div>

        {/* Side slide-in panel */}
        {sidePanel === 'chat' && (
          <ChatPanel
            messages={chatMessages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={handleSend}
            onClose={() => setSidePanel(null)}
          />
        )}
        {sidePanel === 'participants' && (
          <ParticipantsPanel
            participants={participants}
            onClose={() => setSidePanel(null)}
          />
        )}
      </div>

      {/* Bottom meeting controls bar */}
      <ControlBar
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isHandRaised={isHandRaised}
        isScreenSharing={isScreenSharing}
        isTileView={isTileView}
        activePanel={sidePanel}
        onMuteToggle={handleMuteToggle}
        onCameraToggle={handleCameraToggle}
        onHandToggle={handleHandToggle}
        onShareToggle={() => setIsScreenSharing((v) => !v)}
        onChatToggle={() => setSidePanel((v) => v === 'chat' ? null : 'chat')}
        onParticipantsToggle={() => setSidePanel((v) => v === 'participants' ? null : 'participants')}
        onViewToggle={() => setIsTileView((v) => !v)}
        onLeave={() => window.history.back()}
        participantCount={participants.length}
      />
    </div>
  );
}
