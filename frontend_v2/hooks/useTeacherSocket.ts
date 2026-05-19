/**
 * useTeacherSocket.ts — Phase 10
 *
 * Teacher-side Socket.IO hook.
 * Joins the teacher room and listens for:
 *   - engagement_update : full class snapshot every 15s
 *   - alert             : actionable alert for a specific student
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export interface StudentSnapshot {
  student_id:     string;
  fused_score:    number;
  primary_signal: string;
  alert_level:    'none' | 'watch' | 'intervene';
  alert_reason:   string;
  summary:        string;
  raw_scores:     { text: number | null; vision: number | null; audio: number | null };
}

export interface EngagementUpdate {
  session_id: string;
  students:   StudentSnapshot[];
  timestamp:  string;
}

export interface AlertEvent {
  student_id:   string;
  alert_level:  'watch' | 'intervene';
  alert_reason: string;
  fused_score:  number;
  summary:      string;
  timestamp:    string;
}

export function useTeacherSocket(sessionId: string) {
  const socketRef    = useRef<Socket | null>(null);
  const [connected,  setConnected]  = useState(false);
  const [classState, setClassState] = useState<StudentSnapshot[]>([]);
  const [alerts,     setAlerts]     = useState<AlertEvent[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(BACKEND, { transports: ['websocket'], autoConnect: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_session', { session_id: sessionId, role: 'teacher' });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('engagement_update', (data: EngagementUpdate) => {
      setClassState(data.students ?? []);
    });

    socket.on('alert', (data: AlertEvent) => {
      setAlerts((prev) => [data, ...prev].slice(0, 20));
    });

    return () => {
      socket.emit('leave_session', { session_id: sessionId, role: 'teacher' });
      socket.disconnect();
    };
  }, [sessionId]);

  function dismissAlert(index: number) {
    setAlerts((prev) => prev.filter((_, i) => i !== index));
  }

  return { connected, classState, alerts, dismissAlert };
}
