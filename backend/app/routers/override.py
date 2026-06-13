"""Override router: POST /override/activate, GET /override/status."""
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator

from app.middleware.auth_middleware import get_current_operator, require_role
from app.models.operator import Role, TokenPayload
from app.services.override_service import activate_override, get_override_status
from app.utils.errors import http_error

router = APIRouter()


class OverrideActivateRequest(BaseModel):
    justification: str

    @field_validator("justification")
    @classmethod
    def _validate(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("justification must be at least 20 characters")
        if len(v) > 500:
            raise ValueError("justification must be at most 500 characters")
        return v


@router.post("/activate")
async def activate(
    body: OverrideActivateRequest,
    # Both APPROVER and ADMIN may activate (spec §6.9 + security RBAC table)
    current: TokenPayload = Depends(require_role(Role.APPROVER, Role.ADMIN)),
) -> dict:
    try:
        return await activate_override(UUID(current.sub), body.justification)
    except ValueError as exc:
        code = str(exc)
        if code == "JUSTIFICATION_TOO_SHORT":
            raise http_error(400, "JUSTIFICATION_TOO_SHORT",
                             "Justification must be at least 20 characters")
        if code == "OVERRIDE_ALREADY_ACTIVE":
            raise http_error(409, "OVERRIDE_ALREADY_ACTIVE",
                             "An emergency override is already active")
        raise


@router.get("/status")
async def status(
    _: TokenPayload = Depends(get_current_operator),
) -> dict:
    return get_override_status()
