"""
routers/signals.py — Phase 7
Full vision signal ingestion with engagement scoring.
Text signal, audio stub unchanged.
"""

import logging
from fastapi  import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from typing   import Optional
from services.supabase_service import SupabaseService

router = APIRouter()
logger = logging.getLogger('engagex.signals')
_svc   = SupabaseService()


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
    if body.sentiment:            signal_data['sentiment']       = body.sentiment
    if body.sentiment_score is not None: signal_data['sentiment_score'] = body.sentiment_score
    if body.intent:               signal_data['intent']          = body.intent
    if body.intent_scores:        signal_data['intent_scores']   = body.intent_scores
    try:
        row = _svc.save_signal(
            session_id=body.session_id, student_id=body.student_id,
            signal_type=signal_type, signal_data=signal_data,
            engagement_score=body.engagement_score,
        )
        logger.info(f"[text] {signal_type} student={body.student_id[:8]} intent={body.intent} score={body.engagement_score}")
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
    """
    Receives aggregated face-api.js signal from the browser every 10s.
    Raw video frames never leave the browser (privacy-preserving by design).
    """
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
        logger.info(
            f"[vision] student={body.student_id[:8]} "
            f"face={body.face_present_ratio:.2f} expr={body.dominant_expression} "
            f"score={body.engagement_score}"
        )
        return {'id': row['id'], 'signal_type': 'vision'}
    except Exception as e:
        logger.error(f'ingest_vision_signal: {e}')
        raise HTTPException(500, 'Failed to save vision signal')


# ── AUDIO (stub — Phase 8-9) ─────────────────────────────────────────────────────

@router.post('/audio', status_code=status.HTTP_201_CREATED)
async def ingest_audio_signal(
    session_id: str        = Form(...),
    student_id: str        = Form(...),
    audio:      UploadFile = File(...),
):
    try:
        content = await audio.read()
        size = len(content)
    except Exception:
        size = 0
    logger.info(f"[audio] received student={student_id[:8]} file={audio.filename} size={size}B (Whisper Phase 8)")
    return {'status': 'received', 'whisper': 'pending_phase_8', 'size_bytes': size}
