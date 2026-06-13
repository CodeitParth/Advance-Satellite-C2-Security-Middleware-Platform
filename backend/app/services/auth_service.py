"""JWT creation/validation, bcrypt password hashing."""
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from fastapi import HTTPException, status
from jose import ExpiredSignatureError, JWTError, jwt

from app.config import settings
from app.models.operator import Role, TokenPayload

# Pre-computed bcrypt hash to ensure constant-time comparison when a username
# does not exist — prevents timing-based username enumeration on /auth/login.
TIMING_DUMMY_HASH: str = bcrypt.hashpw(
    b"scsp-timing-guard-do-not-use", bcrypt.gensalt(rounds=settings.bcrypt_rounds)
).decode("utf-8")


# ── Password helpers ─────────────────────────────────────────────────────────
# Direct bcrypt (passlib is unmaintained and probes a module attribute removed
# in bcrypt 4.1+). Hashes are standard $2b$ — fully compatible both ways.

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(
        plain.encode("utf-8"), bcrypt.gensalt(rounds=settings.bcrypt_rounds)
    ).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # malformed stored hash — treat as non-match, never raise to the route
        return False


# ── JWT helpers ──────────────────────────────────────────────────────────────

def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(operator_id: UUID, role: Role, username: str) -> str:
    now = datetime.now(timezone.utc)
    return _encode({
        "sub": str(operator_id),
        "role": role.value,
        "username": username,
        "token_type": "access",  # nosec B105 B106
        "iat": now.timestamp(),
        "exp": (now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp(),
    })


def create_approval_token(operator_id: UUID, command_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    return _encode({
        "sub": str(operator_id),
        "token_type": "approval",  # nosec B105 B106
        "command_id": str(command_id),
        "iat": now.timestamp(),
        "exp": (now + timedelta(minutes=settings.approval_token_expire_minutes)).timestamp(),
    })


def create_override_token(operator_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    return _encode({
        "sub": str(operator_id),
        "token_type": "override",  # nosec B105 B106
        "iat": now.timestamp(),
        "exp": (now + timedelta(minutes=settings.override_token_expire_minutes)).timestamp(),
    })


def decode_token(token: str, *, require_type: str = "access") -> TokenPayload:
    """Decode and validate a JWT.

    require_type enforces that approval tokens cannot be used as access tokens
    and vice versa (prevents token-type confusion attacks).
    """
    from app.utils.errors import error_dict  # local import avoids circular deps at module level

    def _auth_error(code: str, message: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict(code, message),
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        raw = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except ExpiredSignatureError:
        raise _auth_error("TOKEN_EXPIRED", "Token has expired")
    except JWTError:
        raise _auth_error("TOKEN_INVALID", "Token is invalid or malformed")

    # Token-type confusion guard
    actual_type = raw.get("token_type", "")
    if actual_type != require_type:
        raise _auth_error(
            "TOKEN_INVALID",
            f"Token type '{actual_type}' cannot be used here (expected '{require_type}')",
        )

    # Normalise exp → datetime for Pydantic; fill optional fields absent in non-access tokens
    raw["exp"] = datetime.fromtimestamp(raw["exp"], tz=timezone.utc)
    raw.setdefault("role", "operator")
    raw.setdefault("username", "")
    return TokenPayload(**raw)
