/**
 * lib/audio.ts — Phase 8
 *
 * Browser-side Voice Activity Detection (VAD) + audio chunking.
 * Uses the Web Audio API to detect when a student is speaking,
 * then captures 5-second chunks and POSTs them to backend for Whisper.
 *
 * Design decisions:
 *   - Only sends audio when speech is detected (VAD gate, saves bandwidth)
 *   - Uses MediaRecorder with webm/opus for best browser support
 *   - Chunk size: 5000ms
 *   - VAD threshold: RMS energy > 0.01
 *   - Raw audio goes to backend only, never stored on client
 */

const CHUNK_MS         = 5000;
const VAD_THRESHOLD    = 0.012;
const VAD_POLL_MS      = 100;
const MIN_SPEECH_POLLS = 4; // at least 400ms of speech before starting a chunk

export interface AudioChunkResult {
  transcript:      string;
  vocal_energy:    number;
  is_speech:       boolean;
  chunk_duration_ms: number;
}

export class AudioPipeline {
  private sessionId:   string;
  private studentId:   string;
  private backendUrl:  string;
  private stream:      MediaStream | null = null;
  private recorder:    MediaRecorder | null = null;
  private audioCtx:    AudioContext | null = null;
  private analyser:    AnalyserNode | null = null;
  private vadTimer:    ReturnType<typeof setInterval> | null = null;
  private chunkTimer:  ReturnType<typeof setInterval> | null = null;
  private chunks:      Blob[] = [];
  private speechPolls: number = 0;
  private isRecording: boolean = false;
  private onResult?:   (r: AudioChunkResult) => void;

  constructor(opts: {
    sessionId:  string;
    studentId:  string;
    backendUrl: string;
    onResult?:  (r: AudioChunkResult) => void;
  }) {
    this.sessionId  = opts.sessionId;
    this.studentId  = opts.studentId;
    this.backendUrl = opts.backendUrl;
    this.onResult   = opts.onResult;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // Set up Web Audio analyser for VAD
    this.audioCtx = new AudioContext();
    const source  = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    // Start VAD polling
    this.vadTimer = setInterval(() => this._pollVAD(), VAD_POLL_MS);
  }

  stop(): void {
    if (this.vadTimer)   clearInterval(this.vadTimer);
    if (this.chunkTimer) clearInterval(this.chunkTimer);
    this._stopRecorder();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
    this.isRecording  = false;
    this.speechPolls  = 0;
    this.chunks       = [];
  }

  private _getRMS(): number {
    if (!this.analyser) return 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) {
      const n = (v - 128) / 128;
      sum += n * n;
    }
    return Math.sqrt(sum / buf.length);
  }

  private _pollVAD(): void {
    const rms = this._getRMS();
    const isSpeaking = rms > VAD_THRESHOLD;

    if (isSpeaking) {
      this.speechPolls++;
      if (this.speechPolls >= MIN_SPEECH_POLLS && !this.isRecording) {
        this._startChunk();
      }
    } else {
      this.speechPolls = Math.max(0, this.speechPolls - 1);
      if (this.speechPolls === 0 && this.isRecording) {
        // Brief silence — let the current chunk finish naturally
      }
    }
  }

  private _startChunk(): void {
    if (!this.stream) return;
    this.isRecording = true;
    this.chunks = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start(500); // collect blobs every 500ms

    this.chunkTimer = setTimeout(() => this._stopAndSend(), CHUNK_MS);
  }

  private _stopRecorder(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.recorder = null;
    if (this.chunkTimer) { clearTimeout(this.chunkTimer as any); this.chunkTimer = null; }
  }

  private _stopAndSend(): void {
    if (!this.recorder || this.recorder.state === 'inactive') return;
    this.recorder.onstop = async () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      this.chunks       = [];
      this.isRecording  = false;
      this.speechPolls  = 0;
      await this._sendChunk(blob);
    };
    this.recorder.stop();
  }

  private async _sendChunk(blob: Blob): Promise<void> {
    const formData = new FormData();
    formData.append('session_id', this.sessionId);
    formData.append('student_id', this.studentId);
    formData.append('audio', blob, 'chunk.webm');

    try {
      const res = await fetch(`${this.backendUrl}/api/signals/audio`, {
        method: 'POST',
        body:   formData,
      });
      if (!res.ok) { console.warn('[AudioPipeline] backend error', res.status); return; }
      const data: AudioChunkResult = await res.json();
      this.onResult?.(data);
    } catch (err) {
      console.warn('[AudioPipeline] send failed:', err);
    }
  }
}
