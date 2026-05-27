import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from services.supabase_service import SupabaseService
from agents.quiz_crew import run_quiz_analysis, run_quiz_crew
from socket_manager import sio

router = APIRouter()
logger = logging.getLogger('engagex.quiz')
_svc   = SupabaseService()


class CreateQuizRequest(BaseModel):
    session_id:  str
    teacher_id:  str
    question:    str
    quiz_type:   str = 'mcq'
    options:     list = []
    correct_id:  Optional[str] = None
    duration_s:  int = 30


class SubmitResponseRequest(BaseModel):
    quiz_id:     str
    session_id:  str
    student_id:  str
    answer_id:   Optional[str] = None
    answer_text: Optional[str] = None


class GenerateQuizRequest(BaseModel):
    session_id: str
    topic:      str
    context:    str = ''


@router.post('/generate', status_code=status.HTTP_201_CREATED)
async def generate_quiz(body: GenerateQuizRequest):
    return run_quiz_crew(body.topic, body.context)


@router.post('/', status_code=status.HTTP_201_CREATED)
async def create_quiz(body: CreateQuizRequest):
    try:
        quiz = _svc.create_quiz(
            session_id=body.session_id,
            teacher_id=body.teacher_id,
            question=body.question,
            quiz_type=body.quiz_type,
            options=body.options,
            correct_id=body.correct_id,
            duration_s=body.duration_s,
        )
    except Exception as e:
        logger.error(f'create_quiz: {e}')
        raise HTTPException(500, 'Failed to create quiz')

    await sio.emit('quiz_start', {
        'quiz_id':    quiz['id'],
        'question':   body.question,
        'quiz_type':  body.quiz_type,
        'options':    body.options,
        'duration_s': body.duration_s,
    }, room=body.session_id)

    return {'quiz_id': quiz['id'], 'status': 'active'}


@router.post('/respond', status_code=status.HTTP_201_CREATED)
async def submit_response(body: SubmitResponseRequest):
    try:
        quiz = _svc.get_quiz(body.quiz_id)
    except Exception:
        raise HTTPException(404, 'Quiz not found')

    is_correct = None
    if quiz.get('correct_id') and body.answer_id:
        is_correct = body.answer_id == quiz['correct_id']

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
        logger.error(f'submit_response: {e}')
        raise HTTPException(500, 'Failed to save response')

    await sio.emit('quiz_response_ack', {
        'student_id': body.student_id,
        'quiz_id':    body.quiz_id,
        'is_correct': is_correct,
    }, room=body.session_id)

    return {'response_id': resp['id'], 'is_correct': is_correct}


@router.post('/analyse/{quiz_id}', status_code=status.HTTP_200_OK)
async def analyse_quiz(quiz_id: str):
    try:
        insights = run_quiz_analysis(quiz_id)
    except Exception as e:
        logger.error(f'analyse_quiz: {e}')
        raise HTTPException(500, str(e))

    try:
        quiz = _svc.get_quiz(quiz_id)
        await sio.emit('quiz_insights', {
            'quiz_id':  quiz_id,
            'insights': insights,
        }, room=quiz['session_id'])
    except Exception:
        pass

    return insights


@router.get('/responses/{quiz_id}', status_code=status.HTTP_200_OK)
def get_responses(quiz_id: str):
    responses = _svc.get_quiz_responses(quiz_id)
    return {'quiz_id': quiz_id, 'responses': responses}


@router.get('/list/{session_id}', status_code=status.HTTP_200_OK)
def list_quizzes(session_id: str):
    quizzes = _svc.list_quizzes(session_id)
    return {'quizzes': quizzes}
