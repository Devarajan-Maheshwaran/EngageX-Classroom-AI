"""
routers/quiz.py — Phase 11

Teacher creates a quiz/poll → backend persists + broadcasts to
all students in the session via Socket.IO quiz_push event.

Student submits answer → backend persists + triggers aggregation
bonus (participation signal).

Routes (prefix /api/quiz):
  POST /create        → teacher creates quiz, pushes to students
  POST /respond       → student submits answer
  GET  /{quiz_id}     → fetch quiz details + responses
  GET  /session/{session_id} → list all quizzes for a session
"""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from services.supabase_service import SupabaseService
from socket_manager import sio

router = APIRouter()
logger = logging.getLogger('engagex.quiz')
_svc = SupabaseService()


# ── Models ────────────────────────────────────────────────────────────────────

class QuizOption(BaseModel):
    id:   str          # 'a', 'b', 'c', 'd'
    text: str

class CreateQuizRequest(BaseModel):
    session_id:  str
    teacher_id:  str
    question:    str  = Field(min_length=3, max_length=500)
    quiz_type:   str  = Field(default='mcq')   # 'mcq' | 'poll' | 'short'
    options:     Optional[List[QuizOption]] = None
    correct_id:  Optional[str] = None          # for mcq grading
    duration_s:  int  = Field(default=30, ge=5, le=300)

class QuizResponseRequest(BaseModel):
    quiz_id:    str
    session_id: str
    student_id: str
    answer_id:  Optional[str] = None   # for mcq/poll
    answer_text: Optional[str] = Field(default=None, max_length=500)  # for short


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post('/create', status_code=status.HTTP_201_CREATED)
async def create_quiz(body: CreateQuizRequest):
    """
    Teacher creates a quiz.
    1. Persist to Supabase quizzes table
    2. Broadcast quiz_push to student room via Socket.IO
    """
    if body.quiz_type == 'mcq' and (not body.options or len(body.options) < 2):
        raise HTTPException(400, 'MCQ requires at least 2 options')

    options_payload = [o.model_dump() for o in body.options] if body.options else []

    try:
        quiz = _svc.create_quiz(
            session_id=body.session_id,
            teacher_id=body.teacher_id,
            question=body.question,
            quiz_type=body.quiz_type,
            options=options_payload,
            correct_id=body.correct_id,
            duration_s=body.duration_s,
        )
    except Exception as e:
        logger.error(f'create_quiz DB: {e}')
        raise HTTPException(500, 'Failed to create quiz')

    # Push to all students in session
    push_payload = {
        'quiz_id':    quiz['id'],
        'question':   body.question,
        'quiz_type':  body.quiz_type,
        'options':    options_payload,
        'duration_s': body.duration_s,
    }
    await sio.emit('quiz_push', push_payload, room=f'student:{body.session_id}')
    logger.info(f"[Quiz] pushed quiz_id={quiz['id']} session={body.session_id[:8]} type={body.quiz_type}")

    return {'quiz_id': quiz['id'], 'status': 'pushed', **push_payload}


@router.post('/respond', status_code=status.HTTP_201_CREATED)
def submit_response(body: QuizResponseRequest):
    """
    Student submits an answer.
    Saves response + saves a participation text signal (engagement boost).
    """
    if not body.answer_id and not body.answer_text:
        raise HTTPException(400, 'answer_id or answer_text required')

    try:
        quiz = _svc.get_quiz(body.quiz_id)
    except Exception as e:
        raise HTTPException(404, f'Quiz not found: {e}')

    is_correct: Optional[bool] = None
    if quiz.get('correct_id') and body.answer_id:
        is_correct = (body.answer_id == quiz['correct_id'])

    try:
        resp = _svc.save_quiz_response(
            quiz_id=body.quiz_id,
            session_id=body.session_id,
            student_id=body.student_id,
            answer_id=body.answer_id,
            answer_text=body.answer_text,
            is_correct=is_correct,
        )
    except Exception as e:
        logger.error(f'save_quiz_response: {e}')
        raise HTTPException(500, 'Failed to save response')

    # Participation signal → engagement boost
    try:
        _svc.save_signal(
            session_id=body.session_id,
            student_id=body.student_id,
            signal_type='quiz_response',
            signal_data={
                'quiz_id':    body.quiz_id,
                'answer_id':  body.answer_id,
                'is_correct': is_correct,
            },
            engagement_score=80.0 if is_correct else 65.0,
        )
    except Exception:
        pass  # non-fatal

    logger.info(f"[Quiz] response quiz={body.quiz_id[:8]} student={body.student_id[:8]} correct={is_correct}")
    return {'id': resp['id'], 'is_correct': is_correct}


@router.get('/{quiz_id}', status_code=status.HTTP_200_OK)
def get_quiz(quiz_id: str):
    try:
        quiz  = _svc.get_quiz(quiz_id)
        resps = _svc.get_quiz_responses(quiz_id)
        return {**quiz, 'responses': resps, 'response_count': len(resps)}
    except Exception as e:
        raise HTTPException(404, str(e))


@router.get('/session/{session_id}', status_code=status.HTTP_200_OK)
def list_session_quizzes(session_id: str):
    try:
        quizzes = _svc.list_quizzes(session_id)
        return {'session_id': session_id, 'quizzes': quizzes, 'count': len(quizzes)}
    except Exception as e:
        raise HTTPException(500, str(e))
