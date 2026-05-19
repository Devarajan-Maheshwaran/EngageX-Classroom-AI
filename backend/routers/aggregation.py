import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from services.supabase_service import SupabaseService
from agents.signal_aggregator import run_aggregation
from socket_manager import sio

router = APIRouter()
logger = logging.getLogger('engagex.aggregation')
_svc   = SupabaseService()


class AggregateRequest(BaseModel):
    session_id:   str
    student_id:   str
    student_name: str = ''


@router.post('/', status_code=status.HTTP_200_OK)
async def aggregate(body: AggregateRequest):
    try:
        result = run_aggregation(body.session_id, body.student_id, body.student_name)
    except Exception as e:
        logger.error(f'aggregate: {e}')
        raise HTTPException(500, str(e))

    if result.get('alert_type'):
        await sio.emit('alert', {
            'student_id':   body.student_id,
            'student_name': body.student_name,
            'alert_type':   result['alert_type'],
            'message':      result['alert']['message'] if result.get('alert') else '',
            'fused_score':  result['fused_score'],
        }, room=body.session_id)

    return result


@router.get('/alerts/{session_id}', status_code=status.HTTP_200_OK)
def get_alerts(session_id: str, limit: int = 50):
    alerts = _svc.get_alerts(session_id, limit)
    return {'alerts': alerts}
