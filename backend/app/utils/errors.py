"""Standard error envelope helpers — single source of truth for the error format."""
from datetime import datetime, timezone

from fastapi import HTTPException


def error_dict(code: str, message: str, detail: dict | None = None) -> dict:
    """Build the platform-standard error body: {"error": {code, message, detail, timestamp}}."""
    return {
        "error": {
            "code": code,
            "message": message,
            "detail": detail or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    }


def http_error(
    status_code: int,
    code: str,
    message: str,
    detail: dict | None = None,
    headers: dict[str, str] | None = None,
) -> HTTPException:
    """Build (not raise) an HTTPException carrying the standard error body."""
    return HTTPException(
        status_code=status_code,
        detail=error_dict(code, message, detail),
        headers=headers,
    )
