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

    // Full snapshot every 10s
    socket.on('room:state', ({ students }) => setParticipants(students || []));

    // Agent alerts (with suggestion attached by mentorAgent)
    socket.on('engagement:alert', (alert) =>
      setAlerts((prev) => [{ ...alert, _id: Date.now() + Math.random() }, ...prev].slice(0, 50))
    );

    // Enriched signal: sentiment + intent label per message
    socket.on('sentiment:update', (payload) =>
      setSentiments((prev) => [...prev, { ...payload, _id: Date.now() + Math.random() }].slice(-120))
    );

    // Instant grid updates (no waiting for 10s broadcast)
    socket.on('participant:joined', ({ participantId, name: n }) =>
      setParticipants((prev) =>
        prev.find((p) => p.studentId === participantId)
          ? prev
          : [...prev, { studentId: participantId, name: n, messageCount: 0, participationScore: 100, silentDurationMs: 0, lastIntent: 'engaged' }]
      )
    );
    socket.on('participant:left', ({ participantId }) =>
      setParticipants((prev) => prev.filter((p) => p.studentId !== participantId))
    );

    // Patch participant intent in local state on every sentiment update
    // so participant tiles update their intent badge without waiting for room:state
    socket.on('sentiment:update', ({ participantId, intent }) => {
      if (!intent) return;
      setParticipants((prev) =>
        prev.map((p) =>
          p.studentId === participantId ? { ...p, lastIntent: intent.label } : p
        )
      );
    });

    socket.emit('request:state');
    return () => socket.disconnect();
  }, [role, sessionId, name]);

  const sendMessage = (text) => socketRef.current?.connected && socketRef.current.emit('student:message', { text });
  const endSession  = ()     => socketRef.current?.connected && socketRef.current.emit('session:end');

  return { participants, alerts, sentiments, connected, sendMessage, endSession };
}
