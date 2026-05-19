"""
routers/signals.py — Phase 9
Audio endpoint now includes vocal emotion.
"""

import logging
from fastapi  import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from typing   import Optional
from services.supabase_service  import SupabaseService
from services.whisper_service   import WhisperService

router = APIRouter()
logger = logging.getLogger('engagex.signals')
_svc     = SupabaseService()
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
        return {'id': row['id'], 'signal_type': 'vision'}
    except Exception as e:
        logger.error(f'ingest_vision_signal: {e}')
        raise HTTPException(500, 'Failed to save vision signal')


# ── AUDIO (Phase 9 — Whisper + Vocal Emotion) ────────────────────────────────────
@router.post('/audio', status_code=status.HTTP_201_CREATED)
async def ingest_audio_signal(
    session_id: str        = Form(...),
    student_id: str        = Form(...),
    audio:      UploadFile = File(...),
):
    if not session_id or not student_id:
        raise HTTPException(400, 'session_id and student_id required')
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, 'Empty audio chunk')

    result = await _whisper.transcribe(audio_bytes, mime_type=audio.content_type or 'audio/webm')

    # Engagement: base 55 for speech, adjusted by vocal emotion delta
    base = 55.0 if result['is_speech'] else 20.0
    delta = result.get('engagement_delta', 0.0)
    engagement_score = round(min(100.0, max(0.0, base + delta)), 2)

    signal_data = {
        'transcript':       result['transcript'],
        'vocal_energy':     result['vocal_energy'],
        'is_speech':        result['is_speech'],
        'language':         result['language'],
        'language_prob':    result['language_prob'],
        'emotion':          result.get('emotion', 'neutral'),
        'emotion_score':    result.get('emotion_score', 0.5),
        'pitch_mean':       result.get('pitch_mean', 0.0),
        'pitch_std':        result.get('pitch_std', 0.0),
        'speech_rate':      result.get('speech_rate', 0.0),
        'chunk_duration_ms': result['chunk_duration_ms'],
    }

    try:
        row = _svc.save_signal(
            session_id=session_id, student_id=student_id,
            signal_type='audio', signal_data=signal_data,
            engagement_score=engagement_score,
        )
        logger.info(
            f"[audio] student={student_id[:8]} emotion={signal_data['emotion']} "
            f"transcript='{result['transcript'][:50]}' score={engagement_score}"
        )
        return {
            'id':               row['id'],
            'signal_type':      'audio',
            'transcript':       result['transcript'],
            'vocal_energy':     result['vocal_energy'],
            'is_speech':        result['is_speech'],
            'emotion':          signal_data['emotion'],
            'chunk_duration_ms': result['chunk_duration_ms'],
        }
    except Exception as e:
        logger.error(f'ingest_audio_signal DB: {e}')
        raise HTTPException(500, 'Failed to save audio signal')
