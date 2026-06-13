"""C2 integration proxy — REST adapter for external ground-station software.

SCSP deploys as a transparent security layer between an existing C2 system
(OpenC3 COSMOS or any other) and the satellite uplink: the C2 posts the raw
CCSDS packet hex here, the full SCSP pipeline runs (parse → replay/sequence/
drift checks → AI scoring → tiered authorization), and approved commands are
forwarded verbatim to the uplink (mock OBC). Zero changes to the C2 system or
satellite firmware. See docs/C2_INTEGRATION.md.

Auth: static API key (X-API-Key header) mapped to a dedicated service operator
account — external C2 systems don't perform interactive JWT logins. Disabled
entirely unless C2_PROXY_API_KEY is configured.
"""
import hmac
import logging
import uuid as uuid_module
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_db
from app.models.command import CommandSubmitRequest
from app.models.operator import Role, TokenPayload
from app.routers.commands import run_submit_pipeline
from app.utils.errors import error_dict
from app.utils.logging_utils import sanitize

router = APIRouter()
logger = logging.getLogger(__name__)

# Statuses where the command has been (or will immediately be) forwarded
_FORWARDED = {"AUTO_APPROVED", "DISPATCHED", "EMERGENCY_OVERRIDE"}
_PENDING = {"PENDING_SINGLE_APPROVAL", "PENDING_DUAL_APPROVAL"}


class C2ForwardRequest(BaseModel):
    packet_hex: str = Field(max_length=2048)
    # External C2 systems don't manage SCSP nonces — generated when omitted
    nonce: str | None = None
    source_system: str = Field(default="EXTERNAL_C2", max_length=64)


async def _require_api_key(
    x_api_key: str = Header(default=""),
) -> None:
    if not settings.c2_proxy_api_key:
        raise HTTPException(
            status_code=403,
            detail=error_dict("C2_PROXY_DISABLED",
                              "C2 proxy is disabled — set C2_PROXY_API_KEY to enable"),
        )
    if not hmac.compare_digest(x_api_key, settings.c2_proxy_api_key):
        raise HTTPException(
            status_code=401,
            detail=error_dict("TOKEN_INVALID", "Invalid or missing X-API-Key"),
        )


async def _service_operator(db) -> TokenPayload:
    """Resolve the dedicated C2 gateway service account into a TokenPayload."""
    row = await db.fetchrow(
        "SELECT id, username, role FROM operators WHERE username = $1 AND is_active = TRUE",
        settings.c2_service_username,
    )
    if not row:
        raise HTTPException(
            status_code=503,
            detail=error_dict(
                "C2_SERVICE_ACCOUNT_MISSING",
                f"Service account '{settings.c2_service_username}' not found — run seed_operators.py",
            ),
        )
    return TokenPayload(
        sub=str(row["id"]),
        role=Role(row["role"]),
        username=row["username"],
        exp=datetime.now(timezone.utc) + timedelta(minutes=5),
        token_type="access",
    )


@router.post("/forward")
async def forward_command(
    body: C2ForwardRequest,
    _: None = Depends(_require_api_key),
    db=Depends(get_db),
):
    """Ingest a raw CCSDS packet from an external C2 system.

    Responses:
    - disposition FORWARDED              → approved + dispatched to the uplink
    - disposition PENDING_AUTHORIZATION  → held for safety-officer approval (poll status_url)
    - disposition BLOCKED / REJECTED     → not forwarded; reason included
    Parse failures and replays surface as standard 400/409 SCSP errors.
    """
    operator = await _service_operator(db)
    nonce = body.nonce or str(uuid_module.uuid4())

    result = await run_submit_pipeline(
        CommandSubmitRequest(packet_hex=body.packet_hex, nonce=nonce),
        operator,
        db,
    )

    if result.status in _FORWARDED:
        disposition = "FORWARDED"
    elif result.status in _PENDING:
        disposition = "PENDING_AUTHORIZATION"
    else:
        disposition = result.status

    logger.info(
        "C2 proxy — source=%s command=%s score=%d disposition=%s",
        sanitize(body.source_system), result.command_id, result.risk_score, disposition,
    )

    return {
        "disposition": disposition,
        "command_id": result.command_id,
        "status": result.status,
        "risk_score": result.risk_score,
        "risk_tier": result.risk_tier,
        "justification": result.justification,
        "nonce": nonce,
        "source_system": body.source_system,
        "status_url": f"/api/v1/c2/command/{result.command_id}",
    }


@router.get("/command/{command_id}")
async def command_status(
    command_id: UUID,
    _: None = Depends(_require_api_key),
    db=Depends(get_db),
):
    """Poll endpoint for the external C2: has the held command been authorized?"""
    row = await db.fetchrow(
        "SELECT id, command_type, status, risk_score, risk_tier, submitted_at, dispatched_at "
        "FROM commands WHERE id = $1",
        command_id,
    )
    if not row:
        raise HTTPException(
            status_code=404,
            detail=error_dict("COMMAND_NOT_FOUND", "Unknown command_id"),
        )
    status_value = row["status"]
    return {
        "command_id": str(row["id"]),
        "command_type": row["command_type"],
        "status": status_value,
        "disposition": (
            "FORWARDED" if status_value in _FORWARDED or row["dispatched_at"]
            else "PENDING_AUTHORIZATION" if status_value in _PENDING
            else status_value
        ),
        "risk_score": row["risk_score"],
        "risk_tier": row["risk_tier"],
        "submitted_at": row["submitted_at"].isoformat(),
        "dispatched_at": row["dispatched_at"].isoformat() if row["dispatched_at"] else None,
    }
