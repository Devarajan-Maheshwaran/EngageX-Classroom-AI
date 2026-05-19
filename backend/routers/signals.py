import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from services.supabase_service import SupabaseService
from socket_manager import sio

router = APIRouter()
logger = logging.getLogger('engagex.signals')
_svc   = SupabaseService()


class SignalPayload(BaseModel):
    session_id:       str
    student_id:       str
    signal_type:      str
    signal_data:      dict
    engagement_score: Optional[float] = None


@router.post('/', status_code=status.HTTP_201_CREATED)
async def ingest_signal(body: SignalPayload):
    try:
        row = _svc.save_signal(
            session_id=body.session_id,
            student_id=body.student_id,
            signal_type=body.signal_type,
            signal_data=body.signal_data,
            engagement_score=body.engagement_score,
        )
    except Exception as e:
        logger.error(f'ingest_signal: {e}')
        raise HTTPException(500, 'Failed to save signal')
    await sio.emit('signal_ack', {'id': row['id']}, room=body.session_id)
    return {'id': row['id'], 'status': 'saved'}


@router.get('/{session_id}/{student_id}', status_code=status.HTTP_200_OK)
def get_signals(session_id: str, student_id: str, limit: int = 20):
    signals = _svc.get_recent_signals(session_id, student_id, limit)
    return {'signals': signals}
