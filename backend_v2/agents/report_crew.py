"""
report_crew.py — Phase 14

CrewAI Report Crew: generates per-student narrative summaries.

Two agents:
  1. Per-Student Profiler  — deterministic aggregation of all signals,
                              alerts, quiz results for a single student.
  2. Report Writer (Groq)  — writes a 3-4 sentence narrative + follow-up
                              recommendations from the profile.

Entry point:
  run_report_crew(session_id, student_id) -> StudentReportData
  run_all_students(session_id)            -> list[StudentReportData]
"""

import os
import logging
from collections import Counter
from typing import Optional
from services.supabase_service import SupabaseService

logger = logging.getLogger('engagex.report_crew')
_svc = SupabaseService()

GROQ_MODEL   = os.getenv('GROQ_MODEL',   'llama3-8b-8192')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')


# ── Data model ────────────────────────────────────────────────────────────────

class StudentReportData:
    def __init__(
        self,
        student_id:        str,
        student_name:      str,
        avg_engagement:    Optional[float],
        peak_engagement:   Optional[float],
        min_engagement:    Optional[float],
        participation_rate: float,
        quiz_attempts:     int,
        quiz_accuracy:     Optional[float],
        alerts_watch:      int,
        alerts_intervene:  int,
        dominant_signal:   str,
        key_behaviors:     list[str],
        timeline:          list[dict],
        quiz_rows:         list[dict],
        narrative:         str,
        recommendations:   list[str],
    ):
        self.student_id        = student_id
        self.student_name      = student_name
        self.avg_engagement    = avg_engagement
        self.peak_engagement   = peak_engagement
        self.min_engagement    = min_engagement
        self.participation_rate = participation_rate
        self.quiz_attempts     = quiz_attempts
        self.quiz_accuracy     = quiz_accuracy
        self.alerts_watch      = alerts_watch
        self.alerts_intervene  = alerts_intervene
        self.dominant_signal   = dominant_signal
        self.key_behaviors     = key_behaviors
        self.timeline          = timeline
        self.quiz_rows         = quiz_rows
        self.narrative         = narrative
        self.recommendations   = recommendations

    def to_dict(self) -> dict:
        return {
            'student_id':         self.student_id,
            'student_name':       self.student_name,
            'avg_engagement':     self.avg_engagement,
            'peak_engagement':    self.peak_engagement,
            'min_engagement':     self.min_engagement,
            'participation_rate': self.participation_rate,
            'quiz_attempts':      self.quiz_attempts,
            'quiz_accuracy':      self.quiz_accuracy,
            'alerts_watch':       self.alerts_watch,
            'alerts_intervene':   self.alerts_intervene,
            'dominant_signal':    self.dominant_signal,
            'key_behaviors':      self.key_behaviors,
            'narrative':          self.narrative,
            'recommendations':    self.recommendations,
        }


# ── Profiler (deterministic) ──────────────────────────────────────────────────

def _profile_student(
    session_id: str,
    student_id: str,
    student_name: str,
    all_quizzes: list,
    all_alerts: list,
) -> dict:
    signals = _svc.get_recent_signals(session_id, student_id, limit=200)
    scores  = [s['engagement_score'] for s in signals if s.get('engagement_score') is not None]

    avg_eng  = round(sum(scores) / len(scores), 2) if scores else None
    peak_eng = round(max(scores), 2)                if scores else None
    min_eng  = round(min(scores), 2)                if scores else None

    type_counts    = Counter(s.get('signal_type', 'unknown') for s in signals)
    dominant       = type_counts.most_common(1)[0][0] if type_counts else 'none'
    total_signals  = len(signals)

    # Participation: fraction of signal types that are active (not just idle)
    active_types   = {'text', 'audio', 'quiz_response'}
    active_signals = sum(v for k, v in type_counts.items() if k in active_types)
    part_rate      = round(active_signals / total_signals, 4) if total_signals else 0.0

    # Key behaviors
    behaviors = []
    del_count = sum(
        1 for s in signals
        if s.get('signal_type') == 'text'
        and s.get('signal_data', {}).get('is_deleted')
    )
    if del_count > 0:
        behaviors.append(f'Deleted {del_count} message(s) without sending')
    low_count = sum(1 for sc in scores if sc < 40)
    if low_count > 0:
        behaviors.append(f'{low_count} low-engagement window(s) (score < 40)')
    vision_sigs = [s for s in signals if s.get('signal_type') == 'vision']
    away_ratios = [
        s['signal_data'].get('looking_away_ratio', 0)
        for s in vision_sigs
        if isinstance(s.get('signal_data'), dict)
    ]
    if away_ratios:
        avg_away = sum(away_ratios) / len(away_ratios)
        if avg_away > 0.4:
            behaviors.append(f'High look-away ratio ({round(avg_away*100)}% of session)')

    # Alerts
    my_alerts    = [a for a in all_alerts if a.get('student_id') == student_id]
    watch_count  = sum(1 for a in my_alerts if a.get('alert_type') == 'watch')
    inter_count  = sum(1 for a in my_alerts if a.get('alert_type') == 'intervene')

    # Quiz rows
    quiz_rows    = []
    q_attempts   = 0
    q_correct    = 0
    for q in all_quizzes:
        resps = _svc.get_quiz_responses(q['id'])
        mine  = [r for r in resps if r.get('student_id') == student_id]
        if mine:
            r0 = mine[0]
            quiz_rows.append({
                'question':   q.get('question', '')[:60],
                'answer':     r0.get('answer_id') or r0.get('answer_text', ''),
                'is_correct': r0.get('is_correct'),
            })
            q_attempts += 1
            if r0.get('is_correct'):
                q_correct += 1
        else:
            quiz_rows.append({'question': q.get('question', '')[:60], 'answer': '—', 'is_correct': None})

    q_accuracy = round(q_correct / q_attempts * 100, 2) if q_attempts else None

    # Timeline (last 30 points for PDF chart)
    timeline = [
        {'t': str(s.get('created_at', '')), 'score': round(float(s['engagement_score']), 2)}
        for s in reversed(signals)
        if s.get('engagement_score') is not None
    ][-30:]

    return {
        'student_id':         student_id,
        'student_name':       student_name,
        'avg_engagement':     avg_eng,
        'peak_engagement':    peak_eng,
        'min_engagement':     min_eng,
        'participation_rate': part_rate,
        'quiz_attempts':      q_attempts,
        'quiz_accuracy':      q_accuracy,
        'alerts_watch':       watch_count,
        'alerts_intervene':   inter_count,
        'dominant_signal':    dominant,
        'key_behaviors':      behaviors,
        'timeline':           timeline,
        'quiz_rows':          quiz_rows,
    }


# ── Report Writer ─────────────────────────────────────────────────────────────

def _write_narrative(profile: dict) -> tuple[str, list[str]]:
    """Groq if key present, else deterministic fallback."""
    if GROQ_API_KEY:
        return _groq_narrative(profile)
    return _deterministic_narrative(profile)


def _deterministic_narrative(p: dict) -> tuple[str, list[str]]:
    name  = p['student_name'] or 'This student'
    avg   = p['avg_engagement']
    part  = round((p['participation_rate'] or 0) * 100)
    qa    = p['quiz_accuracy']
    inter = p['alerts_intervene']

    sentences = []
    if avg is not None:
        level = 'high' if avg >= 65 else 'moderate' if avg >= 40 else 'low'
        sentences.append(f"{name} maintained a {level} average engagement score of {avg}/100 during this session.")
    if part:
        sentences.append(f"Active participation rate was {part}%.")
    if qa is not None:
        sentences.append(f"Quiz accuracy was {qa}%, with {p['quiz_attempts']} question(s) attempted.")
    if inter > 0:
        sentences.append(f"{inter} intervention alert(s) were triggered — follow-up is recommended.")

    recs = []
    if avg is not None and avg < 40:
        recs.append('Schedule a one-on-one check-in to understand barriers to engagement.')
    if qa is not None and qa < 50:
        recs.append('Review the topics covered in this session with targeted practice questions.')
    if p['alerts_intervene'] > 1:
        recs.append('Monitor closely in upcoming sessions and consider adjusting teaching pace.')
    if not recs:
        recs.append('Continue current learning approach; student is performing well.')

    narrative = ' '.join(sentences) or f'{name} participated in this session.'
    return narrative, recs


def _groq_narrative(p: dict) -> tuple[str, list[str]]:
    from langchain_groq import ChatGroq
    import json, re
    context = (
        f"Student: {p['student_name']}.\n"
        f"Avg engagement: {p['avg_engagement']}/100. Peak: {p['peak_engagement']}. Min: {p['min_engagement']}.\n"
        f"Participation rate: {round((p['participation_rate'] or 0)*100)}%.\n"
        f"Quiz accuracy: {p['quiz_accuracy']}% ({p['quiz_attempts']} attempts).\n"
        f"Alerts — watch: {p['alerts_watch']}, intervene: {p['alerts_intervene']}.\n"
        f"Key behaviors: {'; '.join(p['key_behaviors']) or 'none detected'}.\n"
        f"Dominant signal type: {p['dominant_signal']}.\n"
    )
    prompt = (
        "You are an educational AI writing a post-session student report for a teacher.\n"
        "Given the student data below, write:\n"
        "1. narrative: A 3-4 sentence objective summary of the student's engagement and performance.\n"
        "2. recommendations: 2-3 specific, actionable follow-up suggestions for the teacher.\n"
        "Output valid JSON with keys: narrative (str), recommendations (list of str).\n\n"
        + context
    )
    try:
        llm  = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.3, max_tokens=400)
        resp = llm.invoke(prompt)
        raw  = resp.content if hasattr(resp, 'content') else str(resp)
        m    = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            parsed = json.loads(m.group())
            return parsed.get('narrative', raw[:300]), parsed.get('recommendations', [])
        return raw[:300], []
    except Exception as e:
        logger.warning(f'Groq narrative failed: {e} — falling back')
        return _deterministic_narrative(p)


# ── Public entry points ───────────────────────────────────────────────────────

def run_report_crew(session_id: str, student_id: str) -> StudentReportData:
    state = _svc.get_session_state(session_id)
    if not state:
        raise ValueError(f'Session {session_id} not found')
    students    = state.get('students', [])
    student_rec = next((s for s in students if s['id'] == student_id), None)
    if not student_rec:
        raise ValueError(f'Student {student_id} not in session')

    all_quizzes = _svc.list_quizzes(session_id)
    all_alerts  = _svc.get_alerts(session_id, limit=500)

    profile             = _profile_student(session_id, student_id, student_rec.get('name', ''), all_quizzes, all_alerts)
    narrative, recs     = _write_narrative(profile)

    return StudentReportData(
        **{k: profile[k] for k in [
            'student_id', 'student_name', 'avg_engagement', 'peak_engagement',
            'min_engagement', 'participation_rate', 'quiz_attempts', 'quiz_accuracy',
            'alerts_watch', 'alerts_intervene', 'dominant_signal', 'key_behaviors',
            'timeline', 'quiz_rows',
        ]},
        narrative=narrative,
        recommendations=recs,
    )


def run_all_students(session_id: str) -> list[StudentReportData]:
    state = _svc.get_session_state(session_id)
    if not state:
        raise ValueError(f'Session {session_id} not found')
    results = []
    for s in state.get('students', []):
        try:
            results.append(run_report_crew(session_id, s['id']))
        except Exception as e:
            logger.warning(f'run_report_crew student={s["id"][:8]}: {e}')
    return results
