"""RequestContextMiddleware — injects a per-request correlation ID and enforces body size."""
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings
from app.utils.logging_utils import request_id_var

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH"})


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Correlation ID — client may supply X-Request-ID, otherwise generate one.
        req_id = request.headers.get("X-Request-ID") or secrets.token_hex(8)
        token = request_id_var.set(req_id)

        # 2. Body-size guard for mutation requests (prevents multi-GB payload attacks).
        if request.method in _WRITE_METHODS:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > settings.max_request_body_bytes:
                request_id_var.reset(token)
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "REQUEST_TOO_LARGE",
                            "message": f"Request body exceeds {settings.max_request_body_bytes} bytes",
                            "detail": {},
                            "timestamp": __import__("datetime").datetime.now(
                                __import__("datetime").timezone.utc
                            ).isoformat(),
                        }
                    },
                    headers={"X-Request-ID": req_id},
                )

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_var.reset(token)
