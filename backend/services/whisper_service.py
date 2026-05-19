import io
import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger('engagex.whisper')

try:
    from faster_whisper import WhisperModel
    _model = WhisperModel('tiny', device='cpu', compute_type='int8')
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    _model = None
    logger.warning('faster-whisper not installed — transcription unavailable')


def transcribe_audio(audio_bytes: bytes, language: str = 'en') -> Optional[str]:
    if not WHISPER_AVAILABLE or not _model:
        return None
    try:
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        segments, _ = _model.transcribe(tmp_path, language=language, beam_size=1)
        transcript  = ' '.join(seg.text.strip() for seg in segments)
        return transcript.strip() or None
    except Exception as e:
        logger.error(f'transcribe_audio: {e}')
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
