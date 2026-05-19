import logging
import secrets
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from services.supabase_service import SupabaseService

router = APIRouter()
logger = logging.getLogger('engagex.sessions')
_svc   = SupabaseService()


class CreateSessionRequest(BaseModel):
    teacher_id: str
    title:      str


class JoinSessionRequest(BaseModel):
    code:         str
    student_name: str


@router.post('/', status_code=status.HTTP_201_CREATED)
def create_session(body: CreateSessionRequest):
    code = secrets.token_hex(3).upper()
    try:
        session = _svc.create_session(body.teacher_id, body.title, code)
    except Exception as e:
        logger.error(f'create_session: {e}')
        raise HTTPException(500, 'Failed to create session')
    return {'session_id': session['id'], 'code': code, 'title': body.title}


@router.post('/join', status_code=status.HTTP_200_OK)
def join_session(body: JoinSessionRequest):
    session = _svc.get_session_by_code(body.code.upper())
    if not session:
        raise HTTPException(404, 'Session not found or not active')
    try:
        student = _svc.join_session(session['id'], body.student_name)
    except Exception as e:
        logger.error(f'join_session: {e}')
        raise HTTPException(500, 'Failed to join session')
    return {'session_id': session['id'], 'student_id': student['id'], 'student_name': body.student_name}


@router.get('/{session_id}', status_code=status.HTTP_200_OK)
def get_session(session_id: str):
    state = _svc.get_session_state(session_id)
    if not state:
        raise HTTPException(404, 'Session not found')
    return state
