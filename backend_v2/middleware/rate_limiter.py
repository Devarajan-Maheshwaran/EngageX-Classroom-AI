"""
middleware/rate_limiter.py — Phase 15

Simple in-process sliding-window rate limiter per (student_id, endpoint).
Falls back to a no-op if Redis/Upstash is not configured.

Limits:
  /api/signals/*  → max 30 requests / 60s per student
  /api/quiz/*     → max 10 requests / 60s per student
  default         → max 60 requests / 60s per IP
"""

import os
import time
import logging
from collections import defaultdict, deque
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger('engagex.ratelimit')

# Try Upstash Redis (optional)
try:
    from upstash_redis import Redis as UpstashRedis
    _upstash = UpstashRedis(
        url=os.getenv('UPSTASH_REDIS_REST_URL', ''),
        token=os.getenv('UPSTASH_REDIS_REST_TOKEN', ''),
    ) if os.getenv('UPSTASH_REDIS_REST_URL') else None
except ImportError:
    _upstash = None
    logger.info('upstash_redis not installed — using in-process rate limiter')

# In-process fallback: { key -> deque of timestamps }
_windows: dict = defaultdict(deque)

_LIMITS = [
    ('/api/signals', 30, 60),
    ('/api/quiz',    10, 60),
]
_DEFAULT_LIMIT = (60, 60)


def _get_limit(path: str) -> tuple[int, int]:
    for prefix, limit, window in _LIMITS:
        if path.startswith(prefix):
            return limit, window
    return _DEFAULT_LIMIT


def _student_id_from_request(request: Request) -> str:
    """Best-effort: read student_id from query param or JSON body cache header."""
    sid = request.query_params.get('student_id')
    if not sid:
        sid = request.headers.get('X-Student-Id')
    return sid or request.client.host


def _check_in_process(key: str, limit: int, window: int) -> bool:
    """Returns True if request is allowed."""
    now = time.monotonic()
    dq  = _windows[key]
    while dq and now - dq[0] > window:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True


def _check_upstash(key: str, limit: int, window: int) -> bool:
    try:
        pipe = _upstash.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        results = pipe.execute()
        count = results[0]
        return count <= limit
    except Exception as e:
        logger.warning(f'Upstash rate limit check failed: {e} — allowing')
        return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path  = request.url.path
        # Skip health + static
        if path in ('/health', '/docs', '/openapi.json', '/redoc'):
            return await call_next(request)

        key_id = _student_id_from_request(request)
        limit, window = _get_limit(path)
        key    = f'rl:{path.split("/")[2] if path.count("/") >= 2 else "root"}:{key_id}'

        allowed = (
            _check_upstash(key, limit, window)
            if _upstash else
            _check_in_process(key, limit, window)
        )
        if not allowed:
            raise HTTPException(status_code=429, detail='Rate limit exceeded. Please slow down.')

        return await call_next(request)
