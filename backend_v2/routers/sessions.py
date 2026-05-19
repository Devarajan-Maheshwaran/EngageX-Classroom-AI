"""
routers/sessions.py — Phase 3
Session lifecycle REST endpoints.

Routes (all prefixed /api/sessions by main.py):
    POST /create      → create session, return join_code
    POST /join        → student joins, return student_id + session details
    GET  /:id/state   → full session snapshot (teacher use)
    POST /:id/start   → set status = active
    POST /:id/end     → set status = ended (triggers Report Crew in Phase 14)
"""

import logging
from fastapi import APIRouter, HTTPException, status
from services.supabase_service import SupabaseService
from models.session import (
    CreateSessionRequest,
    JoinSessionRequest,
    SessionResponse,
    JoinSessionResponse,
)

router = APIRouter()
logger = logging.getLogger("engagex.sessions")
_svc   = SupabaseService()


# ───────────────────────────────────────────────────────────────
@router.post("/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(body: CreateSessionRequest):
    """
    Create a new session.
    Returns session details including the 6-char join_code.
    """
    try:
        session = _svc.create_session(
            title=body.title,
            teacher_id=body.teacher_id,
        )
        logger.info(f"Session created: {session['id']} code={session['join_code']}")
        return session
    except Exception as e:
        logger.error(f"create_session error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session")


# ───────────────────────────────────────────────────────────────
@router.post("/join", response_model=JoinSessionResponse, status_code=status.HTTP_200_OK)
def join_session(body: JoinSessionRequest):
    """
    Student joins a session by join_code + name.
    - Validates session exists and is not ended.
    - Creates (or reconnects) session_student row.
    - Returns student_id for use in Socket.IO and signal payloads.
    """
    # Lookup session
    session = _svc.get_session_by_join_code(body.join_code)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Session with code '{body.join_code}' not found.",
        )
    if session["status"] == "ended":
        raise HTTPException(
            status_code=410,
            detail="This session has already ended.",
        )

    # Add / reconnect student
    try:
        student = _svc.add_session_student(
            session_id=session["id"],
            student_name=body.student_name.strip(),
        )
    except Exception as e:
        logger.error(f"add_session_student error: {e}")
        raise HTTPException(status_code=500, detail="Failed to join session")

    logger.info(
        f"Student joined: {body.student_name} → session={session['id']} "
        f"student_id={student['id']} reconnect={student.get('_reconnected', False)}"
    )

    return JoinSessionResponse(
        session_id=session["id"],
        student_id=student["id"],
        student_name=body.student_name.strip(),
        join_code=session["join_code"],
        title=session["title"],
        reconnected=student.get("_reconnected", False),
    )


# ───────────────────────────────────────────────────────────────
@router.get("/{session_id}/state")
def get_session_state(session_id: str):
    """
    Full snapshot: session metadata + list of active students.
    Used by teacher dashboard on load and reconnect.
    """
    state = _svc.get_session_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


# ───────────────────────────────────────────────────────────────
@router.post("/{session_id}/start")
def start_session(session_id: str):
    """
    Marks session as 'active'. Called when teacher clicks Start.
    Phase 10 will also kick off the CrewAI SessionFlow here.
    """
    session = _svc.get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] == "ended":
        raise HTTPException(status_code=410, detail="Session already ended")

    updated = _svc.update_session_status(session_id, "active")
    logger.info(f"Session started: {session_id}")
    return {"status": updated["status"], "started_at": updated.get("started_at")}


# ───────────────────────────────────────────────────────────────
@router.post("/{session_id}/end")
def end_session(session_id: str):
    """
    Marks session as 'ended'.
    Phase 14: This will trigger Report Crew generation.
    """
    session = _svc.get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] == "ended":
        return {"status": "ended", "message": "Already ended"}

    updated = _svc.update_session_status(session_id, "ended")
    logger.info(f"Session ended: {session_id}")

    # Phase 14 hook — Report Crew will be triggered here
    # from agents.session_flow import trigger_report_crew
    # await trigger_report_crew(session_id)

    return {"status": updated["status"], "ended_at": updated.get("ended_at")}
