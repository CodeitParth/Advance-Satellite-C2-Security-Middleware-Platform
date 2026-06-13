"""Ledger router: GET /api/v1/ledger (paginated), GET /api/v1/ledger/verify,
PUT /api/v1/ledger/demo-tamper (development only)."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.database import get_db
from app.middleware.auth_middleware import get_current_operator, require_role
from app.models.operator import Role, TokenPayload
from app.services.ledger_service import append as ledger_append, verify_chain
from app.utils.logging_utils import sanitize
from app.utils.serialization import row_to_dict

router = APIRouter()
logger = logging.getLogger(__name__)


# /verify must be declared before "" to prevent FastAPI matching "" greedily
@router.get("/verify")
async def verify_ledger(
    current: TokenPayload = Depends(require_role(Role.ADMIN)),
    db=Depends(get_db),
):
    result = await verify_chain(db)
    result["verified_at"] = datetime.now(timezone.utc).isoformat()

    logger.info(
        "Ledger integrity check — admin=%s valid=%s entries_checked=%s",
        sanitize(current.username), result.get("valid"), result.get("entries_checked"),
    )

    # Write the verification event itself to the ledger as an audit record
    try:
        await ledger_append(
            command_id=None,
            event_type="LEDGER_VERIFY",
            event_detail={"valid": result.get("valid"),
                          "entries_checked": result.get("entries_checked")},
            operator_id=None,
            approver_ids=[],
            db_pool=db,
        )
    except Exception as exc:
        logger.warning("Could not write LEDGER_VERIFY audit entry: %s", exc)

    return result


@router.put("/demo-tamper")
async def demo_tamper(
    current: TokenPayload = Depends(require_role(Role.ADMIN)),
    db=Depends(get_db),
):
    """Development-only: corrupt ledger entry 42 (risk_score 87 → 12) to
    demonstrate hash-chain tamper detection. The append-only Postgres rules
    are disabled for the single UPDATE and re-enabled in the same transaction.
    """
    if settings.app_env != "development":
        raise HTTPException(
            status_code=403,
            detail={"error": {
                "code": "DEMO_TAMPER_DISABLED",
                "message": "Demo tamper is only available when APP_ENV=development",
                "detail": {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }},
        )

    async with db.acquire() as conn:
        async with conn.transaction():
            await conn.execute("ALTER TABLE ledger DISABLE RULE ledger_no_update")
            try:
                result = await conn.execute(
                    """
                    UPDATE ledger
                    SET event_detail = jsonb_set(event_detail, '{risk_score}', '12')
                    WHERE sequence = 42
                    """
                )
            finally:
                await conn.execute("ALTER TABLE ledger ENABLE RULE ledger_no_update")

    tampered = result.endswith("1")
    logger.warning(
        "DEMO TAMPER executed by admin=%s — entry 42 modified=%s",
        sanitize(current.username), tampered,
    )
    if not tampered:
        raise HTTPException(
            status_code=404,
            detail={"error": {
                "code": "COMMAND_NOT_FOUND",
                "message": "Ledger entry at sequence 42 does not exist — run demo seeding first",
                "detail": {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }},
        )
    return {"tampered_sequence": 42, "field": "risk_score", "new_value": 12}


@router.get("")
async def get_ledger(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    event_type: str | None = Query(default=None),
    _: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    offset = (page - 1) * per_page

    if event_type:
        total_row = await db.fetchrow(
            "SELECT COUNT(*) AS cnt FROM ledger WHERE event_type = $1", event_type
        )
        rows = await db.fetch(
            "SELECT * FROM ledger WHERE event_type = $1 ORDER BY sequence DESC LIMIT $2 OFFSET $3",
            event_type, per_page, offset,
        )
    else:
        total_row = await db.fetchrow("SELECT COUNT(*) AS cnt FROM ledger")
        rows = await db.fetch(
            "SELECT * FROM ledger ORDER BY sequence DESC LIMIT $1 OFFSET $2",
            per_page, offset,
        )

    total = int(total_row["cnt"]) if total_row else 0
    return {
        "entries": [row_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }
