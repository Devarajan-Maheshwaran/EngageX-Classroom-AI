import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function useMeetingSocket({ role, sessionId, name }) {
  const [participants, setParticipants] = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [sentiments,   setSentiments]   = useState([]);
  const [connected,    setConnected]    = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !role) return;

    const socket = io(BACKEND, {
      query: { role, sessionId, name: name || 'Anonymous' },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Host listeners
    socket.on('room:state', ({ students }) => {
      setParticipants(students || []);
    });

    socket.on('engagement:alert', (alert) => {
      setAlerts((prev) => [{ ...alert, id: Date.now() }, ...prev].slice(0, 50));
    });

    socket.on('sentiment:update', (payload) => {
      setSentiments((prev) => [...prev, { ...payload, id: Date.now() }].slice(-120));
    });

    // Participant listeners: update grid immediately on join/leave without waiting for 10s broadcast
    socket.on('participant:joined', ({ participantId, name: n }) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.studentId === participantId)) return prev;
        return [
          ...prev,
          { studentId: participantId, name: n, messageCount: 0, participationScore: 100, silentDurationMs: 0 },
        ];
      });
    });

    socket.on('participant:left', ({ participantId }) => {
      setParticipants((prev) => prev.filter((p) => p.studentId !== participantId));
    });

    // Ask for immediate snapshot on connect
    socket.emit('request:state');

    return () => socket.disconnect();
  }, [role, sessionId, name]);

  const sendMessage = (text) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('student:message', { text });
    }
  };

  const endSession = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('session:end');
    }
  };

  return { participants, alerts, sentiments, connected, sendMessage, endSession };
}
