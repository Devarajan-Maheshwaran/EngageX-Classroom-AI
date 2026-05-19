"""
signal_aggregator.py — Phase 9

CrewAI agent: SignalAggregatorAgent

Responsibility:
  Consume the last N signals for a student, fuse them into a single
  engagement snapshot, and decide if an alert should be raised.

Inputs (from Supabase via SupabaseService):
  - Recent text signals    (NLP sentiment, intent, engagement_score)
  - Recent vision signals  (face presence, expression, eye open ratio)
  - Recent audio signals   (transcript, vocal emotion, engagement_score)

Output:
  {
    student_id:        str
    fused_score:       float  (0-100, weighted average)
    primary_signal:    str    (which modality drove the score)
    alert_level:       'none' | 'watch' | 'intervene'
    alert_reason:      str
    summary:           str    (human-readable 1-liner for teacher)
    raw_scores:        { text, vision, audio }
  }

Fusion weights (tunable via env vars):
  TEXT_WEIGHT   = 0.40
  VISION_WEIGHT = 0.35
  AUDIO_WEIGHT  = 0.25
"""

import os
import logging
from typing import Optional
from crewai import Agent, Task, Crew
from crewai.tools import tool as crewai_tool
from services.supabase_service import SupabaseService

logger = logging.getLogger('engagex.aggregator')

TEXT_WEIGHT   = float(os.getenv('FUSION_TEXT_WEIGHT',   '0.40'))
VISION_WEIGHT = float(os.getenv('FUSION_VISION_WEIGHT', '0.35'))
AUDIO_WEIGHT  = float(os.getenv('FUSION_AUDIO_WEIGHT',  '0.25'))

ALERT_THRESHOLDS = {
    'intervene': 30.0,
    'watch':     50.0,
}

_svc = SupabaseService()


# ───────────────────────────────────────────────────────────────
# CrewAI tools
# ───────────────────────────────────────────────────────────────

@crewai_tool('fetch_recent_signals')
def fetch_recent_signals(student_id: str, session_id: str, limit: int = 10) -> dict:
    """Fetch the most recent signals for a student in a session from Supabase."""
    try:
        signals = _svc.get_recent_signals(
            session_id=session_id,
            student_id=student_id,
            limit=limit,
        )
        # Group by type
        by_type: dict = {'text': [], 'vision': [], 'audio': [], 'other': []}
        for s in signals:
            t = s.get('signal_type', 'other')
            key = t if t in by_type else 'other'
            by_type[key].append({
                'engagement_score': s.get('engagement_score'),
                'signal_data':      s.get('signal_data', {}),
                'created_at':       str(s.get('created_at', '')),
            })
        return by_type
    except Exception as e:
        logger.error(f'fetch_recent_signals: {e}')
        return {'text': [], 'vision': [], 'audio': [], 'other': []}


@crewai_tool('compute_fused_score')
def compute_fused_score(text_scores: list, vision_scores: list, audio_scores: list) -> dict:
    """
    Weighted average fusion of engagement scores across three modalities.
    Returns fused_score, per-modality averages, primary_signal.
    """
    def avg(scores: list) -> Optional[float]:
        valid = [s for s in scores if s is not None and isinstance(s, (int, float))]
        return round(sum(valid) / len(valid), 2) if valid else None

    t_avg = avg(text_scores)
    v_avg = avg(vision_scores)
    a_avg = avg(audio_scores)

    weights, values = [], []
    if t_avg is not None: weights.append(TEXT_WEIGHT);   values.append(t_avg)
    if v_avg is not None: weights.append(VISION_WEIGHT); values.append(v_avg)
    if a_avg is not None: weights.append(AUDIO_WEIGHT);  values.append(a_avg)

    if not values:
        return {'fused_score': 50.0, 'text_avg': None, 'vision_avg': None,
                'audio_avg': None, 'primary_signal': 'none'}

    total_weight = sum(weights)
    fused = sum(v * w for v, w in zip(values, weights)) / total_weight

    # Primary signal = modality with the lowest score (most concerning)
    candidates = {k: v for k, v in [('text', t_avg), ('vision', v_avg), ('audio', a_avg)] if v is not None}
    primary = min(candidates, key=lambda k: candidates[k]) if candidates else 'none'

    return {
        'fused_score':   round(fused, 2),
        'text_avg':      t_avg,
        'vision_avg':    v_avg,
        'audio_avg':     a_avg,
        'primary_signal': primary,
    }


# ───────────────────────────────────────────────────────────────
# Deterministic aggregation (no LLM needed — keeps latency under 200ms)
# ───────────────────────────────────────────────────────────────

def _determine_alert(fused_score: float, primary_signal: str, signals_by_type: dict) -> tuple:
    """Returns (alert_level, alert_reason)."""

    # Check for deleted message pattern (high-value signal)
    deleted_count = sum(
        1 for s in signals_by_type.get('text', [])
        if s.get('signal_data', {}).get('is_deleted', False)
    )
    if deleted_count >= 2:
        return 'watch', f'{deleted_count} deleted/abandoned messages detected — possible hesitation'

    # Check vision: consistent face absence
    vision_sigs = signals_by_type.get('vision', [])
    if vision_sigs:
        avg_face = sum(s['signal_data'].get('face_present_ratio', 1.0) for s in vision_sigs) / len(vision_sigs)
        if avg_face < 0.4:
            return 'intervene', f'Face absent {round((1 - avg_face) * 100)}% of the time — student may have left'

    # Check audio: bored/silent emotion pattern
    audio_sigs = signals_by_type.get('audio', [])
    silent_count = sum(
        1 for s in audio_sigs
        if s.get('signal_data', {}).get('emotion') in ('silent', 'bored')
    )
    if silent_count >= 3:
        return 'watch', f'Student silent or disengaged for {silent_count} consecutive audio windows'

    # Fused score thresholds
    if fused_score < ALERT_THRESHOLDS['intervene']:
        return 'intervene', f'Fused engagement score critically low ({fused_score:.0f}/100) — immediate attention needed'
    if fused_score < ALERT_THRESHOLDS['watch']:
        return 'watch', f'Engagement score low ({fused_score:.0f}/100) via {primary_signal} signal'

    return 'none', ''


def _build_summary(student_id: str, fused_score: float, alert_level: str,
                   alert_reason: str, primary_signal: str) -> str:
    if alert_level == 'none':
        return f'Student {student_id[:8]}: engaged ({fused_score:.0f}/100)'
    return (
        f'Student {student_id[:8]}: [{alert_level.upper()}] — '
        f'score={fused_score:.0f}/100 via {primary_signal}. {alert_reason}'
    )


def run_aggregation(student_id: str, session_id: str, limit: int = 10) -> dict:
    """
    Main entry point — deterministic, no LLM call, runs in <200ms.
    Called by the polling loop in Phase 10.
    """
    signals_by_type = fetch_recent_signals.run(
        student_id=student_id,
        session_id=session_id,
        limit=limit,
    )

    text_scores   = [s['engagement_score'] for s in signals_by_type.get('text', [])]
    vision_scores = [s['engagement_score'] for s in signals_by_type.get('vision', [])]
    audio_scores  = [s['engagement_score'] for s in signals_by_type.get('audio', [])]

    fusion = compute_fused_score.run(
        text_scores=text_scores,
        vision_scores=vision_scores,
        audio_scores=audio_scores,
    )

    fused_score    = fusion['fused_score']
    primary_signal = fusion['primary_signal']

    alert_level, alert_reason = _determine_alert(fused_score, primary_signal, signals_by_type)

    summary = _build_summary(student_id, fused_score, alert_level, alert_reason, primary_signal)

    result = {
        'student_id':     student_id,
        'session_id':     session_id,
        'fused_score':    fused_score,
        'primary_signal': primary_signal,
        'alert_level':    alert_level,
        'alert_reason':   alert_reason,
        'summary':        summary,
        'raw_scores': {
            'text':   fusion['text_avg'],
            'vision': fusion['vision_avg'],
            'audio':  fusion['audio_avg'],
        },
    }

    # Persist alert to DB if actionable
    if alert_level != 'none':
        try:
            _svc.save_alert(
                session_id=session_id,
                student_id=student_id,
                alert_type=alert_level,
                message=alert_reason,
                fused_score=fused_score,
            )
        except Exception as e:
            logger.warning(f'save_alert failed: {e}')

    logger.info(f'[Aggregator] {summary}')
    return result
