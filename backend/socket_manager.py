import os
import socketio

CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
if CORS_ORIGINS != '*':
    CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS.split(',') if o.strip()]

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=CORS_ORIGINS,
    logger=False,
    engineio_logger=False,
)
