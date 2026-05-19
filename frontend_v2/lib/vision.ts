/**
 * lib/vision.ts — Phase 7
 *
 * Browser-side face analysis using face-api.js.
 * All processing is LOCAL — raw video frames NEVER leave the browser.
 * Sends only aggregated metrics to backend every EMIT_INTERVAL_MS.
 *
 * Metrics collected per interval:
 *   - face_present_ratio    : fraction of frames a face was detected
 *   - dominant_expression   : most frequent expression across frames
 *   - looking_away_ratio    : estimated from face pose (leftRight deviation)
 *   - eye_open_ratio        : from landmarks eye-aspect-ratio
 *   - engagement_score      : weighted formula
 *
 * face-api.js CDN models are loaded from jsdelivr (no bundling needed).
 */

import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';
const EMIT_INTERVAL_MS = 10_000; // send aggregated signal every 10s
const SAMPLE_INTERVAL_MS = 300;  // sample from video every 300ms

export interface VisionFrame {
  faceDetected: boolean;
  expression: string;
  lookingAway: boolean;
  eyeOpenRatio: number; // 0-1
}

export interface VisionSignal {
  session_id:          string;
  student_id:          string;
  face_present_ratio:  number;
  dominant_expression: string;
  looking_away_ratio:  number;
  eye_open_ratio:      number;
  engagement_score:    number;
}

const EXPRESSION_ORDER = [
  'neutral', 'happy', 'surprised', 'sad', 'angry', 'fearful', 'disgusted',
];

const EXPRESSION_ENGAGEMENT: Record<string, number> = {
  neutral:   60,
  happy:     85,
  surprised: 70,
  sad:       30,
  angry:     20,
  fearful:   25,
  disgusted: 15,
};

let modelsLoaded = false;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

function getDominantExpression(expressions: faceapi.FaceExpressions): string {
  let max = -1;
  let label = 'neutral';
  for (const key of EXPRESSION_ORDER) {
    const val = (expressions as Record<string, number>)[key] ?? 0;
    if (val > max) { max = val; label = key; }
  }
  return label;
}

function getEyeOpenRatio(landmarks: faceapi.FaceLandmarks68): number {
  // Eye Aspect Ratio (EAR) for left and right eye
  function ear(pts: faceapi.Point[]) {
    const A = Math.abs(pts[1].y - pts[5].y);
    const B = Math.abs(pts[2].y - pts[4].y);
    const C = Math.abs(pts[0].x - pts[3].x);
    return C === 0 ? 0 : (A + B) / (2 * C);
  }
  const leftEAR  = ear(landmarks.getLeftEye());
  const rightEAR = ear(landmarks.getRightEye());
  // normalize roughly: typical open eye EAR ~0.27, closed ~0.10
  const raw = (leftEAR + rightEAR) / 2;
  return Math.min(1, Math.max(0, (raw - 0.08) / 0.22));
}

function getLookingAway(box: faceapi.Box, videoWidth: number): boolean {
  // Approximate: if face center X deviates from video center by >30%, classify as looking away
  const faceCenterX = box.x + box.width / 2;
  const deviation   = Math.abs(faceCenterX - videoWidth / 2) / (videoWidth / 2);
  return deviation > 0.3;
}

function computeEngagementScore(signal: Omit<VisionSignal, 'engagement_score' | 'session_id' | 'student_id'>): number {
  let score = EXPRESSION_ENGAGEMENT[signal.dominant_expression] ?? 60;
  score *= signal.face_present_ratio;             // penalize absence
  score -= signal.looking_away_ratio * 30;        // penalize looking away
  score += signal.eye_open_ratio * 15;            // reward alertness
  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

export class VisionPipeline {
  private sessionId:   string;
  private studentId:   string;
  private backendUrl:  string;
  private videoEl:     HTMLVideoElement | null = null;
  private stream:      MediaStream | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private emitTimer:   ReturnType<typeof setInterval> | null = null;
  private frames:      VisionFrame[] = [];
  private onFrame?:    (frame: VisionFrame) => void;

  constructor(opts: {
    sessionId:  string;
    studentId:  string;
    backendUrl: string;
    onFrame?:   (frame: VisionFrame) => void;
  }) {
    this.sessionId  = opts.sessionId;
    this.studentId  = opts.studentId;
    this.backendUrl = opts.backendUrl;
    this.onFrame    = opts.onFrame;
  }

  async start(videoEl: HTMLVideoElement): Promise<void> {
    this.videoEl = videoEl;
    await loadFaceModels();

    this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = this.stream;
    await videoEl.play();

    this.sampleTimer = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
    this.emitTimer   = setInterval(() => this.emit(),   EMIT_INTERVAL_MS);
  }

  stop(): void {
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    if (this.emitTimer)   clearInterval(this.emitTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.frames = [];
  }

  private async sample(): Promise<void> {
    if (!this.videoEl || this.videoEl.readyState < 2) return;
    try {
      const result = await faceapi
        .detectSingleFace(this.videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions()
        .withFaceLandmarks(true);

      if (!result) {
        this.frames.push({ faceDetected: false, expression: 'none', lookingAway: true, eyeOpenRatio: 0 });
        return;
      }

      const expression   = getDominantExpression(result.expressions);
      const eyeOpenRatio = getEyeOpenRatio(result.landmarks);
      const lookingAway  = getLookingAway(result.detection.box, this.videoEl.videoWidth);

      const frame: VisionFrame = { faceDetected: true, expression, lookingAway, eyeOpenRatio };
      this.frames.push(frame);
      this.onFrame?.(frame);
    } catch {
      // ignore individual sample errors
    }
  }

  private async emit(): Promise<void> {
    if (this.frames.length === 0) return;
    const frames = [...this.frames];
    this.frames = [];

    const totalFrames         = frames.length;
    const detectedFrames      = frames.filter((f) => f.faceDetected);
    const face_present_ratio  = Number((detectedFrames.length / totalFrames).toFixed(4));
    const looking_away_count  = frames.filter((f) => f.lookingAway).length;
    const looking_away_ratio  = Number((looking_away_count / totalFrames).toFixed(4));
    const eye_open_ratio      = detectedFrames.length === 0
      ? 0
      : Number((detectedFrames.reduce((s, f) => s + f.eyeOpenRatio, 0) / detectedFrames.length).toFixed(4));

    // Dominant expression: most frequent
    const exprCounts: Record<string, number> = {};
    for (const f of frames) { exprCounts[f.expression] = (exprCounts[f.expression] ?? 0) + 1; }
    const dominant_expression = Object.entries(exprCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

    const partial = { face_present_ratio, dominant_expression, looking_away_ratio, eye_open_ratio };
    const engagement_score = computeEngagementScore(partial);

    const signal: VisionSignal = {
      session_id: this.sessionId,
      student_id: this.studentId,
      ...partial,
      engagement_score,
    };

    try {
      await fetch(`${this.backendUrl}/api/signals/vision`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(signal),
      });
    } catch (err) {
      console.warn('[VisionPipeline] emit failed:', err);
    }
  }
}
