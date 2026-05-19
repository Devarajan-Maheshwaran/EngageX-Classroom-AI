"""
supabase_service.py — Phase 10 (updated)

Adds:
  get_active_sessions()  — used by polling loop
  get_recent_signals()   — used by aggregator
  save_alert()           — used by aggregator for actionable alerts
  get_session_state()    — used by aggregation router
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

    # ── Sessions ───────────────────────────────────────────────────────────────

    def create_session(self, teacher_id: str, title: str, code: str) -> dict:
        row = (
            self._client.table('sessions')
            .insert({'teacher_id': teacher_id, 'title': title, 'code': code, 'status': 'active'})
            .execute()
        )
        return row.data[0]

    def get_session_by_code(self, code: str) -> Optional[dict]:
        res = (
            self._client.table('sessions')
            .select('*')
            .eq('code', code)
            .eq('status', 'active')
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def get_session_state(self, session_id: str) -> Optional[dict]:
        """Returns session row including nested students list from session_students."""
        res = (
            self._client.table('sessions')
            .select('*, session_students(id, name)')
            .eq('id', session_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        session = res.data[0]
        session['students'] = [
            {'id': s['id'], 'name': s.get('name', '')}
            for s in session.get('session_students', [])
        ]
        return session

    def get_active_sessions(self) -> list:
        """Returns all active sessions with their connected students."""
        res = (
            self._client.table('sessions')
            .select('id, session_students(id, name)')
            .eq('status', 'active')
            .execute()
        )
        sessions = []
        for row in (res.data or []):
            sessions.append({
                'id':       row['id'],
                'students': [
                    {'id': s['id'], 'name': s.get('name', '')}
                    for s in row.get('session_students', [])
                ],
            })
        return sessions

    def join_session(self, session_id: str, student_name: str) -> dict:
        res = (
            self._client.table('session_students')
            .insert({'session_id': session_id, 'name': student_name})
            .execute()
        )
        return res.data[0]

    # ── Signals ───────────────────────────────────────────────────────────────

    def save_signal(
        self,
        session_id:       str,
        student_id:       str,
        signal_type:      str,
        signal_data:      dict,
        engagement_score: Optional[float] = None,
    ) -> dict:
        row = (
            self._client.table('student_signals')
            .insert({
                'session_id':       session_id,
                'student_id':       student_id,
                'signal_type':      signal_type,
                'signal_data':      signal_data,
                'engagement_score': engagement_score,
            })
            .execute()
        )
        return row.data[0]

    def get_recent_signals(self, session_id: str, student_id: str, limit: int = 10) -> list:
        res = (
            self._client.table('student_signals')
            .select('*')
            .eq('session_id', session_id)
            .eq('student_id', student_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    # ── Alerts ───────────────────────────────────────────────────────────────

    def save_alert(
        self,
        session_id:   str,
        student_id:   str,
        alert_type:   str,
        message:      str,
        fused_score:  float,
    ) -> dict:
        row = (
            self._client.table('engagement_alerts')
            .insert({
                'session_id':  session_id,
                'student_id':  student_id,
                'alert_type':  alert_type,
                'message':     message,
                'fused_score': fused_score,
            })
            .execute()
        )
        return row.data[0]

    def get_alerts(self, session_id: str, limit: int = 50) -> list:
        res = (
            self._client.table('engagement_alerts')
            .select('*')
            .eq('session_id', session_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
