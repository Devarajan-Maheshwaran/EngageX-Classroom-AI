import asyncio
import os
import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import sessions, signals, aggregation, quiz, report, demo
from socket_manager import sio
from services.polling_service import polling_loop
from middleware.rate_limiter import RateLimitMiddleware

load_dotenv()

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    if o.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(polling_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


fastapi_app = FastAPI(
    title='EngageX API',
    description='Agentic AI backend for real-time classroom engagement',
    version='2.0.0',
    lifespan=lifespan,
)

fastapi_app.add_middleware(RateLimitMiddleware)
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

fastapi_app.include_router(sessions.router,    prefix='/api/sessions',   tags=['Sessions'])
fastapi_app.include_router(signals.router,     prefix='/api/signals',    tags=['Signals'])
fastapi_app.include_router(aggregation.router, prefix='/api/aggregate',  tags=['Aggregation'])
fastapi_app.include_router(quiz.router,        prefix='/api/quiz',       tags=['Quiz'])
fastapi_app.include_router(report.router,      prefix='/api/report',     tags=['Report'])
fastapi_app.include_router(demo.router,        prefix='/api/demo',       tags=['Demo'])


@fastapi_app.get('/health', tags=['Health'])
async def health():
    return {'status': 'ok', 'version': '2.0.0'}


app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app,
    socketio_path='/socket.io',
)
