import io
import logging
from collections import Counter
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.supabase_service import SupabaseService
from agents.report_crew import run_report_crew, run_all_students
from services.pdf_service import generate_pdf

router = APIRouter()
logger = logging.getLogger('engagex.report')
_svc   = SupabaseService()


class SessionSummaryRequest(BaseModel):
    session_id:         str
    limit_per_student:  int = 100


def _avg(nums: list[float]) -> float | None:
    vals = [n for n in nums if isinstance(n, (int, float))]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


@router.post('/session-summary', status_code=status.HTTP_200_OK)
def generate_session_summary(body: SessionSummaryRequest):
    try:
        state = _svc.get_session_state(body.session_id)
        if not state:
            raise HTTPException(404, 'Session not found')
        students = state.get('students', [])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'generate_session_summary: {e}')
        raise HTTPException(500, 'Failed to load session state')

    class_scores: list[float] = []
    all_alerts  = _svc.get_alerts(body.session_id, limit=500)
    all_quizzes = _svc.list_quizzes(body.session_id)

    student_cards = []
    for student in students:
        sid  = student['id']
        name = student.get('name', '') or sid[:8]
        signals = _svc.get_recent_signals(body.session_id, sid, body.limit_per_student)
        if not signals:
            student_cards.append({
                'student_id': sid, 'student_name': name,
                'avg_engagement': None, 'peak_engagement': None,
                'low_engagement_count': 0, 'alerts_count': 0,
                'quiz_attempts': 0, 'quiz_correct': 0, 'quiz_accuracy': None,
                'dominant_signal': 'none', 'timeline': [],
            })
            continue
        scores    = [s.get('engagement_score') for s in signals if s.get('engagement_score') is not None]
        avg_score = _avg(scores)
        if avg_score is not None:
            class_scores.append(avg_score)
        type_counts     = Counter(s.get('signal_type', 'unknown') for s in signals)
        dominant_signal = type_counts.most_common(1)[0][0] if type_counts else 'none'
        student_alerts  = [a for a in all_alerts if a.get('student_id') == sid]
        q_attempts = q_correct = 0
        for q in all_quizzes:
            resps = _svc.get_quiz_responses(q['id'])
            mine  = [r for r in resps if r.get('student_id') == sid]
            if mine:
                q_attempts += len(mine)
                q_correct  += sum(1 for r in mine if r.get('is_correct') is True)
        student_cards.append({
            'student_id':         sid,
            'student_name':       name,
            'avg_engagement':     avg_score,
            'peak_engagement':    round(max(scores), 2) if scores else None,
            'low_engagement_count': sum(1 for s in scores if s < 40),
            'alerts_count':       len(student_alerts),
            'quiz_attempts':      q_attempts,
            'quiz_correct':       q_correct,
            'quiz_accuracy':      round(q_correct/q_attempts*100, 2) if q_attempts else None,
            'dominant_signal':    dominant_signal,
            'timeline':           [{
                't': str(s.get('created_at','')),
                'score': round(float(s['engagement_score']),2),
                'type': s.get('signal_type',''),
            } for s in reversed(signals) if s.get('engagement_score') is not None],
        })

    alert_reason_counts = Counter(a.get('message','') for a in all_alerts if a.get('message'))
    total_quiz_responses = total_correct = 0
    for q in all_quizzes:
        resps = _svc.get_quiz_responses(q['id'])
        total_quiz_responses += len(resps)
        total_correct        += sum(1 for r in resps if r.get('is_correct') is True)

    report = {
        'session_id':            body.session_id,
        'session_title':         state.get('title', 'Untitled Session'),
        'student_count':         len(students),
        'class_avg_engagement':  _avg(class_scores),
        'alerts_total':          len(all_alerts),
        'alerts_watch':          sum(1 for a in all_alerts if a.get('alert_type')=='watch'),
        'alerts_intervene':      sum(1 for a in all_alerts if a.get('alert_type')=='intervene'),
        'most_common_alert_reason': alert_reason_counts.most_common(1)[0][0] if alert_reason_counts else None,
        'quiz_count':            len(all_quizzes),
        'quiz_total_responses':  total_quiz_responses,
        'overall_quiz_accuracy': round(total_correct/total_quiz_responses*100,2) if total_quiz_responses else None,
        'students':              student_cards,
    }
    try:
        _svc.save_session_report(body.session_id, report)
    except Exception as e:
        logger.warning(f'save_session_report failed: {e}')
    return report


@router.get('/session/{session_id}', status_code=status.HTTP_200_OK)
def get_saved_report(session_id: str):
    try:
        r = _svc.get_latest_session_report(session_id)
        if not r:
            raise HTTPException(404, 'No saved report found')
        return r
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post('/generate-pdf/{session_id}', status_code=status.HTTP_200_OK)
def generate_all_pdfs(session_id: str):
    try:
        state = _svc.get_session_state(session_id)
        if not state:
            raise HTTPException(404, 'Session not found')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

    session_title = state.get('title', 'EngageX Session')
    results  = []
    students = run_all_students(session_id)

    for rpt in students:
        try:
            pdf_bytes = generate_pdf(rpt, session_title)
            url = _svc.upload_pdf(
                session_id=session_id,
                student_id=rpt.student_id,
                pdf_bytes=pdf_bytes,
            )
            _svc.save_student_pdf_url(session_id, rpt.student_id, url)
            results.append({'student_id': rpt.student_id, 'student_name': rpt.student_name, 'pdf_url': url})
        except Exception as e:
            logger.error(f'PDF gen student={rpt.student_id[:8]}: {e}')
            results.append({'student_id': rpt.student_id, 'student_name': rpt.student_name, 'pdf_url': None, 'error': str(e)})

    return {'session_id': session_id, 'reports': results}


@router.get('/pdf/{session_id}/{student_id}', status_code=status.HTTP_200_OK)
def stream_pdf(session_id: str, student_id: str):
    try:
        state = _svc.get_session_state(session_id)
        if not state:
            raise HTTPException(404, 'Session not found')
        session_title = state.get('title', 'EngageX Session')
        rpt       = run_report_crew(session_id, student_id)
        pdf_bytes = generate_pdf(rpt, session_title)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'stream_pdf: {e}')
        raise HTTPException(500, f'PDF generation failed: {e}')

    filename = f'engagex_{student_id[:8]}_report.pdf'
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
