"""
routers/quiz.py — Phase 13 (updated)
Adds POST /api/quiz/{quiz_id}/analyse endpoint.
"""

import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field
from typing import Optional, List
from services.supabase_service import SupabaseService
from socket_manager import sio
from agents.quiz_crew import run_quiz_analysis

router = APIRouter()
logger = logging.getLogger('engagex.quiz')
_svc = SupabaseService()


class QuizOption(BaseModel):
    id: str
    text: str

class CreateQuizRequest(BaseModel):
    session_id: str
    teacher_id: str
    question:   str  = Field(min_length=3, max_length=500)
    quiz_type:  str  = Field(default='mcq')
    options:    Optional[List[QuizOption]] = None
    correct_id: Optional[str] = None
    duration_s: int  = Field(default=30, ge=5, le=300)

class QuizResponseRequest(BaseModel):
    quiz_id:     str
    session_id:  str
    student_id:  str
    answer_id:   Optional[str] = None
    answer_text: Optional[str] = Field(default=None, max_length=500)


@router.post('/create', status_code=status.HTTP_201_CREATED)
async def create_quiz(body: CreateQuizRequest):
    if body.quiz_type == 'mcq' and (not body.options or len(body.options) < 2):
        raise HTTPException(400, 'MCQ requires at least 2 options')
    options_payload = [o.model_dump() for o in body.options] if body.options else []
    try:
        quiz = _svc.create_quiz(
            session_id=body.session_id, teacher_id=body.teacher_id,
            question=body.question, quiz_type=body.quiz_type,
            options=options_payload, correct_id=body.correct_id,
            duration_s=body.duration_s,
        )
    except Exception as e:
        logger.error(f'create_quiz DB: {e}')
        raise HTTPException(500, 'Failed to create quiz')
    push_payload = {
        'quiz_id': quiz['id'], 'question': body.question,
        'quiz_type': body.quiz_type, 'options': options_payload,
        'duration_s': body.duration_s,
    }
    await sio.emit('quiz_push', push_payload, room=f'student:{body.session_id}')
    logger.info(f"[Quiz] pushed quiz_id={quiz['id']} session={body.session_id[:8]}")
    return {'quiz_id': quiz['id'], 'status': 'pushed', **push_payload}


@router.post('/respond', status_code=status.HTTP_201_CREATED)
def submit_response(body: QuizResponseRequest):
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
            quiz_id=body.quiz_id, session_id=body.session_id,
            student_id=body.student_id, answer_id=body.answer_id,
            answer_text=body.answer_text, is_correct=is_correct,
        )
    except Exception as e:
        logger.error(f'save_quiz_response: {e}')
        raise HTTPException(500, 'Failed to save response')
    try:
        _svc.save_signal(
            session_id=body.session_id, student_id=body.student_id,
            signal_type='quiz_response',
            signal_data={'quiz_id': body.quiz_id, 'answer_id': body.answer_id, 'is_correct': is_correct},
            engagement_score=80.0 if is_correct else 65.0,
        )
    except Exception:
        pass
    return {'id': resp['id'], 'is_correct': is_correct}


@router.post('/{quiz_id}/analyse', status_code=status.HTTP_202_ACCEPTED)
async def analyse_quiz(quiz_id: str, background_tasks: BackgroundTasks, session_id: str):
    """
    Trigger Quiz Crew analysis for a quiz.
    Runs in the background and emits quiz_insights to teacher room when done.
    """
    async def _run_and_emit():
        import asyncio
        loop = asyncio.get_event_loop()
        try:
            insights = await loop.run_in_executor(None, run_quiz_analysis, quiz_id, session_id)
            await sio.emit(
                'quiz_insights',
                {'quiz_id': quiz_id, 'insights': insights},
                room=f'teacher:{session_id}',
            )
            logger.info(f'[Quiz] insights emitted quiz={quiz_id[:8]}')
        except Exception as e:
            logger.error(f'analyse_quiz background: {e}')

    background_tasks.add_task(_run_and_emit)
    return {'status': 'analysis_started', 'quiz_id': quiz_id}


@router.get('/{quiz_id}', status_code=status.HTTP_200_OK)
def get_quiz(quiz_id: str):
    try:
        quiz = _svc.get_quiz(quiz_id)
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
