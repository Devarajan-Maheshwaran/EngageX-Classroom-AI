import logging
import numpy as np
from typing import Optional

logger = logging.getLogger('engagex.vocal_emotion')

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning('librosa not installed — vocal emotion unavailable')


def extract_vocal_features(audio_bytes: bytes, sample_rate: int = 16000) -> Optional[dict]:
    if not LIBROSA_AVAILABLE:
        return None
    try:
        import io
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=sample_rate, mono=True)

        mfcc        = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean   = float(np.mean(mfcc))
        mfcc_std    = float(np.std(mfcc))

        zcr         = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        rms         = float(np.mean(librosa.feature.rms(y=y)))
        tempo, _    = librosa.beat.beat_track(y=y, sr=sr)
        spectral_c  = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

        energy_score = min(100.0, max(0.0, rms * 5000))

        if energy_score > 60:
            emotion = 'engaged'
        elif energy_score > 30:
            emotion = 'neutral'
        else:
            emotion = 'disengaged'

        return {
            'emotion':        emotion,
            'energy_score':   round(energy_score, 2),
            'mfcc_mean':      round(mfcc_mean, 4),
            'mfcc_std':       round(mfcc_std, 4),
            'zcr':            round(zcr, 6),
            'rms':            round(rms, 6),
            'tempo':          round(float(tempo), 2),
            'spectral_centroid': round(spectral_c, 2),
        }
    except Exception as e:
        logger.error(f'extract_vocal_features: {e}')
        return None


def score_from_vocal(features: dict) -> float:
    if not features:
        return 50.0
    base   = features.get('energy_score', 50.0)
    zcr_b  = min(20.0, features.get('zcr', 0) * 1000)
    sc_b   = min(10.0, (features.get('spectral_centroid', 1000) - 500) / 300)
    return min(100.0, max(0.0, base + zcr_b + sc_b))
