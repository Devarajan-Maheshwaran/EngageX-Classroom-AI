import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMeetingSocket } from '../hooks/useMeetingSocket';
import { useVisionCapture } from '../hooks/useVisionCapture';
import { useAudioCapture } from '../hooks/useAudioCapture';
import VideoGrid from '../components/meeting/VideoGrid';
import ControlBar from '../components/meeting/ControlBar';
import TopBar from '../components/meeting/TopBar';
import ChatPanel from '../components/meeting/ChatPanel';
import ParticipantsPanel from '../components/meeting/ParticipantsPanel';
import AIInsightPanel from '../components/meeting/AIInsightPanel';
import QuizOverlay from '../components/meeting/QuizOverlay';
import SummaryDrawer from '../components/SummaryDrawer';
import { ErrorBoundary } from '../components/ErrorBoundary';

function sentimentToScore(sentiment) {
  if (!sentiment) return null;
  const baseByIntent = {
    engaged: 85,
    excited: 90,
    confused: 30,
    frustrated: 20,
    bored: 35,
    neutral: 60,
  };
  const base = baseByIntent[sentiment.intentLabel] ?? 60;
  if (sentiment.label === 'NEGATIVE') return Math.round(base * 0.7);
  if (sentiment.label === 'POSITIVE') return Math.min(100, Math.round(base * 1.1));
  return base;
}

export default function MeetingRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId') || '';
  const role = searchParams.get('role') || 'student';
  const name = searchParams.get('name') || (role === 'teacher' ? 'Teacher' : 'Student');
  const isTeacher = role === 'teacher';

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [panel, setPanel] = useState(isTeacher ? 'ai' : null);
  const [showSummary, setShowSummary] = useState(false);
  const localVideoRef = useRef(null);

  const {
    participants,
    alerts,
    sentiments,
    connected,
    sessionError,
    roomMood,
    currentQuiz,
    setCurrentQuiz,
    sendMessage,
    endSession,
    visionUpdates,
    socketId,
    sendQuizResponse,
  } = useMeetingSocket({ role, sessionId, name });

  useEffect(() => {
    if (isCameraOff) {
      localVideoRef.current?.srcObject?.getTracks().forEach((track) => track.stop());
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      return undefined;
    }

    let streamRef = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        streamRef = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      })
      .catch(() => {});

    return () => {
      streamRef?.getTracks().forEach((track) => track.stop());
    };
  }, [isCameraOff]);

  const localStudentId = isTeacher ? 'teacher-local' : (socketId || 'local');

  useVisionCapture({
    sessionId,
    studentId: localStudentId,
    studentName: name,
    videoRef: localVideoRef,
    enabled: !isTeacher && !isCameraOff && connected,
  });

  useAudioCapture({
    sessionId,
    studentId: localStudentId,
    studentName: name,
    enabled: !isTeacher && !isMuted && connected,
    onTranscript: (text) => sendMessage(text),
  });

  const enrichedParticipants = participants.map((participant) => {
    const lastSentiment = [...sentiments].reverse().find((item) => item.participantId === participant.studentId);
    const vision = visionUpdates[participant.studentId];
    const engagementScore = vision?.engagement_score ?? (lastSentiment ? sentimentToScore(lastSentiment) : participant.participationScore ?? null);
    const recentAlert = alerts.find((alert) => {
      const alertStudentId = alert.studentId || alert.student_id;
      return alertStudentId === participant.studentId && Date.now() - (alert.receivedAt || 0) < 60000;
    });

    return {
      ...participant,
      id: participant.studentId,
      isLocal: false,
      isMuted: false,
      isCameraOff: false,
      isSpeaking: Boolean(lastSentiment && Date.now() - (lastSentiment.ts || 0) < 5000),
      engagementScore,
      emotionLabel: vision?.dominant_emotion ?? lastSentiment?.intentLabel ?? participant.lastIntentLabel ?? 'neutral',
      intentLabel: lastSentiment?.intentLabel ?? participant.lastIntentLabel ?? null,
      alertLevel: recentAlert?.type?.toLowerCase() || null,
      initials: participant.name?.slice(0, 2).toUpperCase() || '??',
      avatarColor: 'bg-amber-800',
    };
  });

  const localVision = visionUpdates[localStudentId];
  const localParticipant = {
    id: localStudentId,
    studentId: localStudentId,
    name,
    isLocal: true,
    isMuted,
    isCameraOff,
    isSpeaking: false,
    engagementScore: localVision?.engagement_score ?? null,
    emotionLabel: localVision?.dominant_emotion ?? 'neutral',
    alertLevel: null,
    initials: name.slice(0, 2).toUpperCase(),
    avatarColor: isTeacher ? 'bg-slate-700' : 'bg-amber-900',
  };

  const allParticipants = [localParticipant, ...enrichedParticipants];

  useEffect(() => {
    if (sessionError === 'Session has ended.') {
      navigate(`/recap?sessionId=${sessionId}`);
    }
  }, [sessionError, navigate, sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center">
        Missing session ID.
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-[#0d0d0d] text-white overflow-hidden">
        <TopBar
          sessionId={sessionId}
          connected={connected}
          roomMood={roomMood}
          participantCount={allParticipants.length}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <VideoGrid participants={allParticipants} localVideoRef={localVideoRef} />

            {!isTeacher && currentQuiz && (
              <QuizOverlay
                quiz={currentQuiz}
                onSubmit={(answerId, answerText) => {
                  sendQuizResponse(currentQuiz.quiz_id, answerId, answerText);
                }}
                onExpire={() => setCurrentQuiz(null)}
              />
            )}
          </div>

          {panel === 'chat' && (
            <ChatPanel sentiments={sentiments} onSend={sendMessage} onClose={() => setPanel(null)} />
          )}
          {panel === 'participants' && (
            <ParticipantsPanel participants={allParticipants} onClose={() => setPanel(null)} />
          )}
          {isTeacher && panel === 'ai' && (
            <AIInsightPanel
              participants={enrichedParticipants}
              alerts={alerts}
              roomMood={roomMood}
              sessionId={sessionId}
              onClose={() => setPanel(null)}
              onEndSession={() => {
                endSession();
                setShowSummary(true);
              }}
            />
          )}
        </div>

        <ControlBar
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          activePanel={panel}
          onToggleMute={() => setIsMuted((muted) => !muted)}
          onToggleCamera={() => setIsCameraOff((off) => !off)}
          onPanelChange={setPanel}
          isTeacher={isTeacher}
          onLeave={() => {
            if (isTeacher) {
              endSession();
              navigate(`/recap?sessionId=${sessionId}`);
            } else {
              navigate('/');
            }
          }}
          participantCount={allParticipants.length}
        />

        {showSummary && (
          <SummaryDrawer isOpen={showSummary} onClose={() => navigate(`/recap?sessionId=${sessionId}`)} />
        )}
      </div>
    </ErrorBoundary>
  );
}
