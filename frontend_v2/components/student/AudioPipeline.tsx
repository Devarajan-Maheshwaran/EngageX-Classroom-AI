/**
 * AudioPipeline.tsx — Phase 8
 * React wrapper for the AudioPipeline class.
 * Shows mic status, VAD indicator, and latest transcript.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioPipeline as AP, type AudioChunkResult } from '@/lib/audio';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface AudioPipelineProps {
  sessionId: string;
  studentId: string;
}

export default function AudioPipelineComponent({ sessionId, studentId }: AudioPipelineProps) {
  const pipeRef      = useRef<AP | null>(null);
  const [active,     setActive]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [transcripts, setTranscripts] = useState<string[]>([]);

  async function startMic() {
    setLoading(true); setError('');
    try {
      const pipe = new AP({
        sessionId, studentId,
        backendUrl: API,
        onResult: (r: AudioChunkResult) => {
          if (r.transcript) {
            setTranscripts((prev) => [r.transcript, ...prev].slice(0, 5));
          }
        },
      });
      await pipe.start();
      pipeRef.current = pipe;
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    } finally {
      setLoading(false);
    }
  }

  function stopMic() {
    pipeRef.current?.stop();
    pipeRef.current = null;
    setActive(false);
    setTranscripts([]);
  }

  useEffect(() => () => pipeRef.current?.stop(), []);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🎤 Audio tracking</span>
          {active && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-gray-500">Live</span>
            </span>
          )}
        </div>
        <button
          onClick={active ? stopMic : startMic}
          disabled={loading}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            active
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100'
          } disabled:opacity-50`}
        >
          {loading ? 'Starting…' : active ? 'Stop mic' : 'Enable mic'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}

      {!active && !loading && (
        <p className="text-xs text-gray-400">Optional — enables voice activity and speech transcription.</p>
      )}

      {transcripts.length > 0 && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg space-y-1">
          <p className="text-xs font-medium text-gray-400">Recent transcripts</p>
          {transcripts.map((t, i) => (
            <p key={i} className="text-xs text-gray-600 truncate">“{t}”</p>
          ))}
        </div>
      )}
    </div>
  );
}
