/**
 * useQuizSocket.ts — Phase 11
 *
 * Listens on the student Socket.IO connection for quiz_push events.
 * Returns the current active quiz payload (null if none).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { QuizPayload } from '@/components/student/QuizWidget';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

export function useQuizSocket(sessionId: string, studentId: string) {
  const socketRef = useRef<Socket | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<QuizPayload | null>(null);

  useEffect(() => {
    if (!sessionId || !studentId) return;
    const socket = io(BACKEND, { transports: ['websocket'], autoConnect: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_session', {
        session_id: sessionId,
        role: 'student',
        student_id: studentId,
      });
    });

    socket.on('quiz_push', (payload: QuizPayload) => {
      setActiveQuiz(payload);
    });

    return () => {
      socket.emit('leave_session', { session_id: sessionId, role: 'student', student_id: studentId });
      socket.disconnect();
    };
  }, [sessionId, studentId]);

  function dismissQuiz() {
    setActiveQuiz(null);
  }

  return { activeQuiz, dismissQuiz };
}
