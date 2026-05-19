import os
import socketio

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    if o.strip()
]

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=CORS_ORIGINS,
    logger=False,
    engineio_logger=False,
)
