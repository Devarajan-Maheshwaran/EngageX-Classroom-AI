import os
import logging
from typing import Optional
import db.py_store as _svc
from agents.llm_client import get_llm

logger = logging.getLogger('engagex.aggregator')

WEIGHTS = {
    'vision':        0.35,
    'audio':         0.25,
    'text':          0.25,
    'quiz_response': 0.15,
}


def fuse_scores(signals: list[dict]) -> Optional[float]:
    if not signals:
        return None
    weighted_sum = total_weight = 0.0
    for s in signals:
        score = s.get('engagement_score')
        stype = s.get('signal_type', 'text')
        if score is not None:
            w = WEIGHTS.get(stype, 0.15)
            weighted_sum  += score * w
            total_weight  += w
    return round(weighted_sum / total_weight, 2) if total_weight > 0 else None


def classify_alert(score: float) -> Optional[str]:
    if score < 30:
        return 'intervene'
    if score < 50:
        return 'watch'
    return None


def build_alert_message(score: float, signals: list[dict], student_name: str) -> str:
    if GROQ_API_KEY:
        return _groq_message(score, signals, student_name)
    return _deterministic_message(score, signals, student_name)


def _deterministic_message(score: float, signals: list[dict], student_name: str) -> str:
    name  = student_name or 'Student'
    level = 'critically low' if score < 30 else 'low'
    types = list({s.get('signal_type', 'unknown') for s in signals})
    return (
        f"{name} has {level} engagement (score {score:.0f}/100). "
        f"Active signals: {', '.join(types)}."
    )


def _groq_message(score: float, signals: list[dict], student_name: str) -> str:
    import json, re
    context = [
        {
            'type':  s.get('signal_type'),
            'score': s.get('engagement_score'),
            'data':  {
                k: v for k, v in (s.get('signal_data') or {}).items()
                if k in ('sentiment', 'emotion', 'transcript', 'looking_away_ratio', 'is_deleted')
            },
        }
        for s in signals[:5]
    ]
    prompt = (
        f"Student '{student_name}' has a fused engagement score of {score:.1f}/100 (100=fully engaged).\n"
        f"Recent signals: {json.dumps(context, default=str)}\n"
        "Write one concise sentence (max 20 words) telling the teacher exactly why this student needs attention."
    )
    try:
        llm  = get_llm(temperature=0.2, max_tokens=60)
        resp = llm.invoke(prompt)
        return (resp.content if hasattr(resp, 'content') else str(resp)).strip()
    except Exception as e:
        logger.warning(f'Groq message failed: {e}')
        return _deterministic_message(score, signals, student_name)


def run_aggregation(session_id: str, student_id: str, student_name: str) -> dict:
    signals      = _svc.get_recent_signals(session_id, student_id, limit=10)
    fused        = fuse_scores(signals)
    alert_type   = classify_alert(fused) if fused is not None else None
    alert_saved  = None

    if alert_type:
        message    = build_alert_message(fused, signals, student_name)
        alert_saved = _svc.save_alert(
            session_id=session_id,
            student_id=student_id,
            alert_type=alert_type,
            message=message,
            fused_score=fused,
        )
        logger.info(f'[Alert] {alert_type} student={student_id[:8]} score={fused}')

    return {
        'student_id':   student_id,
        'fused_score':  fused,
        'alert_type':   alert_type,
        'alert':        alert_saved,
        'signal_count': len(signals),
    }
