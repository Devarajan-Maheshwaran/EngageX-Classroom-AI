"""
socket_manager.py — Phase 10 (updated)

Socket.IO server with rooms for teachers and students.

Room naming convention:
  teacher:<session_id>  — teacher receives alerts + engagement_update
  student:<session_id>  — student receives quiz/poll events (Phase 11)

Events emitted by server:
  engagement_update  → teacher room, every 15s from polling loop
  alert              → teacher room, when alert_level != 'none'
  quiz_push          → student room (Phase 11)

Events received from client:
  join_session       → put client in correct room
  leave_session      → remove from room
"""

import logging
import socketio

logger = logging.getLogger('engagex.socket')

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid, environ):
    logger.debug(f'[Socket] connect sid={sid}')


@sio.event
async def disconnect(sid):
    logger.debug(f'[Socket] disconnect sid={sid}')


@sio.on('join_session')
async def join_session(sid, data):
    """
    data = { session_id: str, role: 'teacher' | 'student', student_id?: str }
    """
    session_id = data.get('session_id', '')
    role       = data.get('role', 'student')
    student_id = data.get('student_id', '')

    if not session_id:
        return {'error': 'session_id required'}

    if role == 'teacher':
        room = f'teacher:{session_id}'
        await sio.enter_room(sid, room)
        logger.info(f'[Socket] teacher joined room={room}')
        return {'status': 'joined', 'room': room}

    else:  # student
        room = f'student:{session_id}'
        await sio.enter_room(sid, room)
        await sio.enter_room(sid, f'student:{session_id}:{student_id}')
        logger.info(f'[Socket] student={student_id[:8]} joined room={room}')
        return {'status': 'joined', 'room': room}


@sio.on('leave_session')
async def leave_session(sid, data):
    session_id = data.get('session_id', '')
    role       = data.get('role', 'student')
    student_id = data.get('student_id', '')

    if role == 'teacher':
        await sio.leave_room(sid, f'teacher:{session_id}')
    else:
        await sio.leave_room(sid, f'student:{session_id}')
        if student_id:
            await sio.leave_room(sid, f'student:{session_id}:{student_id}')

    return {'status': 'left'}


@sio.on('ping_teacher')
async def ping_teacher(sid, data):
    """Teacher can manually request a fresh engagement snapshot."""
    session_id = data.get('session_id', '')
    await sio.emit('pong_teacher', {'session_id': session_id}, to=sid)
