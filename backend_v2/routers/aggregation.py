"""
routers/aggregation.py — Phase 9

Exposes the signal aggregation agent via REST.

Routes (prefixed /api/aggregate):
  POST /student   → run aggregation for one student, return fused snapshot
  POST /session   → run aggregation for all active students in a session
"""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from agents.signal_aggregator import run_aggregation
from services.supabase_service import SupabaseService

router = APIRouter()
logger = logging.getLogger('engagex.aggregation')
_svc   = SupabaseService()


class StudentAggregateRequest(BaseModel):
    session_id: str
    student_id: str
    limit:      int = 10


class SessionAggregateRequest(BaseModel):
    session_id: str
    limit:      int = 10


@router.post('/student', status_code=status.HTTP_200_OK)
def aggregate_student(body: StudentAggregateRequest):
    """
    Run signal aggregation for a single student.
    Returns fused engagement snapshot + alert decision.
    """
    try:
        result = run_aggregation(
            student_id=body.student_id,
            session_id=body.session_id,
            limit=body.limit,
        )
        return result
    except Exception as e:
        logger.error(f'aggregate_student: {e}')
        raise HTTPException(500, 'Aggregation failed')


@router.post('/session', status_code=status.HTTP_200_OK)
def aggregate_session(body: SessionAggregateRequest):
    """
    Run signal aggregation for ALL active students in a session.
    Used by the Phase 10 polling loop.
    Returns list of per-student snapshots.
    """
    try:
        state = _svc.get_session_state(body.session_id)
        if not state:
            raise HTTPException(404, 'Session not found')
        students = state.get('students', [])
        results = []
        for student in students:
            try:
                r = run_aggregation(
                    student_id=student['id'],
                    session_id=body.session_id,
                    limit=body.limit,
                )
                results.append(r)
            except Exception as e:
                logger.warning(f'aggregate failed for student {student["id"][:8]}: {e}')
        return {'session_id': body.session_id, 'count': len(results), 'results': results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'aggregate_session: {e}')
        raise HTTPException(500, 'Session aggregation failed')
