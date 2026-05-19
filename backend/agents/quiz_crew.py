import os
import json
import re
import logging
from services.supabase_service import SupabaseService

logger = logging.getLogger('engagex.quiz_crew')
_svc = SupabaseService()

GROQ_MODEL   = os.getenv('GROQ_MODEL',   'llama3-8b-8192')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')


def _fetch_quiz_data(quiz_id: str) -> dict:
    quiz      = _svc.get_quiz(quiz_id)
    responses = _svc.get_quiz_responses(quiz_id)
    total     = len(responses)
    correct   = sum(1 for r in responses if r.get('is_correct') is True)
    wrong     = sum(1 for r in responses if r.get('is_correct') is False)
    skipped   = total - correct - wrong

    option_counts: dict[str, int] = {}
    for r in responses:
        aid = r.get('answer_id') or r.get('answer_text', 'open')
        option_counts[str(aid)] = option_counts.get(str(aid), 0) + 1

    options      = quiz.get('options') or []
    most_wrong   = None
    most_wrong_n = 0
    correct_id   = str(quiz.get('correct_id', ''))
    for opt in options:
        oid = str(opt.get('id', ''))
        if oid != correct_id:
            n = option_counts.get(oid, 0)
            if n > most_wrong_n:
                most_wrong_n = n
                most_wrong   = opt.get('text', oid)

    return {
        'question':    quiz.get('question', ''),
        'quiz_type':   quiz.get('quiz_type', 'mcq'),
        'total':       total,
        'correct':     correct,
        'wrong':       wrong,
        'skipped':     skipped,
        'accuracy':    round(correct / total * 100, 1) if total else 0,
        'most_wrong_option': most_wrong,
        'option_counts':     option_counts,
    }


def _groq_analysis(data: dict) -> dict:
    prompt = (
        "You are an educational AI analyst. Given quiz results, produce a brief analysis.\n"
        "Return JSON with keys:\n"
        "  summary: one sentence describing overall class performance.\n"
        "  misconception: the most likely misconception if accuracy < 70%, else null.\n"
        "  suggestion: one actionable teaching suggestion for the teacher.\n\n"
        f"Question: {data['question']}\n"
        f"Accuracy: {data['accuracy']}% ({data['correct']}/{data['total']} correct)\n"
        f"Most-chosen wrong answer: {data['most_wrong_option']}\n"
        f"Skipped: {data['skipped']}\n"
    )
    try:
        from langchain_groq import ChatGroq
        llm  = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.3, max_tokens=200)
        resp = llm.invoke(prompt)
        raw  = resp.content if hasattr(resp, 'content') else str(resp)
        m    = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
    except Exception as e:
        logger.warning(f'Groq quiz analysis failed: {e}')
    return _deterministic_analysis(data)


def _deterministic_analysis(data: dict) -> dict:
    acc = data['accuracy']
    summary = (
        f"{acc}% of students answered correctly ({data['correct']}/{data['total']})."
    )
    misconception = None
    if acc < 70 and data['most_wrong_option']:
        misconception = f"Many students chose '{data['most_wrong_option']}', suggesting a misunderstanding."
    suggestion = (
        'Consider revisiting this topic with a worked example.'
        if acc < 60 else
        'Most students understood — briefly clarify edge cases before moving on.'
        if acc < 80 else
        'Class performance is strong. Proceed to the next topic.'
    )
    return {'summary': summary, 'misconception': misconception, 'suggestion': suggestion}


def run_quiz_crew(quiz_id: str) -> dict:
    data     = _fetch_quiz_data(quiz_id)
    analysis = _groq_analysis(data) if GROQ_API_KEY else _deterministic_analysis(data)
    insights = {**data, **analysis}
    try:
        _svc.save_quiz_insights(quiz_id, insights)
    except Exception as e:
        logger.warning(f'save_quiz_insights: {e}')
    return insights
