import { useEffect, useRef, useCallback } from 'react';

const PYTHON_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:4001';
const CHUNK_INTERVAL = 5000;

export function useAudioCapture({ sessionId, studentId, studentName, enabled, onTranscript }) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const submitChunk = useCallback(async (blob) => {
    if (!sessionId || !studentId) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const audio_b64 = String(reader.result || '').split(',')[1];
      if (!audio_b64) return;
      try {
        const res = await fetch(`${PYTHON_URL}/api/signals/audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            student_id: studentId,
            student_name: studentName,
            audio_b64,
          }),
        });
        const data = await res.json();
        if (data.transcript && onTranscript) onTranscript(data.transcript);
      } catch {
        // Audio analysis is best-effort.
      }
    };
    reader.readAsDataURL(blob);
  }, [sessionId, studentId, studentName, onTranscript]);

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let tick = null;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          chunksRef.current = [];
          if (!stopped && blob.size > 1000) submitChunk(blob);
        };

        recorder.start();
        tick = setInterval(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            setTimeout(() => {
              if (!stopped && recorder.state === 'inactive') recorder.start();
            }, 0);
          }
        }, CHUNK_INTERVAL);
      })
      .catch(() => {});

    return () => {
      stopped = true;
      if (tick) clearInterval(tick);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled, submitChunk]);
}
