"""Structured logging: JSON/text formatters, request-id contextvar, log sanitization."""
import json
import logging
import re
import sys
from contextvars import ContextVar
from datetime import datetime, timezone

# Set per-request by RequestContextMiddleware; "-" outside a request context.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

_CONTROL_CHARS = re.compile(r"[\r\n\x00-\x1f\x7f]")

# Extra attributes the access logger attaches — promoted into the JSON document.
_EXTRA_FIELDS = ("method", "path", "status_code", "duration_ms", "client_ip", "event")


def sanitize(value, max_len: int = 256) -> str:
    """Strip control chars/newlines from user-controlled values before logging.

    Prevents log injection (forged log lines via embedded \\n) and ANSI escapes.
    """
    return _CONTROL_CHARS.sub("?", str(value))[:max_len]


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        for key in _EXTRA_FIELDS:
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        if record.exc_info:
            entry["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        record.request_id = request_id_var.get()
        return super().format(record)


def setup_logging(level: str, fmt: str) -> None:
    """Configure the root logger once at startup. fmt is "json" or "text"."""
    root = logging.getLogger()
    root.setLevel(level.upper())
    handler = logging.StreamHandler(sys.stdout)
    if fmt == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            TextFormatter("%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s — %(message)s")
        )
    root.handlers.clear()
    root.addHandler(handler)
