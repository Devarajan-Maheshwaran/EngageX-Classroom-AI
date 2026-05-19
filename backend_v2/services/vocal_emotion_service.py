"""
vocal_emotion_service.py — Phase 9

Extracts vocal emotion from audio using librosa feature engineering.
No ML model download required — rule-based on acoustic features.

Features extracted:
  - pitch (F0) via librosa.yin
  - pitch variability (std dev)
  - speech rate (zero crossing rate)
  - energy (RMS mean)
  - MFCCs (first 13 coefficients, mean)

Emotion mapping heuristic:
  high pitch + high variability + high energy  → excited / anxious
  low pitch  + low energy + low ZCR            → bored / disengaged
  stable mid pitch + moderate energy           → focused / neutral
  rising pitch variability + mid energy        → confused
  very low energy + very low ZCR               → silent (no speech)
"""

import os
import tempfile
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger('engagex.vocal_emotion')


class VocalEmotionService:

    def analyze(self, audio_bytes: bytes) -> dict:
        """
        Synchronous analysis — call from a thread pool in async context.
        Returns:
        {
          emotion:         str   (excited|focused|confused|bored|anxious|neutral)
          emotion_score:   float (confidence 0-1)
          pitch_mean:      float (Hz)
          pitch_std:       float
          energy:          float
          speech_rate:     float (ZCR proxy)
          engagement_delta: float (-15 to +15, applied to base score)
        }
        """
        if not audio_bytes:
            return self._silent()

        try:
            import librosa
        except ImportError:
            logger.warning('librosa not installed — skipping vocal emotion')
            return self._neutral()

        tmp_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            y, sr = librosa.load(tmp_path, sr=16000, mono=True)
        except Exception as e:
            logger.warning(f'vocal_emotion load error: {e}')
            return self._neutral()
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        if len(y) < sr * 0.3:  # less than 300ms — too short
            return self._silent()

        # ── Feature extraction ─────────────────────────────────────────────────────
        energy = float(np.sqrt(np.mean(y ** 2)))
        zcr    = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        mfccs  = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_means = mfccs.mean(axis=1).tolist()

        # Pitch via YIN (robust for speech)
        try:
            f0 = librosa.yin(y, fmin=80, fmax=400, sr=sr)
            f0_voiced = f0[(f0 > 80) & (f0 < 400)]
            pitch_mean = float(np.mean(f0_voiced)) if len(f0_voiced) > 0 else 0.0
            pitch_std  = float(np.std(f0_voiced))  if len(f0_voiced) > 0 else 0.0
        except Exception:
            pitch_mean, pitch_std = 0.0, 0.0

        # ── Emotion heuristic ────────────────────────────────────────────────────
        emotion, score, delta = self._classify(
            pitch_mean=pitch_mean,
            pitch_std=pitch_std,
            energy=energy,
            zcr=zcr,
        )

        return {
            'emotion':          emotion,
            'emotion_score':    round(score, 4),
            'pitch_mean':       round(pitch_mean, 2),
            'pitch_std':        round(pitch_std, 2),
            'energy':           round(energy, 6),
            'speech_rate':      round(zcr, 6),
            'mfcc_means':       [round(v, 4) for v in mfcc_means],
            'engagement_delta': round(delta, 2),
        }

    def _classify(self, pitch_mean: float, pitch_std: float, energy: float, zcr: float) -> tuple:
        """Returns (emotion, confidence, engagement_delta)."""

        # Silent / no speech
        if energy < 0.005:
            return 'silent', 0.95, -12.0

        # Excited / anxious: high pitch + high variation + high energy
        if pitch_mean > 220 and pitch_std > 40 and energy > 0.05:
            return 'excited', 0.72, +10.0

        # Anxious: high pitch_std + moderate energy
        if pitch_std > 50 and 0.01 < energy < 0.05:
            return 'anxious', 0.65, -5.0

        # Confused: rising pitch variability mid energy
        if 20 < pitch_std < 50 and 0.01 < energy < 0.04:
            return 'confused', 0.60, -8.0

        # Bored / disengaged: low pitch + low energy + low ZCR
        if pitch_mean < 130 and energy < 0.015 and zcr < 0.05:
            return 'bored', 0.68, -15.0

        # Focused / engaged: stable mid pitch
        if 130 <= pitch_mean <= 220 and pitch_std < 30 and energy > 0.015:
            return 'focused', 0.70, +8.0

        return 'neutral', 0.55, 0.0

    def _silent(self) -> dict:
        return {
            'emotion': 'silent', 'emotion_score': 0.95,
            'pitch_mean': 0.0, 'pitch_std': 0.0,
            'energy': 0.0, 'speech_rate': 0.0,
            'mfcc_means': [], 'engagement_delta': -12.0,
        }

    def _neutral(self) -> dict:
        return {
            'emotion': 'neutral', 'emotion_score': 0.5,
            'pitch_mean': 0.0, 'pitch_std': 0.0,
            'energy': 0.0, 'speech_rate': 0.0,
            'mfcc_means': [], 'engagement_delta': 0.0,
        }
