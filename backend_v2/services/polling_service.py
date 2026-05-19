"""
polling_service.py — Phase 10

Background polling loop that runs every POLL_INTERVAL_MS seconds.
For every active session, fetches all students and runs the
SignalAggregator, then pushes the result to the teacher room
via Socket.IO.

Design:
  - asyncio background task (started on FastAPI lifespan)
  - One task per backend process (not per session)
  - Uses SupabaseService.get_active_sessions() to discover sessions
  - Emits `engagement_update` and `alert` Socket.IO events to teacher room
  - Deduplicates alerts: same (student, alert_level) not re-emitted within ALERT_COOLDOWN_S
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from services.supabase_service import SupabaseService
from agents.signal_aggregator  import run_aggregation
from socket_manager            import sio

logger = logging.getLogger('engagex.polling')

POLL_INTERVAL_S  = 15
ALERT_COOLDOWN_S = 60   # don't re-emit same alert within 60s

_svc = SupabaseService()

# In-memory dedup: { (session_id, student_id, alert_level): last_emitted_ts }
_alert_dedup: dict = {}


def _should_emit_alert(session_id: str, student_id: str, alert_level: str) -> bool:
    if alert_level == 'none':
        return False
    key = (session_id, student_id, alert_level)
    last = _alert_dedup.get(key)
    now  = datetime.now(timezone.utc).timestamp()
    if last and (now - last) < ALERT_COOLDOWN_S:
        return False
    _alert_dedup[key] = now
    return True


async def _run_once() -> None:
    """Single poll cycle across all active sessions."""
    try:
        sessions = _svc.get_active_sessions()
    except Exception as e:
        logger.warning(f'[Polling] get_active_sessions failed: {e}')
        return

    for session in sessions:
        session_id = session.get('id')
        students   = session.get('students', [])

        snapshots = []
        for student in students:
            student_id = student.get('id')
            if not student_id:
                continue
            try:
                snap = await asyncio.get_event_loop().run_in_executor(
                    None, run_aggregation, student_id, session_id, 10
                )
                snapshots.append(snap)

                # Emit alert if actionable and not in cooldown
                if _should_emit_alert(session_id, student_id, snap['alert_level']):
                    await sio.emit(
                        'alert',
                        {
                            'student_id':     student_id,
                            'alert_level':    snap['alert_level'],
                            'alert_reason':   snap['alert_reason'],
                            'fused_score':    snap['fused_score'],
                            'summary':        snap['summary'],
                            'timestamp':      datetime.now(timezone.utc).isoformat(),
                        },
                        room=f'teacher:{session_id}',
                    )
                    logger.info(f"[Polling] alert emitted session={session_id[:8]} student={student_id[:8]} level={snap['alert_level']}")

            except Exception as e:
                logger.warning(f'[Polling] aggregation failed for {student_id[:8]}: {e}')

        if snapshots:
            # Emit full class snapshot to teacher room
            await sio.emit(
                'engagement_update',
                {
                    'session_id': session_id,
                    'students':   snapshots,
                    'timestamp':  datetime.now(timezone.utc).isoformat(),
                },
                room=f'teacher:{session_id}',
            )


async def polling_loop() -> None:
    """Main background loop. Call once at startup."""
    logger.info(f'[Polling] started, interval={POLL_INTERVAL_S}s')
    while True:
        await _run_once()
        await asyncio.sleep(POLL_INTERVAL_S)
