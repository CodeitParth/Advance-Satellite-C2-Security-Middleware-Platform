"""Auth router: POST /auth/login, POST /auth/refresh."""
import logging
import time
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator

from app.config import settings
from app.database import get_db
from app.middleware.auth_middleware import get_current_operator
from app.models.operator import LoginRequest, LoginResponse, OperatorOut, Role, TokenPayload
from app.services.auth_service import (
    TIMING_DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.utils.errors import error_dict
from app.utils.logging_utils import sanitize

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Rate limiter ─────────────────────────────────────────────────────────────
# Dict: ip → list of monotonic timestamps of recent attempts.
# Pruned on every check; old IPs evicted when dict exceeds _MAX_TRACKED_IPS.
_login_attempts: defaultdict[str, list[float]] = defaultdict(list)
_MAX_TRACKED_IPS = 10_000
_WINDOW_SECONDS = 60.0


def _is_rate_limited(ip: str) -> tuple[bool, int]:
    """Return (limited, retry_after_seconds).

    Evicts the oldest IP entry when the tracking dict would exceed _MAX_TRACKED_IPS
    to prevent unbounded memory growth under DDoS with millions of distinct IPs.
    """
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS

    # Evict oldest entry if at capacity
    if len(_login_attempts) >= _MAX_TRACKED_IPS and ip not in _login_attempts:
        oldest_ip = next(iter(_login_attempts))
        del _login_attempts[oldest_ip]

    recent = [t for t in _login_attempts[ip] if t > cutoff]
    _login_attempts[ip] = recent

    if len(recent) >= settings.rate_limit_login_per_minute:
        oldest_in_window = min(recent)
        retry_after = int(_WINDOW_SECONDS - (now - oldest_in_window)) + 1
        return True, retry_after

    _login_attempts[ip].append(now)
    return False, 0


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, db=Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"

    limited, retry_after = _is_rate_limited(client_ip)
    if limited:
        logger.warning(
            "Login rate limit hit — ip=%s username=%s",
            sanitize(client_ip), sanitize(body.username),
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_dict(
                "RATE_LIMIT_EXCEEDED",
                "Too many login attempts. Try again later.",
                {"retry_after_seconds": retry_after},
            ),
            headers={"Retry-After": str(retry_after)},
        )

    if settings.mfa_enabled:
        row = await db.fetchrow(
            "SELECT id, username, password_hash, role, full_name, created_at, "
            "       mfa_enabled, mfa_secret "
            "FROM operators WHERE username = $1 AND is_active = TRUE",
            body.username,
        )
    else:
        row = await db.fetchrow(
            "SELECT id, username, password_hash, role, full_name, created_at "
            "FROM operators WHERE username = $1 AND is_active = TRUE",
            body.username,
        )

    # Always run bcrypt regardless of whether the user exists — prevents timing-based
    # username enumeration (response time is indistinguishable for missing vs wrong password).
    candidate_hash = row["password_hash"] if row else TIMING_DUMMY_HASH
    password_ok = verify_password(body.password, candidate_hash)

    if not row or not password_ok:
        logger.warning(
            "Failed login — ip=%s username=%s found=%s",
            sanitize(client_ip), sanitize(body.username), row is not None,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict("INVALID_CREDENTIALS", "Invalid username or password"),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # TOTP MFA gate (Phase 2) — skipped unless MFA_ENABLED=true in settings
    if settings.mfa_enabled and row["mfa_enabled"]:
        import pyotp
        if not body.totp_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_dict("MFA_REQUIRED", "Account has MFA enabled — supply totp_code"),
            )
        if not pyotp.TOTP(row["mfa_secret"]).verify(body.totp_code.strip(), valid_window=1):
            logger.warning("MFA failure — ip=%s username=%s",
                           sanitize(client_ip), sanitize(body.username))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_dict("MFA_INVALID", "Invalid authenticator code"),
            )

    await db.execute(
        "UPDATE operators SET last_login = NOW() WHERE id = $1",
        row["id"],
    )

    # Role stored in DB as a plain string — cast explicitly to avoid passing str to Role param
    role = Role(row["role"])
    token = create_access_token(row["id"], role, row["username"])

    logger.info(
        "Successful login — ip=%s username=%s role=%s",
        sanitize(client_ip), sanitize(row["username"]), role.value,
    )

    operator = OperatorOut(
        id=row["id"],
        username=row["username"],
        role=role,
        full_name=row["full_name"],
        created_at=row["created_at"],
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",  # nosec B106
        expires_in=settings.access_token_expire_minutes * 60,
        operator=operator,
    )


@router.post("/refresh")
async def refresh(current: TokenPayload = Depends(get_current_operator)):
    token = create_access_token(
        UUID(current.sub),
        Role(current.role),
        current.username,
    )
    return {"access_token": token, "token_type": "bearer"}  # nosec B105


# ── Account security (Phase 2): password change + TOTP MFA ───────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not (8 <= len(v) <= 256):
            raise ValueError("new_password must be 8–256 characters")
        return v


class MfaCodeRequest(BaseModel):
    totp_code: str


class MfaDisableRequest(BaseModel):
    current_password: str
    totp_code: str


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT password_hash FROM operators WHERE id = $1", UUID(current.sub))
    if not row or not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict("INVALID_CREDENTIALS", "Current password is incorrect"),
        )
    await db.execute(
        "UPDATE operators SET password_hash = $1 WHERE id = $2",
        hash_password(body.new_password), UUID(current.sub),
    )
    logger.info("Password changed — username=%s", sanitize(current.username))
    return {"changed": True}


@router.post("/mfa/setup")
async def mfa_setup(
    current: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    """Generate a TOTP secret (stored, not yet enabled) + otpauth URI for the
    authenticator app. Enable with /auth/mfa/enable after scanning."""
    import pyotp
    secret = pyotp.random_base32()
    await db.execute(
        "UPDATE operators SET mfa_secret = $1, mfa_enabled = FALSE WHERE id = $2",
        secret, UUID(current.sub),
    )
    uri = pyotp.TOTP(secret).provisioning_uri(
        name=current.username, issuer_name="SCSP Ground Station")
    return {"secret": secret, "otpauth_uri": uri}


@router.post("/mfa/enable")
async def mfa_enable(
    body: MfaCodeRequest,
    current: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    import pyotp
    secret = await db.fetchval(
        "SELECT mfa_secret FROM operators WHERE id = $1", UUID(current.sub))
    if not secret:
        raise HTTPException(
            status_code=400,
            detail=error_dict("INVALID_REQUEST_BODY", "Run /auth/mfa/setup first"),
        )
    if not pyotp.TOTP(secret).verify(body.totp_code.strip(), valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict("MFA_INVALID", "Invalid authenticator code"),
        )
    await db.execute(
        "UPDATE operators SET mfa_enabled = TRUE WHERE id = $1", UUID(current.sub))
    logger.info("MFA enabled — username=%s", sanitize(current.username))
    return {"mfa_enabled": True}


@router.post("/mfa/disable")
async def mfa_disable(
    body: MfaDisableRequest,
    current: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    import pyotp
    row = await db.fetchrow(
        "SELECT password_hash, mfa_secret, mfa_enabled FROM operators WHERE id = $1",
        UUID(current.sub))
    if not row or not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict("INVALID_CREDENTIALS", "Current password is incorrect"),
        )
    if row["mfa_enabled"] and not pyotp.TOTP(row["mfa_secret"]).verify(
            body.totp_code.strip(), valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict("MFA_INVALID", "Invalid authenticator code"),
        )
    await db.execute(
        "UPDATE operators SET mfa_enabled = FALSE, mfa_secret = NULL WHERE id = $1",
        UUID(current.sub))
    logger.info("MFA disabled — username=%s", sanitize(current.username))
    return {"mfa_enabled": False}


@router.get("/mfa/status")
async def mfa_status(
    current: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    enabled = await db.fetchval(
        "SELECT mfa_enabled FROM operators WHERE id = $1", UUID(current.sub))
    return {"mfa_enabled": bool(enabled)}
