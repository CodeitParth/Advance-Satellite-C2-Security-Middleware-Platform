"""Admin router — user management + live config view. Phase 2.

All endpoints require ADMIN role (RBAC table: GET /admin/* → ADMIN).
"""
import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.config import settings
from app.database import get_db
from app.middleware.auth_middleware import require_role
from app.models.operator import Role, TokenPayload
from app.services.auth_service import hash_password
from app.services.ledger_service import append as ledger_append
from app.services.signing_service import public_key_pem
from app.utils.errors import error_dict
from app.utils.logging_utils import sanitize
from app.utils.serialization import row_to_dict

router = APIRouter()
logger = logging.getLogger(__name__)

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,64}$")


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str
    full_name: str = ""

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError("username must be 3–64 chars, alphanumeric + underscore")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not (8 <= len(v) <= 256):
            raise ValueError("password must be 8–256 characters")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("operator", "approver", "admin"):
            raise ValueError("role must be operator | approver | admin")
        return v


class UpdateUserRequest(BaseModel):
    is_active: bool | None = None
    role: str | None = None
    full_name: str | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str | None) -> str | None:
        if v is not None and v not in ("operator", "approver", "admin"):
            raise ValueError("role must be operator | approver | admin")
        return v


_USER_COLUMNS = """
    id, username, role, full_name, created_at, last_login, is_active,
    (baseline_profile ? 'mean_commands_per_session') AS has_baseline
"""


@router.get("/users")
async def list_users(
    _: TokenPayload = Depends(require_role(Role.ADMIN)),
    db=Depends(get_db),
):
    rows = await db.fetch(f"SELECT {_USER_COLUMNS} FROM operators ORDER BY created_at ASC")
    return {"users": [row_to_dict(r) for r in rows]}


@router.post("/users", status_code=201)
async def create_user(
    body: CreateUserRequest,
    current: TokenPayload = Depends(require_role(Role.ADMIN)),
    db=Depends(get_db),
):
    existing = await db.fetchval("SELECT id FROM operators WHERE username = $1", body.username)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=error_dict("USERNAME_TAKEN", f"Username '{body.username}' already exists"),
        )

    row = await db.fetchrow(
        f"""
        INSERT INTO operators (username, password_hash, role, full_name)
        VALUES ($1, $2, $3, $4)
        RETURNING {_USER_COLUMNS}
        """,
        body.username, hash_password(body.password), body.role, body.full_name,
    )
    logger.info("User created — username=%s role=%s by admin=%s",
                sanitize(body.username), body.role, sanitize(current.username))

    try:
        await ledger_append(
            command_id=None,
            event_type="USER_CREATED",
            event_detail={"username": body.username, "role": body.role,
                          "created_by": current.username},
            operator_id=UUID(current.sub),
            approver_ids=[],
            db_pool=db,
        )
    except Exception as exc:
        logger.error("Ledger append failed for USER_CREATED: %s", exc)

    return row_to_dict(row)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    body: UpdateUserRequest,
    current: TokenPayload = Depends(require_role(Role.ADMIN)),
    db=Depends(get_db),
):
    target = await db.fetchrow("SELECT id, username, role, is_active FROM operators WHERE id = $1", user_id)
    if not target:
        raise HTTPException(
            status_code=404,
            detail=error_dict("USER_NOT_FOUND", "No operator with that id"),
        )

    # Admins cannot deactivate or demote themselves — prevents lockout
    if str(user_id) == str(current.sub) and (body.is_active is False or (body.role and body.role != "admin")):
        raise HTTPException(
            status_code=403,
            detail=error_dict("SELF_LOCKOUT_FORBIDDEN",
                              "Admins cannot deactivate or demote their own account"),
        )

    updates, params = [], []
    changes: dict = {}
    if body.is_active is not None:
        params.append(body.is_active); updates.append(f"is_active = ${len(params)}")
        changes["is_active"] = body.is_active
    if body.role is not None:
        params.append(body.role); updates.append(f"role = ${len(params)}")
        changes["role"] = body.role
    if body.full_name is not None:
        params.append(body.full_name); updates.append(f"full_name = ${len(params)}")
        changes["full_name"] = body.full_name
    if not updates:
        raise HTTPException(
            status_code=400,
            detail=error_dict("INVALID_REQUEST_BODY", "No fields to update"),
        )

    params.append(user_id)
    row = await db.fetchrow(
        f"UPDATE operators SET {', '.join(updates)} WHERE id = ${len(params)} RETURNING {_USER_COLUMNS}",
        *params,
    )
    logger.info("User updated — username=%s changes=%s by admin=%s",
                sanitize(target["username"]), changes, sanitize(current.username))

    try:
        await ledger_append(
            command_id=None,
            event_type="USER_UPDATED",
            event_detail={"username": target["username"], "changes": changes,
                          "updated_by": current.username},
            operator_id=UUID(current.sub),
            approver_ids=[],
            db_pool=db,
        )
    except Exception as exc:
        logger.error("Ledger append failed for USER_UPDATED: %s", exc)

    return row_to_dict(row)


@router.get("/config")
async def get_active_config(
    _: TokenPayload = Depends(require_role(Role.ADMIN)),
):
    """Live (read-only) policy values — threshold editing ships post-Phase 2."""
    return {
        "risk_thresholds": {
            "low_max": settings.risk_low_max,
            "medium_max": settings.risk_medium_max,
        },
        "approval": {
            "single_approval_tier": "MEDIUM",
            "dual_approval_tier": "HIGH",
            "timeout_minutes": 5,
        },
        "override": {
            "window_minutes": settings.override_token_expire_minutes,
        },
        "drift": {
            "min_sessions": settings.drift_min_sessions,
            "z_threshold": 2.5,
            "score_elevation": 10,
        },
        "rate_limits": {
            "login_per_minute": settings.rate_limit_login_per_minute,
            "commands_per_minute": settings.rate_limit_commands_per_minute,
        },
        "demo_mode": settings.demo_mode,
        "gemini_model": settings.gemini_model if not settings.demo_mode else None,
        "app_env": settings.app_env,
        "approval_signing": {
            "algorithm": "Ed25519",
            "public_key_pem": public_key_pem(),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
