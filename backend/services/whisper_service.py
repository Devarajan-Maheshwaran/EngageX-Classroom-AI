import os
import logging
import tempfile
from typing import Optional

from groq import Groq

logger = logging.getLogger('engagex.whisper')

_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv('GROQ_API_KEY', '')
        if not api_key:
            raise RuntimeError('GROQ_API_KEY is not set')
        _client = Groq(api_key=api_key)
    return _client


def transcribe_audio(audio_bytes: bytes, language: str = 'en') -> Optional[str]:
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        with open(tmp_path, 'rb') as audio_file:
            result = _get_client().audio.transcriptions.create(
                file=('audio.wav', audio_file, 'audio/wav'),
                model='whisper-large-v3',
                response_format='text',
                language=language,
            )

        transcript = result.strip() if isinstance(result, str) else str(result).strip()
        return transcript or None

    except Exception as exc:
        logger.error('transcribe_audio failed: %s', exc)
        return None

    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
