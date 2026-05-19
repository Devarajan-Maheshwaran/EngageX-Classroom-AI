"""
socket_manager.py — Phase 3
Central Socket.IO server instance + all room event handlers.

All session rooms follow the naming convention:  session:<session_id>
All teachers join an additional room:            teacher:<session_id>

Event contract (matches SRS):

  Client → Server:
    session:join          { session_id, student_id, role: 'teacher'|'student', name }
    session:leave         { session_id, student_id }
    session:ping          { session_id }  → returns session:pong

  Server → Teacher room:
    session:student_joined  { student_id, student_name, joined_at }
    session:student_left    { student_id, student_name }
    session:participant_list { students: [...] }
    session:pong            { timestamp }

  Server → Student (individual sid):
    session:joined          { session_id, student_id, student_name, title }
    session:error           { message }
"""

import os
import logging
from datetime import datetime, timezone

import socketio
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("engagex.socket")

# ── Socket.IO server instance ───────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.vercel.app",
    ],
    logger=False,
    engineio_logger=False,
)

# ── In-memory socket → identity map ─────────────────────────────────────────
# Maps socket_id → { session_id, student_id, student_name, role }
_socket_identity: dict[str, dict] = {}


def _room(session_id: str) -> str:
    return f"session:{session_id}"


def _teacher_room(session_id: str) -> str:
    return f"teacher:{session_id}"


# ── Helpers ─────────────────────────────────────────────────────────────
async def emit_to_teacher(session_id: str, event: str, data: dict):
    """Emit an event to the teacher room for a session."""
    await sio.emit(event, data, room=_teacher_room(session_id))


async def emit_to_session(session_id: str, event: str, data: dict):
    """Broadcast an event to ALL participants in a session."""
    await sio.emit(event, data, room=_room(session_id))


async def emit_to_student(sid: str, event: str, data: dict):
    """Emit directly to one student socket."""
    await sio.emit(event, data, to=sid)


# ── Event handlers ──────────────────────────────────────────────────────────
@sio.event
async def connect(sid, environ, auth):
    logger.info(f"[Socket] connect  sid={sid}")


@sio.event
async def disconnect(sid):
    identity = _socket_identity.pop(sid, None)
    if not identity:
        return

    session_id  = identity["session_id"]
    student_id  = identity["student_id"]
    student_name = identity["student_name"]
    role        = identity["role"]

    logger.info(f"[Socket] disconnect sid={sid} name={student_name} role={role}")

    if role == "student":
        # Mark left in DB (imported lazily to avoid circular imports)
        try:
            from services.supabase_service import SupabaseService
            SupabaseService().mark_student_left(student_id)
        except Exception as e:
            logger.warning(f"[Socket] DB mark_student_left failed: {e}")

        # Notify teacher
        await emit_to_teacher(
            session_id,
            "session:student_left",
            {"student_id": student_id, "student_name": student_name},
        )


@sio.on("session:join")
async def on_session_join(sid, data: dict):
    """
    Payload: { session_id, student_id, role, name }
    - student joins session room + teacher is notified
    - teacher joins session room + teacher room
    """
    session_id   = data.get("session_id")
    student_id   = data.get("student_id")
    role         = data.get("role", "student")
    name         = data.get("name", "Anonymous")

    if not session_id:
        await emit_to_student(sid, "session:error", {"message": "session_id required"})
        return

    # Update socket_id in DB for students
    if role == "student" and student_id:
        try:
            from services.supabase_service import SupabaseService
            svc = SupabaseService()
            svc.client.table("session_students").update(
                {"socket_id": sid}
            ).eq("id", student_id).execute()
        except Exception as e:
            logger.warning(f"[Socket] Could not update socket_id: {e}")

    # Join rooms
    await sio.enter_room(sid, _room(session_id))
    if role == "teacher":
        await sio.enter_room(sid, _teacher_room(session_id))

    # Store identity for disconnect handler
    _socket_identity[sid] = {
        "session_id":   session_id,
        "student_id":   student_id or sid,
        "student_name": name,
        "role":         role,
    }

    if role == "student":
        # Confirm join to student
        await emit_to_student(sid, "session:joined", {
            "session_id":  session_id,
            "student_id":  student_id,
            "student_name": name,
        })
        # Notify teacher
        await emit_to_teacher(session_id, "session:student_joined", {
            "student_id":   student_id,
            "student_name": name,
            "joined_at":    datetime.now(timezone.utc).isoformat(),
        })

    logger.info(f"[Socket] {role} joined session={session_id} name={name}")


@sio.on("session:leave")
async def on_session_leave(sid, data: dict):
    session_id = data.get("session_id")
    if session_id:
        await sio.leave_room(sid, _room(session_id))
        await sio.leave_room(sid, _teacher_room(session_id))
    identity = _socket_identity.pop(sid, None)
    if identity and identity["role"] == "student":
        await emit_to_teacher(session_id, "session:student_left", {
            "student_id":   identity["student_id"],
            "student_name": identity["student_name"],
        })


@sio.on("session:ping")
async def on_ping(sid, data: dict):
    await emit_to_student(sid, "session:pong", {
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
