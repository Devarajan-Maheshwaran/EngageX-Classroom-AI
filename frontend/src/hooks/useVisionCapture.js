import { useEffect, useRef, useCallback } from 'react';

const PYTHON_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:4001';
const CAPTURE_INTERVAL_MS = 3000;

export function useVisionCapture({ sessionId, studentId, studentName, videoRef, enabled }) {
  const timerRef = useRef(null);
  const canvasRef = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null);

  const captureFrame = useCallback(async () => {
    if (!enabled || !sessionId || !studentId || document.hidden) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext('2d').drawImage(video, 0, 0, 320, 240);
    const frame_b64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

    try {
      const res = await fetch(`${PYTHON_URL}/api/signals/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
          student_name: studentName,
          frame_b64,
        }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, [enabled, sessionId, studentId, studentName, videoRef]);

  useEffect(() => {
    if (!enabled) return undefined;
    timerRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS);
    captureFrame();
    return () => clearInterval(timerRef.current);
  }, [enabled, captureFrame]);
}
