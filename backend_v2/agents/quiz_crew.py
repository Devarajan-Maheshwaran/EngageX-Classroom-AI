"""
quiz_crew.py — Phase 13

CrewAI-powered quiz intelligence.

Two agents:
  1. Quiz Monitor     — deterministic: tracks non-responders, late subs,
                         open-question patterns. No LLM needed.
  2. Quiz Analyst     — uses Groq LLM to identify confusing questions,
                         lucky guesses, confident misconceptions, and
                         correlates with student engagement signals.

Entry point:
  run_quiz_analysis(quiz_id, session_id) -> dict

Output (stored in quizzes.quiz_insights JSONB):
  {
    non_responders:           [student_id, ...]
    late_responders:          [student_id, ...]
    confusion_ratio:          float   (0-1)
    misconception_options:    [option_id, ...]  (most chosen wrong answers)
    low_engagement_students:  [student_id, ...]  (correlated from signals)
    analyst_summary:          str     (Groq natural language insight)
    analyst_suggestions:      [str, ...]
  }
"""

import os
import logging
from typing import Optional
from crewai import Agent, Task, Crew, Process
from crewai.tools import tool as crewai_tool
from langchain_groq import ChatGroq
from services.supabase_service import SupabaseService

logger = logging.getLogger('engagex.quiz_crew')
_svc = SupabaseService()

GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama3-8b-8192')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')


def _get_llm():
    return ChatGroq(
        model=GROQ_MODEL,
        api_key=GROQ_API_KEY,
        temperature=0.3,
        max_tokens=512,
    )


# ── Tools ──────────────────────────────────────────────────────────────────

@crewai_tool('fetch_quiz_data')
def fetch_quiz_data(quiz_id: str, session_id: str) -> dict:
    """Fetch quiz details, all responses, and student engagement signals."""
    try:
        quiz = _svc.get_quiz(quiz_id)
        responses = _svc.get_quiz_responses(quiz_id)
        state = _svc.get_session_state(session_id)
        students = state.get('students', []) if state else []
        student_ids = [s['id'] for s in students]

        # Fetch last 5 signals per student for correlation
        engagement_map = {}
        for sid in student_ids:
            sigs = _svc.get_recent_signals(session_id, sid, 5)
            scores = [s['engagement_score'] for s in sigs if s.get('engagement_score') is not None]
            engagement_map[sid] = round(sum(scores) / len(scores), 2) if scores else None

        return {
            'quiz': quiz,
            'responses': responses,
            'student_ids': student_ids,
            'engagement_map': engagement_map,
        }
    except Exception as e:
        logger.error(f'fetch_quiz_data: {e}')
        return {'quiz': {}, 'responses': [], 'student_ids': [], 'engagement_map': {}}


@crewai_tool('compute_monitor_stats')
def compute_monitor_stats(student_ids: list, responses: list, quiz: dict) -> dict:
    """
    Deterministic monitor stats:
    - non_responders: students with no response
    - confusion_ratio: fraction of students who answered incorrectly
    - misconception_options: most chosen wrong answer option IDs
    - option_distribution: counts per option
    """
    responded_ids = {r['student_id'] for r in responses}
    non_responders = [sid for sid in student_ids if sid not in responded_ids]

    correct_id = quiz.get('correct_id')
    option_counts: dict = {}
    wrong_answers = []
    for r in responses:
        oid = r.get('answer_id')
        if oid:
            option_counts[oid] = option_counts.get(oid, 0) + 1
            if correct_id and oid != correct_id:
                wrong_answers.append(oid)

    total_resp = len(responses)
    wrong_count = len(wrong_answers)
    confusion_ratio = round(wrong_count / total_resp, 4) if total_resp else 0.0

    # Most common wrong options
    wrong_counts: dict = {}
    for oid in wrong_answers:
        wrong_counts[oid] = wrong_counts.get(oid, 0) + 1
    misconception_options = sorted(wrong_counts, key=lambda k: wrong_counts[k], reverse=True)[:2]

    return {
        'non_responders': non_responders,
        'non_responder_count': len(non_responders),
        'total_students': len(student_ids),
        'total_responses': total_resp,
        'response_rate': round(total_resp / len(student_ids), 4) if student_ids else 0.0,
        'confusion_ratio': confusion_ratio,
        'misconception_options': misconception_options,
        'option_distribution': option_counts,
    }


# ── Deterministic path (no Groq key required) ──────────────────────────────────

def _deterministic_insights(monitor: dict, quiz: dict, engagement_map: dict) -> dict:
    """Fallback: build insight text without Groq."""
    q_text = quiz.get('question', 'this question')[:80]
    confusion_pct = round(monitor['confusion_ratio'] * 100)
    nr = monitor['non_responder_count']
    suggestions = []

    summary_parts = []
    if confusion_pct >= 50:
        summary_parts.append(f"{confusion_pct}% of students answered incorrectly on '{q_text}'.")
        suggestions.append('Consider re-explaining the concept before moving on.')
    elif confusion_pct >= 25:
        summary_parts.append(f"{confusion_pct}% confusion rate on '{q_text}'.")
        suggestions.append('A quick clarification or follow-up question may help.')
    else:
        summary_parts.append(f"Good comprehension on '{q_text}' ({100 - confusion_pct}% correct).")

    if nr > 0:
        summary_parts.append(f"{nr} student(s) did not respond.")
        suggestions.append(f'Check in with non-responding students ({nr}) individually.')

    low_eng = [sid for sid, score in engagement_map.items() if score is not None and score < 40]
    if low_eng:
        suggestions.append(f'{len(low_eng)} student(s) have low engagement — consider a direct re-engagement prompt.')

    return {
        'analyst_summary': ' '.join(summary_parts),
        'analyst_suggestions': suggestions,
        'low_engagement_students': low_eng,
    }


# ── Groq analyst path ──────────────────────────────────────────────────────────────────

def _groq_analyst_insights(monitor: dict, quiz: dict, engagement_map: dict) -> dict:
    """Use Groq LLM for richer natural-language quiz insights."""
    low_eng = [sid for sid, score in engagement_map.items() if score is not None and score < 40]

    context = (
        f"Quiz question: \"{quiz.get('question', '')}\".\n"
        f"Type: {quiz.get('quiz_type', 'mcq')}.\n"
        f"Options: {quiz.get('options', [])}.\n"
        f"Correct answer: {quiz.get('correct_id', 'N/A')}.\n"
        f"Total students: {monitor['total_students']}, Responses: {monitor['total_responses']}.\n"
        f"Confusion ratio: {round(monitor['confusion_ratio']*100)}%.\n"
        f"Most chosen wrong options: {monitor['misconception_options']}.\n"
        f"Non-responders: {monitor['non_responder_count']}.\n"
        f"Option distribution: {monitor['option_distribution']}.\n"
        f"Low-engagement students count: {len(low_eng)}.\n"
    )

    prompt = (
        "You are an expert educational AI. Given the following quiz response data from a live classroom, "
        "provide:\n1. A concise summary (2-3 sentences) of how well students understood this topic.\n"
        "2. Two to three specific actionable suggestions for the teacher.\n"
        "Be direct and practical. Output valid JSON with keys: summary (str), suggestions (list of str).\n\n"
        + context
    )

    try:
        llm = _get_llm()
        resp = llm.invoke(prompt)
        import json, re
        raw = resp.content if hasattr(resp, 'content') else str(resp)
        # Extract JSON block
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            return {
                'analyst_summary': parsed.get('summary', raw[:200]),
                'analyst_suggestions': parsed.get('suggestions', []),
                'low_engagement_students': low_eng,
            }
        return {'analyst_summary': raw[:300], 'analyst_suggestions': [], 'low_engagement_students': low_eng}
    except Exception as e:
        logger.warning(f'Groq analyst failed: {e} — falling back to deterministic')
        return _deterministic_insights(monitor, quiz, engagement_map)


# ── Main entry point ────────────────────────────────────────────────────────────────

def run_quiz_analysis(quiz_id: str, session_id: str) -> dict:
    """
    Full quiz intelligence pipeline.
    Gracefully degrades to deterministic if Groq key is not set.
    """
    # Step 1 — fetch all data
    data = fetch_quiz_data.run(quiz_id=quiz_id, session_id=session_id)
    quiz = data['quiz']
    responses = data['responses']
    student_ids = data['student_ids']
    engagement_map = data['engagement_map']

    if not quiz:
        raise ValueError(f'Quiz {quiz_id} not found')

    # Step 2 — monitor stats (deterministic)
    monitor = compute_monitor_stats.run(
        student_ids=student_ids,
        responses=responses,
        quiz=quiz,
    )

    # Step 3 — analyst (Groq if key present, else deterministic)
    if GROQ_API_KEY:
        analyst = _groq_analyst_insights(monitor, quiz, engagement_map)
    else:
        analyst = _deterministic_insights(monitor, quiz, engagement_map)

    # Step 4 — merge
    insights = {
        **monitor,
        **analyst,
        'quiz_id': quiz_id,
        'session_id': session_id,
    }

    # Step 5 — persist to quizzes.quiz_insights
    try:
        _svc.save_quiz_insights(quiz_id, insights)
    except Exception as e:
        logger.warning(f'save_quiz_insights failed: {e}')

    logger.info(
        f'[QuizCrew] quiz={quiz_id[:8]} confusion={monitor["confusion_ratio"]} '
        f'non_resp={monitor["non_responder_count"]} groq={bool(GROQ_API_KEY)}'
    )
    return insights
