"""
routers/report.py — Phase 12

End-of-session summary report generator.

Routes (prefix /api/report):
  POST /session-summary  → generate summary JSON for a session
  GET  /session/{session_id} → fetch last generated report if stored

Output includes:
  - class average engagement
  - alert counts and most common alert reason
  - quiz participation + accuracy
  - per-student summary cards
  - timeline buckets for charting on frontend
"""

import logging
from collections import Counter
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from services.supabase_service import SupabaseService

router = APIRouter()
logger = logging.getLogger('engagex.report')
_svc = SupabaseService()


class SessionSummaryRequest(BaseModel):
    session_id: str
    limit_per_student: int = 100


def _avg(nums: list[float]) -> float | None:
    vals = [n for n in nums if isinstance(n, (int, float))]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


def _student_timeline(signals: list[dict]) -> list[dict]:
    """
    Converts recent signals into simple timeline points.
    Frontend can plot these directly without extra transformation.
    """
    points = []
    for s in reversed(signals):
        score = s.get('engagement_score')
        if score is None:
            continue
        points.append({
            't': str(s.get('created_at', '')),
            'score': round(float(score), 2),
            'type': s.get('signal_type', 'unknown'),
        })
    return points


@router.post('/session-summary', status_code=status.HTTP_200_OK)
def generate_session_summary(body: SessionSummaryRequest):
    """
    Build a full summary from persisted session data.
    Also stores the generated report in Supabase for later retrieval.
    """
    try:
        state = _svc.get_session_state(body.session_id)
        if not state:
            raise HTTPException(404, 'Session not found')
        students = state.get('students', [])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'generate_session_summary get_session_state: {e}')
        raise HTTPException(500, 'Failed to load session state')

    # Session-wide aggregates
    class_scores: list[float] = []
    all_alerts = _svc.get_alerts(body.session_id, limit=500)
    all_quizzes = _svc.list_quizzes(body.session_id)

    student_cards = []
    for student in students:
        sid = student['id']
        name = student.get('name', '') or sid[:8]

        signals = _svc.get_recent_signals(body.session_id, sid, body.limit_per_student)
        if not signals:
            student_cards.append({
                'student_id': sid,
                'student_name': name,
                'avg_engagement': None,
                'peak_engagement': None,
                'low_engagement_count': 0,
                'alerts_count': 0,
                'quiz_attempts': 0,
                'quiz_correct': 0,
                'quiz_accuracy': None,
                'dominant_signal': 'none',
                'timeline': [],
            })
            continue

        scores = [s.get('engagement_score') for s in signals if s.get('engagement_score') is not None]
        avg_score = _avg(scores)
        peak_score = round(max(scores), 2) if scores else None
        low_count = sum(1 for s in scores if s < 40)
        if avg_score is not None:
            class_scores.append(avg_score)

        # dominant signal type by frequency
        type_counts = Counter(s.get('signal_type', 'unknown') for s in signals)
        dominant_signal = type_counts.most_common(1)[0][0] if type_counts else 'none'

        # alerts for this student
        student_alerts = [a for a in all_alerts if a.get('student_id') == sid]

        # quiz responses for this student across session quizzes
        quiz_attempts = 0
        quiz_correct = 0
        for q in all_quizzes:
            resps = _svc.get_quiz_responses(q['id'])
            mine = [r for r in resps if r.get('student_id') == sid]
            if mine:
                quiz_attempts += len(mine)
                quiz_correct += sum(1 for r in mine if r.get('is_correct') is True)

        quiz_accuracy = round((quiz_correct / quiz_attempts) * 100, 2) if quiz_attempts else None

        student_cards.append({
            'student_id': sid,
            'student_name': name,
            'avg_engagement': avg_score,
            'peak_engagement': peak_score,
            'low_engagement_count': low_count,
            'alerts_count': len(student_alerts),
            'quiz_attempts': quiz_attempts,
            'quiz_correct': quiz_correct,
            'quiz_accuracy': quiz_accuracy,
            'dominant_signal': dominant_signal,
            'timeline': _student_timeline(signals),
        })

    # Session metrics
    class_avg_engagement = _avg(class_scores)
    alert_reason_counts = Counter(a.get('message', '') for a in all_alerts if a.get('message'))
    most_common_alert_reason = alert_reason_counts.most_common(1)[0][0] if alert_reason_counts else None

    total_quiz_responses = 0
    total_correct = 0
    for q in all_quizzes:
        resps = _svc.get_quiz_responses(q['id'])
        total_quiz_responses += len(resps)
        total_correct += sum(1 for r in resps if r.get('is_correct') is True)

    overall_quiz_accuracy = round((total_correct / total_quiz_responses) * 100, 2) if total_quiz_responses else None

    report = {
        'session_id': body.session_id,
        'session_title': state.get('title', 'Untitled Session'),
        'student_count': len(students),
        'class_avg_engagement': class_avg_engagement,
        'alerts_total': len(all_alerts),
        'alerts_watch': sum(1 for a in all_alerts if a.get('alert_type') == 'watch'),
        'alerts_intervene': sum(1 for a in all_alerts if a.get('alert_type') == 'intervene'),
        'most_common_alert_reason': most_common_alert_reason,
        'quiz_count': len(all_quizzes),
        'quiz_total_responses': total_quiz_responses,
        'overall_quiz_accuracy': overall_quiz_accuracy,
        'students': student_cards,
    }

    try:
        _svc.save_session_report(body.session_id, report)
    except Exception as e:
        logger.warning(f'save_session_report failed: {e}')

    return report


@router.get('/session/{session_id}', status_code=status.HTTP_200_OK)
def get_saved_report(session_id: str):
    try:
        report = _svc.get_latest_session_report(session_id)
        if not report:
            raise HTTPException(404, 'No saved report found for this session')
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'get_saved_report: {e}')
        raise HTTPException(500, 'Failed to fetch report')
