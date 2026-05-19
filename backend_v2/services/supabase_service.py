"""
supabase_service.py — Phase 2
All direct Supabase DB interactions for EngageX v2.

Usage:
    from services.supabase_service import SupabaseService
    svc = SupabaseService()
    session = await svc.create_session("Python 101", teacher_id=None)
"""

import os
import random
import string
from datetime import datetime, timezone
from typing import Optional

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


def _get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
        )
    return create_client(url, key)


def _generate_join_code(length: int = 6) -> str:
    """Generate a random alphanumeric join code like AB12CD."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


class SupabaseService:
    """
    Thin async-friendly wrapper around supabase-py.
    All methods return plain dicts (already deserialized from JSON).
    """

    def __init__(self):
        self.client: Client = _get_client()

    # ─────────────────────────────────────────────────────────────
    # SESSIONS
    # ─────────────────────────────────────────────────────────────

    def create_session(
        self,
        title: str,
        teacher_id: Optional[str] = None,
    ) -> dict:
        """
        Create a new session row.
        Returns the created session dict (id, join_code, title, status, ...).
        Retries on join_code collision (astronomically rare but handled).
        """
        for attempt in range(5):
            join_code = _generate_join_code()
            try:
                result = (
                    self.client.table("sessions")
                    .insert(
                        {
                            "title": title,
                            "teacher_id": teacher_id,
                            "join_code": join_code,
                            "status": "waiting",
                        }
                    )
                    .execute()
                )
                return result.data[0]
            except Exception as e:
                if "unique" in str(e).lower() and attempt < 4:
                    continue  # collision — retry with new code
                raise
        raise RuntimeError("Failed to generate unique join_code after 5 attempts")

    def get_session_by_join_code(self, join_code: str) -> Optional[dict]:
        """
        Look up a session by its join code.
        Returns None if not found.
        """
        result = (
            self.client.table("sessions")
            .select("*")
            .eq("join_code", join_code.upper().strip())
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def get_session_by_id(self, session_id: str) -> Optional[dict]:
        """Fetch a session by UUID."""
        result = (
            self.client.table("sessions")
            .select("*")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def update_session_status(self, session_id: str, status: str) -> dict:
        """
        Update session status.
        status must be one of: 'waiting' | 'active' | 'ended'
        """
        data = {"status": status}
        if status == "active":
            data["started_at"] = datetime.now(timezone.utc).isoformat()
        elif status == "ended":
            data["ended_at"] = datetime.now(timezone.utc).isoformat()

        result = (
            self.client.table("sessions")
            .update(data)
            .eq("id", session_id)
            .execute()
        )
        return result.data[0]

    def get_session_state(self, session_id: str) -> dict:
        """
        Full snapshot: session row + list of active students.
        Used by GET /api/sessions/:id/state.
        """
        session = self.get_session_by_id(session_id)
        if not session:
            return {}
        students = self.get_active_students(session_id)
        return {**session, "students": students}

    # ─────────────────────────────────────────────────────────────
    # SESSION STUDENTS
    # ─────────────────────────────────────────────────────────────

    def add_session_student(
        self,
        session_id: str,
        student_name: str,
        socket_id: Optional[str] = None,
    ) -> dict:
        """
        Add a new student to a session.
        Returns the created session_student row (has its own UUID = student_id).
        Phase 4B reconnect: if same name in same session already exists and
        is_active=True, update socket_id instead of creating duplicate.
        """
        # Check for existing record with same name in same session
        existing = (
            self.client.table("session_students")
            .select("*")
            .eq("session_id", session_id)
            .eq("student_name", student_name)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if existing.data:
            # Reconnect scenario: update socket_id
            row = existing.data[0]
            updated = (
                self.client.table("session_students")
                .update({"socket_id": socket_id})
                .eq("id", row["id"])
                .execute()
            )
            return {**updated.data[0], "_reconnected": True}

        result = (
            self.client.table("session_students")
            .insert(
                {
                    "session_id": session_id,
                    "student_name": student_name,
                    "socket_id": socket_id,
                    "is_active": True,
                }
            )
            .execute()
        )
        return result.data[0]

    def mark_student_left(self, student_id: str) -> None:
        """Called on socket disconnect."""
        self.client.table("session_students").update(
            {
                "is_active": False,
                "left_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", student_id).execute()

    def get_active_students(self, session_id: str) -> list[dict]:
        """All is_active=True students in a session."""
        result = (
            self.client.table("session_students")
            .select("id, student_name, socket_id, joined_at")
            .eq("session_id", session_id)
            .eq("is_active", True)
            .order("joined_at", desc=False)
            .execute()
        )
        return result.data

    def get_student_by_socket(self, socket_id: str) -> Optional[dict]:
        """Used on disconnect to identify which student left."""
        result = (
            self.client.table("session_students")
            .select("*")
            .eq("socket_id", socket_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    # ─────────────────────────────────────────────────────────────
    # STUDENT SIGNALS
    # ─────────────────────────────────────────────────────────────

    def save_signal(
        self,
        session_id: str,
        student_id: str,
        signal_type: str,
        signal_data: dict,
        engagement_score: Optional[float] = None,
    ) -> dict:
        """Insert one signal row."""
        result = (
            self.client.table("student_signals")
            .insert(
                {
                    "session_id": session_id,
                    "student_id": student_id,
                    "signal_type": signal_type,
                    "signal_data": signal_data,
                    "engagement_score": engagement_score,
                }
            )
            .execute()
        )
        return result.data[0]

    def get_recent_signals(
        self,
        student_id: str,
        limit: int = 20,
        signal_type: Optional[str] = None,
    ) -> list[dict]:
        """Latest N signals for a student, optionally filtered by type."""
        q = (
            self.client.table("student_signals")
            .select("*")
            .eq("student_id", student_id)
            .order("recorded_at", desc=True)
            .limit(limit)
        )
        if signal_type:
            q = q.eq("signal_type", signal_type)
        return q.execute().data

    def get_session_signals(
        self,
        session_id: str,
        minutes: int = 10,
    ) -> list[dict]:
        """
        All signals for all students in a session within the last `minutes` minutes.
        Used by Monitor Crew Signal Aggregator.
        """
        from datetime import timedelta
        since = (
            datetime.now(timezone.utc) - timedelta(minutes=minutes)
        ).isoformat()
        result = (
            self.client.table("student_signals")
            .select("*")
            .eq("session_id", session_id)
            .gte("recorded_at", since)
            .order("recorded_at", desc=False)
            .execute()
        )
        return result.data

    # ─────────────────────────────────────────────────────────────
    # ENGAGEMENT ALERTS
    # ─────────────────────────────────────────────────────────────

    def save_alert(
        self,
        session_id: str,
        alert_type: str,
        severity: str,
        agent_reasoning: str,
        suggestion: str,
        student_id: Optional[str] = None,
    ) -> dict:
        result = (
            self.client.table("engagement_alerts")
            .insert(
                {
                    "session_id": session_id,
                    "student_id": student_id,
                    "alert_type": alert_type,
                    "severity": severity,
                    "agent_reasoning": agent_reasoning,
                    "suggestion": suggestion,
                }
            )
            .execute()
        )
        return result.data[0]

    def get_active_alerts(self, session_id: str) -> list[dict]:
        result = (
            self.client.table("engagement_alerts")
            .select("*")
            .eq("session_id", session_id)
            .eq("resolved", False)
            .order("raised_at", desc=True)
            .execute()
        )
        return result.data

    def resolve_alert(self, alert_id: str, teacher_action: str = "") -> None:
        self.client.table("engagement_alerts").update(
            {"resolved": True, "teacher_action": teacher_action}
        ).eq("id", alert_id).execute()
