/**
 * VisionPipeline.tsx — Phase 7
 *
 * React wrapper for the VisionPipeline class.
 * Shows a small live camera preview (mirrored) with expression overlay.
 * Student can toggle camera on/off.
 * Raw video NEVER leaves the browser.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { VisionPipeline as VP, type VisionFrame } from '@/lib/vision';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

const EXPRESSION_EMOJI: Record<string, string> = {
  neutral:   '😐',
  happy:     '😄',
  surprised: '😮',
  sad:       '😢',
  angry:     '😠',
  fearful:   '😨',
  disgusted: '🤢',
  none:      '❓',
};

interface VisionPipelineProps {
  sessionId: string;
  studentId: string;
}

export default function VisionPipelineComponent({ sessionId, studentId }: VisionPipelineProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const pipeRef    = useRef<VP | null>(null);
  const [active,   setActive]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [lastFrame, setLastFrame] = useState<VisionFrame | null>(null);

  async function startCamera() {
    if (!videoRef.current) return;
    setLoading(true);
    setError('');
    try {
      const pipeline = new VP({
        sessionId,
        studentId,
        backendUrl: API,
        onFrame: (frame) => setLastFrame(frame),
      });
      await pipeline.start(videoRef.current);
      pipeRef.current = pipeline;
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access denied');
    } finally {
      setLoading(false);
    }
  }

  function stopCamera() {
    pipeRef.current?.stop();
    pipeRef.current = null;
    setActive(false);
    setLastFrame(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => pipeRef.current?.stop(), []);

  return (
    <div className="w-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">📷 Face tracking</span>
          {active && lastFrame && (
            <span className="text-base" title={lastFrame.expression}>
              {EXPRESSION_EMOJI[lastFrame.expression] ?? '😐'}
            </span>
          )}
        </div>
        <button
          onClick={active ? stopCamera : startCamera}
          disabled={loading}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            active
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100'
          } disabled:opacity-50`}
        >
          {loading ? 'Loading…' : active ? 'Stop camera' : 'Enable camera'}
        </button>
      </div>

      {/* Video preview */}
      <div className={`relative rounded-xl overflow-hidden bg-gray-900 ${ active ? 'h-36' : 'h-0' } transition-all duration-300`}>
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {active && lastFrame && (
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {lastFrame.faceDetected
              ? `${lastFrame.expression} · eyes ${Math.round(lastFrame.eyeOpenRatio * 100)}%`
              : 'No face detected'}
          </div>
        )}
        {/* Privacy notice */}
        {active && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            🔒 On-device only
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {!active && !loading && (
        <p className="text-xs text-gray-400 mt-1">
          Optional — enables expression and attention tracking. Video stays in your browser.
        </p>
      )}
    </div>
  );
}
