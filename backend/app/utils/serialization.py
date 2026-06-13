"""asyncpg Record → JSON-safe dict conversion, shared by all routers."""
import json
from uuid import UUID


def serialize_value(v):
    """Convert a single DB value to a JSON-safe type (UUID/datetime/list).

    JSONB columns arrive as raw JSON strings (no asyncpg codec registered);
    decode them so API clients receive objects, not strings.
    """
    if isinstance(v, UUID):
        return str(v)
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if isinstance(v, list):
        return [serialize_value(x) for x in v]
    if isinstance(v, str) and v[:1] in ("{", "["):
        try:
            return json.loads(v)
        except (ValueError, TypeError):
            return v
    return v


def row_to_dict(row) -> dict:
    """Convert an asyncpg Record into a JSON-safe dict."""
    return {k: serialize_value(v) for k, v in dict(row).items()}
