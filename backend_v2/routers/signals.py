"""
routers/signals.py — Phase 5
Signal ingestion endpoints for all three pipelines.

Routes (prefixed /api/signals by main.py):
    POST /text    → sent message OR deleted-message signal
    POST /vision  → aggregated face-api.js signal (Phase 7)
    POST /audio   → audio chunk for Whisper (Phase 8-9)
"""

import logging
from fastapi    import APIRouter, HTTPException, UploadFile, File, Form, status
from pydantic   import BaseModel, Field
from typing     import Optional
from services.supabase_service import SupabaseService

router = APIRouter()
logger = logging.getLogger("engagex.signals")
_svc   = SupabaseService()


# ── TEXT SIGNAL ────────────────────────────────────────────────────────────────

class TextSignalBody(BaseModel):
    session_id:          str
    student_id:          str
    text:                str   = Field(max_length=1000)
    is_deleted:          bool  = False
    edit_count:          int   = 0
    silence_duration_ms: int   = 0
    participation_freq:  int   = 0
    # NLP fields — computed in browser (Phase 6), optional here
    sentiment:           Optional[str]   = None
    sentiment_score:     Optional[float] = None
    intent:              Optional[str]   = None
    intent_scores:       Optional[dict]  = None
    engagement_score:    Optional[float] = None


@router.post("/text", status_code=status.HTTP_201_CREATED)
def ingest_text_signal(body: TextSignalBody):
    """
    Accepts sent messages and deleted/abandoned messages from the browser.
    signal_type = 'text'         for sent messages
    signal_type = 'text_deleted' for abandoned messages (is_deleted=True)
    NLP fields are computed client-side by Phase 6 Transformers.js.
    """
    if not body.session_id or not body.student_id:
        raise HTTPException(400, "session_id and student_id required")

    signal_type = "text_deleted" if body.is_deleted else "text"

    signal_data: dict = {
        "text":                body.text,
        "is_deleted":          body.is_deleted,
        "edit_count":          body.edit_count,
        "silence_duration_ms": body.silence_duration_ms,
        "participation_freq":  body.participation_freq,
    }
    if body.sentiment:       signal_data["sentiment"]       = body.sentiment
    if body.sentiment_score: signal_data["sentiment_score"] = body.sentiment_score
    if body.intent:          signal_data["intent"]          = body.intent
    if body.intent_scores:   signal_data["intent_scores"]   = body.intent_scores

    try:
        row = _svc.save_signal(
            session_id=body.session_id,
            student_id=body.student_id,
            signal_type=signal_type,
            signal_data=signal_data,
            engagement_score=body.engagement_score,
        )
        logger.info(
            f"[Signal/text] {'DELETED' if body.is_deleted else 'sent'} "
            f"student={body.student_id[:8]} '{body.text[:40]}'"
        )
        return {"id": row["id"], "signal_type": signal_type}
    except Exception as e:
        logger.error(f"ingest_text_signal: {e}")
        raise HTTPException(500, "Failed to save signal")


# ── VISION SIGNAL (stub — Phase 7) ─────────────────────────────────────────────

class VisionSignalBody(BaseModel):
    session_id:          str
    student_id:          str
    face_present_ratio:  float = Field(ge=0, le=1, default=1.0)
    dominant_expression: Optional[str]   = None
    looking_away_ratio:  float = Field(ge=0, le=1, default=0.0)
    eye_open_ratio:      float = Field(ge=0, le=1, default=1.0)
    engagement_score:    Optional[float] = None


@router.post("/vision", status_code=status.HTTP_201_CREATED)
def ingest_vision_signal(body: VisionSignalBody):
    """
    Receives aggregated face-api.js signal from browser.
    Raw video frames NEVER leave the browser (privacy-preserving by design).
    Full implementation in Phase 7.
    """
    signal_data = {
        "face_present_ratio":  body.face_present_ratio,
        "dominant_expression": body.dominant_expression,
        "looking_away_ratio":  body.looking_away_ratio,
        "eye_open_ratio":      body.eye_open_ratio,
    }
    try:
        row = _svc.save_signal(
            session_id=body.session_id,
            student_id=body.student_id,
            signal_type="vision",
            signal_data=signal_data,
            engagement_score=body.engagement_score,
        )
        return {"id": row["id"], "signal_type": "vision"}
    except Exception as e:
        logger.error(f"ingest_vision_signal: {e}")
        raise HTTPException(500, "Failed to save vision signal")


# ── AUDIO SIGNAL (stub — Phase 8-9) ────────────────────────────────────────────

@router.post("/audio", status_code=status.HTTP_201_CREATED)
async def ingest_audio_signal(
    session_id: str        = Form(...),
    student_id: str        = Form(...),
    audio:      UploadFile = File(...),
):
    """
    Receives 5s audio chunks (webm/opus or wav) from the browser VAD pipeline.
    Phase 8: saves file reference to disk.
    Phase 9: transcribes via faster-whisper + extracts vocal emotion via librosa.
    """
    try:
        content = await audio.read()
        size    = len(content)
    except Exception:
        size = 0

    logger.info(
        f"[Signal/audio] received student={student_id[:8]} "
        f"file={audio.filename} size={size}B — Whisper stub (Phase 8)"
    )
    return {"status": "received", "whisper": "pending_phase_8", "size_bytes": size}
