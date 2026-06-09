import math
import struct
import logging
from typing import Optional

logger = logging.getLogger('engagex.vocal_emotion')

_PCM_THRESHOLDS = {
    'engaged':    60.0,
    'neutral':    30.0,
}


def extract_vocal_features(audio_bytes: bytes, sample_rate: int = 16000) -> Optional[dict]:
    """
    Compute a simple RMS energy score from raw 16-bit little-endian PCM bytes.
    No external audio libraries required.
    """
    try:
        # Trim to an even byte count so struct.unpack works cleanly
        n_bytes = len(audio_bytes) - (len(audio_bytes) % 2)
        if n_bytes < 2:
            return {'emotion': 'neutral', 'energy_score': 0.0}

        samples = struct.unpack('<' + 'h' * (n_bytes // 2), audio_bytes[:n_bytes])
        rms = math.sqrt(sum(s * s for s in samples) / len(samples))

        # Normalise to 0-100; a 16-bit PCM sample maxes out at 32767
        energy_score = min(100.0, (rms / 32767.0) * 100.0 * 20)

        if energy_score >= _PCM_THRESHOLDS['engaged']:
            emotion = 'engaged'
        elif energy_score >= _PCM_THRESHOLDS['neutral']:
            emotion = 'neutral'
        else:
            emotion = 'disengaged'

        return {
            'emotion': emotion,
            'energy_score': round(energy_score, 2),
            'rms': round(rms, 4),
        }

    except Exception as exc:
        logger.error('extract_vocal_features failed: %s', exc)
        return None


def score_from_vocal(features: Optional[dict]) -> float:
    if not features:
        return 50.0
    return min(100.0, max(0.0, float(features.get('energy_score', 50.0))))
