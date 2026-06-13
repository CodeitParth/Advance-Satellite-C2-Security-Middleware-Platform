"""Global per-IP rate limiting — Phase 3 hardening.

Sliding-window limiter applied to every /api/v1 route:
- POST /api/v1/commands       → settings.rate_limit_commands_per_minute
- everything else under /api  → settings.rate_limit_global_per_minute
- /auth/login keeps its own stricter limiter inside the auth router
- exempt: /health, /ready, /ws, docs, and CORS preflight (OPTIONS)

Same bounded-memory eviction strategy as the login limiter.
"""
import time
from collections import defaultdict
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

_WINDOW_SECONDS = 60.0
_MAX_TRACKED_IPS = 10_000

_buckets: dict[str, defaultdict[str, list[float]]] = {
    "commands": defaultdict(list),
    "general": defaultdict(list),
}

_EXEMPT_PREFIXES = ("/health", "/ready", "/ws", "/docs", "/redoc", "/openapi.json")


def _check(bucket: str, ip: str, limit: int) -> tuple[bool, int]:
    attempts = _buckets[bucket]
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS

    if len(attempts) >= _MAX_TRACKED_IPS and ip not in attempts:
        del attempts[next(iter(attempts))]

    recent = [t for t in attempts[ip] if t > cutoff]
    attempts[ip] = recent

    if len(recent) >= limit:
        retry_after = int(_WINDOW_SECONDS - (now - min(recent))) + 1
        return True, retry_after

    attempts[ip].append(now)
    return False, 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if (
            request.method == "OPTIONS"
            or not path.startswith("/api")
            or any(path.startswith(p) for p in _EXEMPT_PREFIXES)
        ):
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"

        if request.method == "POST" and path in ("/api/v1/commands", "/api/v1/c2/forward"):
            bucket, limit = "commands", settings.rate_limit_commands_per_minute
        else:
            bucket, limit = "general", settings.rate_limit_global_per_minute

        limited, retry_after = _check(bucket, ip, limit)
        if limited:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Too many requests — retry in {retry_after}s",
                        "detail": {"limit_per_minute": limit},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )

        return await call_next(request)
