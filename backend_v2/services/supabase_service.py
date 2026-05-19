"""
supabase_service.py — Phase 12 (updated)
Adds session report persistence helpers.
"""

import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger('engagex.supabase')


class SupabaseService:
    def __init__(self):
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
        if not url or not key:
            raise ValueError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
        self._client: Client = create_client(url, key)

    # ── Sessions ──────────────────────────────────────────────────────────────
    def create_session(self, teacher_id: str, title: str, code: str) -> dict:
        row = (self._client.table('sessions')
               .insert({'teacher_id': teacher_id, 'title': title, 'code': code, 'status': 'active'})
               .execute())
        return row.data[0]

    def get_session_by_code(self, code: str) -> Optional[dict]:
        res = (self._client.table('sessions').select('*')
               .eq('code', code).eq('status', 'active').limit(1).execute())
        return res.data[0] if res.data else None

    def get_session_state(self, session_id: str) -> Optional[dict]:
        res = (self._client.table('sessions')
               .select('*, session_students(id, name)')
               .eq('id', session_id).limit(1).execute())
        if not res.data:
            return None
        session = res.data[0]
        session['students'] = [
            {'id': s['id'], 'name': s.get('name', '')}
            for s in session.get('session_students', [])
        ]
        return session

    def get_active_sessions(self) -> list:
        res = (self._client.table('sessions')
               .select('id, session_students(id, name)')
               .eq('status', 'active').execute())
        sessions = []
        for row in (res.data or []):
            sessions.append({
                'id': row['id'],
                'students': [
                    {'id': s['id'], 'name': s.get('name', '')}
                    for s in row.get('session_students', [])
                ],
            })
        return sessions

    def join_session(self, session_id: str, student_name: str) -> dict:
        res = (self._client.table('session_students')
               .insert({'session_id': session_id, 'name': student_name})
               .execute())
        return res.data[0]

    # ── Signals ───────────────────────────────────────────────────────────────
    def save_signal(self, session_id: str, student_id: str, signal_type: str,
                    signal_data: dict, engagement_score: Optional[float] = None) -> dict:
        row = (self._client.table('student_signals')
               .insert({'session_id': session_id, 'student_id': student_id,
                        'signal_type': signal_type, 'signal_data': signal_data,
                        'engagement_score': engagement_score})
               .execute())
        return row.data[0]

    def get_recent_signals(self, session_id: str, student_id: str, limit: int = 10) -> list:
        res = (self._client.table('student_signals').select('*')
               .eq('session_id', session_id).eq('student_id', student_id)
               .order('created_at', desc=True).limit(limit).execute())
        return res.data or []

    # ── Alerts ────────────────────────────────────────────────────────────────
    def save_alert(self, session_id: str, student_id: str, alert_type: str,
                   message: str, fused_score: float) -> dict:
        row = (self._client.table('engagement_alerts')
               .insert({'session_id': session_id, 'student_id': student_id,
                        'alert_type': alert_type, 'message': message,
                        'fused_score': fused_score})
               .execute())
        return row.data[0]

    def get_alerts(self, session_id: str, limit: int = 50) -> list:
        res = (self._client.table('engagement_alerts').select('*')
               .eq('session_id', session_id)
               .order('created_at', desc=True).limit(limit).execute())
        return res.data or []

    # ── Quiz ──────────────────────────────────────────────────────────────────
    def create_quiz(self, session_id: str, teacher_id: str, question: str,
                    quiz_type: str, options: list, correct_id: Optional[str],
                    duration_s: int) -> dict:
        row = (self._client.table('quizzes')
               .insert({
                   'session_id': session_id, 'teacher_id': teacher_id,
                   'question': question, 'quiz_type': quiz_type,
                   'options': options, 'correct_id': correct_id,
                   'duration_s': duration_s, 'status': 'active',
               })
               .execute())
        return row.data[0]

    def get_quiz(self, quiz_id: str) -> dict:
        res = (self._client.table('quizzes').select('*')
               .eq('id', quiz_id).limit(1).execute())
        if not res.data:
            raise ValueError(f'Quiz {quiz_id} not found')
        return res.data[0]

    def save_quiz_response(self, quiz_id: str, session_id: str, student_id: str,
                           answer_id: Optional[str], answer_text: Optional[str],
                           is_correct: Optional[bool]) -> dict:
        row = (self._client.table('quiz_responses')
               .insert({
                   'quiz_id': quiz_id, 'session_id': session_id,
                   'student_id': student_id, 'answer_id': answer_id,
                   'answer_text': answer_text, 'is_correct': is_correct,
               })
               .execute())
        return row.data[0]

    def get_quiz_responses(self, quiz_id: str) -> list:
        res = (self._client.table('quiz_responses').select('*')
               .eq('quiz_id', quiz_id)
               .order('created_at', desc=True).execute())
        return res.data or []

    def list_quizzes(self, session_id: str) -> list:
        res = (self._client.table('quizzes').select('*')
               .eq('session_id', session_id)
               .order('created_at', desc=True).execute())
        return res.data or []

    # ── Reports ───────────────────────────────────────────────────────────────
    def save_session_report(self, session_id: str, report_data: dict) -> dict:
        row = (self._client.table('session_reports')
               .insert({'session_id': session_id, 'report_data': report_data})
               .execute())
        return row.data[0]

    def get_latest_session_report(self, session_id: str) -> Optional[dict]:
        res = (self._client.table('session_reports').select('*')
               .eq('session_id', session_id)
               .order('created_at', desc=True).limit(1).execute())
        return res.data[0] if res.data else None
