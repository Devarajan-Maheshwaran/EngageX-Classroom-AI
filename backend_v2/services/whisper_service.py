"""
whisper_service.py — Phase 8

Transcribes audio chunks using faster-whisper (CPU-safe, small model).
Also extracts vocal energy via librosa RMS.

Model: openai/whisper-tiny (INT8 quantized for CPU inference)
Downloads on first run (~75MB), then cached at ~/.cache/huggingface/hub

Usage:
    svc = WhisperService()
    result = await svc.transcribe(audio_bytes, mime_type='audio/webm')
"""

import io
import os
import logging
import asyncio
import tempfile
from functools import lru_cache
from typing import Optional

logger = logging.getLogger('engagex.whisper')

MODEL_SIZE   = os.getenv('WHISPER_MODEL', 'tiny')
DEVICE       = os.getenv('WHISPER_DEVICE', 'cpu')
COMPUTE_TYPE = os.getenv('WHISPER_COMPUTE_TYPE', 'int8')


@lru_cache(maxsize=1)
def _get_model():
    """Load and cache the faster-whisper model (singleton)."""
    from faster_whisper import WhisperModel
    logger.info(f'Loading faster-whisper model={MODEL_SIZE} device={DEVICE} compute={COMPUTE_TYPE}')
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    logger.info('faster-whisper model loaded.')
    return model


def _get_vocal_energy(audio_bytes: bytes) -> float:
    """Extract mean RMS energy from raw audio bytes using librosa."""
    try:
        import librosa
        import numpy as np
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        y, _ = librosa.load(tmp_path, sr=16000, mono=True)
        os.unlink(tmp_path)
        rms = float(np.sqrt(np.mean(y ** 2)))
        return round(rms, 6)
    except Exception as e:
        logger.warning(f'vocal_energy extraction failed: {e}')
        return 0.0


def _transcribe_sync(audio_bytes: bytes) -> dict:
    """Synchronous transcription — runs in a thread pool."""
    model = _get_model()

    # Write to temp file (faster-whisper needs a file path or numpy array)
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            beam_size=1,
            language='en',
            vad_filter=True,   # built-in VAD filter skips silence
            condition_on_previous_text=False,
        )
        transcript = ' '.join(seg.text.strip() for seg in segments).strip()
        return {
            'transcript':    transcript,
            'language':      info.language,
            'language_prob': round(info.language_probability, 4),
            'is_speech':     len(transcript) > 0,
        }
    finally:
        os.unlink(tmp_path)


class WhisperService:
    async def transcribe(self, audio_bytes: bytes, mime_type: str = 'audio/webm') -> dict:
        """
        Transcribe audio bytes asynchronously.
        Returns:
            {
              transcript:    str,
              language:      str,
              language_prob: float,
              is_speech:     bool,
              vocal_energy:  float,
              chunk_duration_ms: int,
            }
        """
        if not audio_bytes:
            return {
                'transcript': '', 'language': 'en', 'language_prob': 0.0,
                'is_speech': False, 'vocal_energy': 0.0, 'chunk_duration_ms': 0,
            }

        loop = asyncio.get_event_loop()

        # Run in thread pool to avoid blocking the event loop
        result = await loop.run_in_executor(None, _transcribe_sync, audio_bytes)
        vocal_energy = await loop.run_in_executor(None, _get_vocal_energy, audio_bytes)

        result['vocal_energy']      = vocal_energy
        result['chunk_duration_ms'] = 5000  # expected chunk size

        logger.info(
            f"[Whisper] transcript='{result['transcript'][:60]}' "
            f"lang={result['language']} energy={vocal_energy}"
        )
        return result
