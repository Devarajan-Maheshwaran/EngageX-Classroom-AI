"""
routers/signals.py — Phase 8
Full audio ingestion with faster-whisper transcription.
"""

import logging
import os
from fastapi  import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from typing   import Optional
from services.supabase_service import SupabaseService
from services.whisper_service  import WhisperService

router = APIRouter()
logger = logging.getLogger('engagex.signals')
_svc   = SupabaseService()
_whisper = WhisperService()


# ── TEXT ────────────────────────────────────────────────────────────────────

class TextSignalBody(BaseModel):
    session_id:          str
    student_id:          str
    text:                str   = Field(max_length=1000)
    is_deleted:          bool  = False
    edit_count:          int   = 0
    silence_duration_ms: int   = 0
    participation_freq:  int   = 0
    sentiment:           Optional[str]   = None
    sentiment_score:     Optional[float] = None
    intent:              Optional[str]   = None
    intent_scores:       Optional[dict]  = None
    engagement_score:    Optional[float] = None


@router.post('/text', status_code=status.HTTP_201_CREATED)
def ingest_text_signal(body: TextSignalBody):
    if not body.session_id or not body.student_id:
        raise HTTPException(400, 'session_id and student_id required')
    signal_type = 'text_deleted' if body.is_deleted else 'text'
    signal_data: dict = {
        'text': body.text, 'is_deleted': body.is_deleted,
        'edit_count': body.edit_count,
        'silence_duration_ms': body.silence_duration_ms,
        'participation_freq': body.participation_freq,
    }
    if body.sentiment:                   signal_data['sentiment']       = body.sentiment
    if body.sentiment_score is not None: signal_data['sentiment_score'] = body.sentiment_score
    if body.intent:                      signal_data['intent']          = body.intent
    if body.intent_scores:               signal_data['intent_scores']   = body.intent_scores
    try:
        row = _svc.save_signal(
            session_id=body.session_id, student_id=body.student_id,
            signal_type=signal_type, signal_data=signal_data,
            engagement_score=body.engagement_score,
        )
        logger.info(f'[text] {signal_type} student={body.student_id[:8]} intent={body.intent} score={body.engagement_score}')
        return {'id': row['id'], 'signal_type': signal_type}
    except Exception as e:
        logger.error(f'ingest_text_signal: {e}')
        raise HTTPException(500, 'Failed to save signal')


# ── VISION ───────────────────────────────────────────────────────────────────

class VisionSignalBody(BaseModel):
    session_id:          str
    student_id:          str
    face_present_ratio:  float = Field(ge=0, le=1, default=1.0)
    dominant_expression: Optional[str]   = None
    looking_away_ratio:  float = Field(ge=0, le=1, default=0.0)
    eye_open_ratio:      float = Field(ge=0, le=1, default=1.0)
    engagement_score:    Optional[float] = None


@router.post('/vision', status_code=status.HTTP_201_CREATED)
def ingest_vision_signal(body: VisionSignalBody):
    signal_data = {
        'face_present_ratio':  body.face_present_ratio,
        'dominant_expression': body.dominant_expression,
        'looking_away_ratio':  body.looking_away_ratio,
        'eye_open_ratio':      body.eye_open_ratio,
    }
    try:
        row = _svc.save_signal(
            session_id=body.session_id, student_id=body.student_id,
            signal_type='vision', signal_data=signal_data,
            engagement_score=body.engagement_score,
        )
        logger.info(f'[vision] student={body.student_id[:8]} face={body.face_present_ratio:.2f} expr={body.dominant_expression} score={body.engagement_score}')
        return {'id': row['id'], 'signal_type': 'vision'}
    except Exception as e:
        logger.error(f'ingest_vision_signal: {e}')
        raise HTTPException(500, 'Failed to save vision signal')


# ── AUDIO (Phase 8 — faster-whisper) ───────────────────────────────────────────────

@router.post('/audio', status_code=status.HTTP_201_CREATED)
async def ingest_audio_signal(
    session_id: str        = Form(...),
    student_id: str        = Form(...),
    audio:      UploadFile = File(...),
):
    """
    Receives 5s audio chunks from the browser VAD pipeline.
    Transcribes via faster-whisper (INT8 CPU, ~75ms/chunk on modern CPU).
    Saves to Supabase with transcript + vocal energy.
    """
    if not session_id or not student_id:
        raise HTTPException(400, 'session_id and student_id required')

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, 'Empty audio chunk')

    # Transcribe
    result = await _whisper.transcribe(audio_bytes, mime_type=audio.content_type or 'audio/webm')

    # Compute engagement from audio signals
    engagement_score: Optional[float] = None
    if result['is_speech']:
        energy = result['vocal_energy']
        # Simple heuristic: speech present = base 55, boost for energy
        base = 55.0 + min(30.0, energy * 500)
        engagement_score = round(min(100.0, base), 2)
    else:
        engagement_score = 20.0  # silence detected

    signal_data = {
        'transcript':        result['transcript'],
        'vocal_energy':      result['vocal_energy'],
        'is_speech':         result['is_speech'],
        'language':          result['language'],
        'language_prob':     result['language_prob'],
        'chunk_duration_ms': result['chunk_duration_ms'],
    }

    try:
        row = _svc.save_signal(
            session_id=session_id,
            student_id=student_id,
            signal_type='audio',
            signal_data=signal_data,
            engagement_score=engagement_score,
        )
        logger.info(
            f"[audio] student={student_id[:8]} is_speech={result['is_speech']} "
            f"transcript='{result['transcript'][:50]}' score={engagement_score}"
        )
        return {
            'id':              row['id'],
            'signal_type':     'audio',
            'transcript':      result['transcript'],
            'vocal_energy':    result['vocal_energy'],
            'is_speech':       result['is_speech'],
            'chunk_duration_ms': result['chunk_duration_ms'],
        }
    except Exception as e:
        logger.error(f'ingest_audio_signal DB error: {e}')
        raise HTTPException(500, 'Failed to save audio signal')
