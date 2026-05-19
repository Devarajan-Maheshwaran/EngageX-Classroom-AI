"""
whisper_service.py — Phase 9 (updated)
Transcription + now integrates VocalEmotionService.
"""

import os
import asyncio
import logging
import tempfile
from functools import lru_cache
from typing import Optional

logger = logging.getLogger('engagex.whisper')

MODEL_SIZE   = os.getenv('WHISPER_MODEL',        'tiny')
DEVICE       = os.getenv('WHISPER_DEVICE',       'cpu')
COMPUTE_TYPE = os.getenv('WHISPER_COMPUTE_TYPE', 'int8')


@lru_cache(maxsize=1)
def _get_model():
    from faster_whisper import WhisperModel
    logger.info(f'Loading faster-whisper model={MODEL_SIZE} device={DEVICE} compute={COMPUTE_TYPE}')
    m = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    logger.info('faster-whisper model loaded.')
    return m


def _transcribe_sync(audio_bytes: bytes) -> dict:
    model = _get_model()
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        segments, info = model.transcribe(
            tmp_path,
            beam_size=1,
            language='en',
            vad_filter=True,
            condition_on_previous_text=False,
        )
        transcript = ' '.join(s.text.strip() for s in segments).strip()
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
        if not audio_bytes:
            return {
                'transcript': '', 'language': 'en', 'language_prob': 0.0,
                'is_speech': False, 'vocal_energy': 0.0, 'chunk_duration_ms': 0,
                'emotion': 'silent', 'emotion_score': 0.95, 'engagement_delta': -12.0,
            }

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _transcribe_sync, audio_bytes)

        # Vocal emotion (Phase 9)
        from services.vocal_emotion_service import VocalEmotionService
        ves = VocalEmotionService()
        emotion_data = await loop.run_in_executor(None, ves.analyze, audio_bytes)

        result['vocal_energy']      = emotion_data['energy']
        result['chunk_duration_ms'] = 5000
        result['emotion']           = emotion_data['emotion']
        result['emotion_score']     = emotion_data['emotion_score']
        result['pitch_mean']        = emotion_data['pitch_mean']
        result['pitch_std']         = emotion_data['pitch_std']
        result['speech_rate']       = emotion_data['speech_rate']
        result['engagement_delta']  = emotion_data['engagement_delta']
        result['mfcc_means']        = emotion_data.get('mfcc_means', [])

        logger.info(
            f"[Whisper+Emotion] transcript='{result['transcript'][:50]}' "
            f"emotion={result['emotion']} energy={result['vocal_energy']}"
        )
        return result
