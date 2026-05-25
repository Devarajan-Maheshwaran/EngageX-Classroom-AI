// useMeetingSocket.js — central socket hook for EngageX
// Phase 5A: consumes all Phase 3A-4B backend fields:
//   sentiment:update  → { label, score, intentLabel, intentScore, allScores }
//   room:state        → { students[].lastIntentLabel, lastIntentScore }
//   engagement:alert  → { type, message, suggestion, suggestionAI }
//   participant:joined → { reconnect: boolean }
//   error:session / error:message / error:auth

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function useMeetingSocket({ role, sessionId, name }) {
  const [participants, setParticipants] = useState([]);
  const [alerts, setAlerts]             = useState([]);
  const [sentiments, setSentiments]     = useState([]);
  const [connected, setConnected]       = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [currentQuiz, setCurrentQuiz]   = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !role) return;

    const socket = io(BACKEND_URL, {
      query:             { role, sessionId, name: name || 'Anonymous' },
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Full participant snapshot (every 10s + on join)
    socket.on('room:state', ({ students }) => {
      setParticipants(students || []);
    });

    // Individual join/leave — reconnect flag from Phase 4B
    socket.on('participant:joined', ({ participantId, name: joinName, reconnect }) => {
      setParticipants((prev) => {
        // On reconnect the room:state will correct the record; just log
        if (reconnect) return prev;
        // Avoid adding duplicates (room:state will populate shortly)
        if (prev.find((p) => p.studentId === participantId)) return prev;
        return [...prev, {
          studentId: participantId, name: joinName,
          messageCount: 0, participationScore: 100,
          lastIntentLabel: 'engaged', lastIntentScore: 0.5,
          silentDurationMs: 0,
        }];
      });
    });

    socket.on('participant:left', ({ participantId }) => {
      setParticipants((prev) => prev.filter((p) => p.studentId !== participantId));
    });

    // Enriched sentiment events (Phase 3A: intentLabel, allScores)
    socket.on('sentiment:update', (payload) => {
      setSentiments((prev) => [...prev, payload].slice(-100)); // keep last 100
    });

    // Alerts with suggestion + AI badge (Phase 3B)
    socket.on('engagement:alert', (alert) => {
      setAlerts((prev) => [{ ...alert, receivedAt: Date.now() }, ...prev].slice(0, 50));
    });

    // Error events from Phase 4B server guards
    socket.on('error:session', ({ message }) => setSessionError(message));
    socket.on('error:auth',    ({ message }) => console.warn('[Socket] Auth error:', message));
    socket.on('error:message', ({ message }) => console.warn('[Socket] Msg error:', message));

    // Session ended by host
    socket.on('session:ended', () => {
      setConnected(false);
      setSessionError('Session has ended.');
    });

    // Quiz events
    socket.on('quiz_start', (quiz) => {
      setCurrentQuiz(quiz);
    });

    socket.on('quiz_response_ack', (ack) => {
      if (ack.student_id === socketRef.current?.id) {
        setCurrentQuiz(null); // hide quiz after answering
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role, sessionId, name]);

  // Participant sends a chat message
  const sendMessage = useCallback((text) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('student:message', { text });
    }
  }, []);

  // Host ends the session
  const endSession = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('session:end');
    }
  }, []);

  // Compute room mood from last 10 sentiments (mirrors backend getRoomMood logic)
  const roomMood = (() => {
    const window = sentiments.slice(-10);
    if (!window.length) return 'neutral';
    let neg = 0, pos = 0;
    window.forEach(({ intentLabel, label }) => {
      if (['confused', 'frustrated', 'bored'].includes(intentLabel)) neg++;
      else if (['excited', 'engaged'].includes(intentLabel) && label === 'POSITIVE') pos++;
    });
    const total = window.length;
    if (neg / total > 0.4) return 'confused';
    if (pos / total > 0.4) return 'positive';
    return 'neutral';
  })();

  return {
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
  };
}
