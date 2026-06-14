"""Global exception handlers — all errors return standard JSON error structure."""
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def _err(code: str, message: str, detail: dict | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "detail": detail or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    }


def register_error_handlers(app: FastAPI) -> None:

    @app.exception_handler(HTTPException)
    async def _(request: Request, exc: Exception) -> JSONResponse:
        del request  # required by FastAPI handler protocol
        http_exc = exc if isinstance(exc, HTTPException) else HTTPException(500)
        body = (
            http_exc.detail
            if isinstance(http_exc.detail, dict) and "error" in http_exc.detail
            else _err("HTTP_ERROR", str(http_exc.detail))
        )
        return JSONResponse(status_code=http_exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def _(request: Request, exc: Exception) -> JSONResponse:  # noqa: F811
        del request
        raw_errors = exc.errors() if isinstance(exc, RequestValidationError) else []
        # Pydantic v2 puts exception objects (e.g. ValueError) in ctx — not JSON-serializable
        safe_errors = []
        for e in raw_errors:
            safe_e = {k: v for k, v in e.items() if k != "url"}  # strip Pydantic docs URL
            if "ctx" in safe_e and isinstance(safe_e["ctx"], dict):
                safe_e["ctx"] = {
                    k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
                    for k, v in safe_e["ctx"].items()
                }
            safe_errors.append(safe_e)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_err("INVALID_REQUEST_BODY", "Request validation failed", {"errors": safe_errors}),
        )

    @app.exception_handler(Exception)
    async def _(request: Request, exc: Exception) -> JSONResponse:  # noqa: F811
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        del exc
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_err("INTERNAL_ERROR", "An unexpected error occurred"),
        )
