import asyncio
import logging
from services.supabase_service import SupabaseService
from agents.signal_aggregator import run_aggregation
from socket_manager import sio

logger = logging.getLogger('engagex.polling')
_svc   = SupabaseService()

POLL_INTERVAL = 10


async def polling_loop():
    logger.info('Polling loop started')
    while True:
        try:
            await _poll_all_sessions()
        except Exception as e:
            logger.error(f'polling_loop error: {e}')
        await asyncio.sleep(POLL_INTERVAL)


async def _poll_all_sessions():
    sessions = _svc.get_active_sessions()
    for session in sessions:
        sid      = session['id']
        students = session.get('students', [])
        for student in students:
            try:
                result = run_aggregation(sid, student['id'], student.get('name', ''))
                fused  = result.get('fused_score')
                if fused is not None:
                    await sio.emit('engagement_update', {
                        'student_id':  student['id'],
                        'fused_score': fused,
                        'alert_type':  result.get('alert_type'),
                    }, room=sid)
            except Exception as e:
                logger.warning(f'poll student={student["id"][:8]}: {e}')
