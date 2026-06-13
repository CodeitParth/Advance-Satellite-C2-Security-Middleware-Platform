"""Emergency override singleton: activate, check expiry, auto-deactivate, ledger log."""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.config import settings
from app.services.auth_service import create_override_token
from app.utils.tasks import spawn

logger = logging.getLogger(__name__)


@dataclass
class OverrideState:
    active: bool = field(default=False)
    token: str | None = field(default=None)
    activated_by: str | None = field(default=None)
    expires_at: datetime | None = field(default=None)
    justification: str | None = field(default=None)


_override = OverrideState()


def is_override_active() -> bool:
    """Re-checks expiry on every call — does not trust _override.active alone."""
    if not _override.active:
        return False
    if _override.expires_at is None or datetime.now(timezone.utc) > _override.expires_at:
        logger.warning("Override expired without explicit deactivation — clearing state")
        _override.active = False
        return False
    return True


async def activate_override(approver_id: UUID, justification: str) -> dict:
    """Activate emergency override for the configured duration.

    Raises ValueError on short justification or already-active override.
    Returns {"override_token", "expires_at", "activated_by"}.
    """
    if len(justification.strip()) < 20:
        raise ValueError("JUSTIFICATION_TOO_SHORT")
    if is_override_active():
        raise ValueError("OVERRIDE_ALREADY_ACTIVE")

    token = create_override_token(approver_id)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.override_token_expire_minutes)

    _override.active = True
    _override.token = token
    _override.activated_by = str(approver_id)
    _override.expires_at = expires
    _override.justification = justification.strip()

    logger.warning(
        "Emergency override ACTIVATED — approver=%s expires=%s justification=%.80s",
        approver_id, expires.isoformat(), justification.strip(),
    )

    # Ledger + WS in background — failures are logged by spawn() but never block activation
    async def _side_effects() -> None:
        try:
            from app.database import get_pool
            from app.services.ledger_service import append as ledger_append
            await ledger_append(
                command_id=None,
                event_type="OVERRIDE_ACTIVATED",
                event_detail={"justification": justification.strip(), "expires_at": expires.isoformat()},
                operator_id=approver_id,
                approver_ids=[],
                db_pool=get_pool(),
            )
        except Exception as exc:
            logger.error("Override ledger write failed — audit trail incomplete: %s", exc)

        try:
            from app.services.ws_manager import ws_manager
            await ws_manager.broadcast_approver({
                "type": "OVERRIDE_ACTIVATED",
                "activated_by": str(approver_id),
                "expires_at": expires.isoformat(),
            })
        except Exception as exc:
            logger.warning("Override WS broadcast failed: %s", exc)

    spawn(_side_effects(), name="override-activated-side-effects")
    spawn(_auto_deactivate(expires, approver_id), name="override-auto-deactivate")

    return {
        "override_token": token,
        "expires_at": expires.isoformat(),
        "activated_by": str(approver_id),
    }


async def _auto_deactivate(expires: datetime, approver_id: UUID) -> None:
    import asyncio
    delay = (expires - datetime.now(timezone.utc)).total_seconds()
    if delay > 0:
        await asyncio.sleep(delay)
    _override.active = False
    logger.warning("Emergency override EXPIRED — approver=%s", approver_id)

    try:
        from app.database import get_pool
        from app.services.ledger_service import append as ledger_append
        await ledger_append(
            command_id=None,
            event_type="OVERRIDE_EXPIRED",
            event_detail={},
            operator_id=approver_id,
            approver_ids=[],
            db_pool=get_pool(),
        )
    except Exception as exc:
        logger.error("Override-expired ledger write failed — audit trail incomplete: %s", exc)


def get_override_status() -> dict:
    if not is_override_active():
        return {"active": False}
    return {
        "active": True,
        "expires_at": _override.expires_at.isoformat() if _override.expires_at else None,
        "activated_by": _override.activated_by,
    }
