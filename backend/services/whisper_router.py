import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.whisper_service      import transcribe_audio
from services.vocal_emotion_service import extract_vocal_features, score_from_vocal
from services.supabase_service     import SupabaseService

router = APIRouter()
logger = logging.getLogger('engagex.whisper_router')
_svc   = SupabaseService()


@router.post('/transcribe')
async def transcribe(
    file:       UploadFile = File(...),
    session_id: str = '',
    student_id: str = '',
):
    audio_bytes = await file.read()
    transcript  = transcribe_audio(audio_bytes)
    features    = extract_vocal_features(audio_bytes)
    score       = score_from_vocal(features) if features else 50.0

    signal_data = {
        'transcript': transcript,
        'vocal':      features,
    }
    if session_id and student_id:
        try:
            _svc.save_signal(
                session_id=session_id,
                student_id=student_id,
                signal_type='audio',
                signal_data=signal_data,
                engagement_score=score,
            )
        except Exception as e:
            logger.warning(f'save audio signal: {e}')

    return {
        'transcript': transcript,
        'features':   features,
        'score':      score,
    }
