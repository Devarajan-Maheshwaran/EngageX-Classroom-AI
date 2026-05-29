import logging
import secrets
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import db.py_store as _svc

router = APIRouter()
logger = logging.getLogger('engagex.sessions')


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
        session = _svc.get_db().execute("INSERT INTO sessions (id, join_code, title, status) VALUES (?, ?, ?, 'active') RETURNING *", (code, code, body.title)).fetchone()
        session = dict(session)
    except Exception as e:
        logger.error(f'create_session: {e}')
        raise HTTPException(500, 'Failed to create session')
    return {'session_id': session['id'], 'code': code, 'title': body.title}


@router.post('/join', status_code=status.HTTP_200_OK)
def join_session(body: JoinSessionRequest):
    with _svc.get_db() as db:
        session = db.execute("SELECT * FROM sessions WHERE join_code = ? AND status = 'active' LIMIT 1", (body.code.upper(),)).fetchone()
    if not session:
        raise HTTPException(404, 'Session not found or not active')
    try:
        session = dict(session)
        from datetime import datetime
        with _svc.get_db() as db:
            db.execute("INSERT INTO session_students (session_id, student_id, joined_at, role) VALUES (?, ?, ?, 'student')", (session['id'], body.student_name, datetime.utcnow().isoformat()))
            db.execute("INSERT OR IGNORE INTO students (id, display_name) VALUES (?, ?)", (body.student_name, body.student_name))
            db.commit()
        student = {'id': body.student_name}
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
