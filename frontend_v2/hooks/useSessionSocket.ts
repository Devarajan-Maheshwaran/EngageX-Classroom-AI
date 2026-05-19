/**
 * useSessionSocket.ts — Phase 4
 *
 * Core hook: connects to the backend Socket.IO server,
 * joins the correct session room, and exposes:
 *   - connected:    boolean
 *   - participants: Participant[]
 *   - socket:       Socket (for emitting custom events in later phases)
 *
 * Used by both teacher dashboard and student session page.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

export interface Participant {
  student_id:   string;
  student_name: string;
  joined_at?:   string;
  engagement_score?: number;
}

interface UseSessionSocketOptions {
  sessionId:  string;
  role:       'teacher' | 'student';
  name:       string;
  studentId?: string;   // required when role === 'student'
}

interface UseSessionSocketReturn {
  connected:    boolean;
  participants: Participant[];
  socket:       Socket | null;
}

export function useSessionSocket({
  sessionId,
  role,
  name,
  studentId,
}: UseSessionSocketOptions): UseSessionSocketReturn {
  const [connected,    setConnected]    = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const handleStudentJoined = useCallback((data: Participant) => {
    setParticipants((prev) => {
      const exists = prev.find((p) => p.student_id === data.student_id);
      return exists ? prev : [...prev, data];
    });
  }, []);

  const handleStudentLeft = useCallback((data: { student_id: string; student_name: string }) => {
    setParticipants((prev) =>
      prev.filter((p) => p.student_id !== data.student_id)
    );
  }, []);

  const handleParticipantList = useCallback((data: { students: Participant[] }) => {
    setParticipants(data.students);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const socket = getSocket();
    socketRef.current = socket;

    // ── Event listeners ──
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    if (role === 'teacher') {
      socket.on('session:student_joined',  handleStudentJoined);
      socket.on('session:student_left',    handleStudentLeft);
      socket.on('session:participant_list', handleParticipantList);
    }

    // ── Connect + join room ──
    if (!socket.connected) {
      socket.connect();
    }

    socket.once('connect', () => {
      socket.emit('session:join', {
        session_id: sessionId,
        student_id: studentId ?? null,
        role,
        name,
      });
    });

    // If already connected when this hook mounts (e.g. re-render)
    if (socket.connected) {
      setConnected(true);
      socket.emit('session:join', {
        session_id: sessionId,
        student_id: studentId ?? null,
        role,
        name,
      });
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('session:student_joined',  handleStudentJoined);
      socket.off('session:student_left',    handleStudentLeft);
      socket.off('session:participant_list', handleParticipantList);
    };
  }, [sessionId, role, name, studentId, handleStudentJoined, handleStudentLeft, handleParticipantList]);

  return { connected, participants, socket: socketRef.current };
}
