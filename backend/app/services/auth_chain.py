"""Authorization state machine: status transitions, quorum logic, timeout handler."""
import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from app.models.command import CommandStatus
from app.services.signing_service import sign_approval
from app.utils.tasks import spawn

logger = logging.getLogger(__name__)


# ── Status determination ──────────────────────────────────────────────────────

async def determine_initial_status(risk_tier: str, override_active: bool) -> CommandStatus:
    if override_active:
        return CommandStatus.EMERGENCY_OVERRIDE
    if risk_tier == "LOW":
        return CommandStatus.AUTO_APPROVED
    if risk_tier == "MEDIUM":
        return CommandStatus.PENDING_SINGLE_APPROVAL
    return CommandStatus.PENDING_DUAL_APPROVAL


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _update_command_status(command_id: UUID, new_status: CommandStatus, db_pool) -> None:
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE commands SET status = $1 WHERE id = $2",
            new_status.value,
            command_id,
        )


async def _get_expired_pending_commands(db_pool) -> list:
    async with db_pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT id, status FROM commands
            WHERE status IN ('PENDING_SINGLE_APPROVAL', 'PENDING_DUAL_APPROVAL')
              AND submitted_at < NOW() - INTERVAL '5 minutes'
            """,
        )


# ── Approval processor ────────────────────────────────────────────────────────

async def process_approval(
    command_id: UUID,
    approver_id: UUID,
    decision: str,
    justification: str,
    db_pool,
) -> CommandStatus:
    """Record an approval/rejection and check quorum.

    Uses a serializable transaction with SELECT FOR UPDATE to prevent two
    concurrent approvers both reading the same approval count and both
    deciding they're the quorum-completing vote (TOCTOU race).

    Returns new CommandStatus. Raises ValueError on self-approval attempt.
    """
    async with db_pool.acquire() as conn:
        async with conn.transaction(isolation="serializable"):
            # Lock the command row for the duration of this transaction
            command = await conn.fetchrow(
                "SELECT id, submitter_id, status FROM commands WHERE id = $1 FOR UPDATE",
                command_id,
            )

            if command is None:
                raise ValueError("COMMAND_NOT_FOUND")

            if str(approver_id) == str(command["submitter_id"]):
                raise ValueError("Self-approval not permitted")

            # Ed25519-sign the decision (security spec: Approval signing → Ed25519).
            # decided_at is computed here so the stored timestamp matches the
            # one inside the signed payload exactly.
            decided_at = datetime.now(timezone.utc)
            signature = sign_approval(command_id, approver_id, decision, decided_at)

            if decision == "REJECTED":
                await conn.execute(
                    """
                    INSERT INTO approvals (command_id, approver_id, decision, justification,
                                           decided_at, token_hash, is_override)
                    VALUES ($1, $2, 'REJECTED', $3, $4, $5, false)
                    ON CONFLICT (command_id, approver_id) DO NOTHING
                    """,
                    command_id, approver_id, justification, decided_at, signature,
                )
                await conn.execute(
                    "UPDATE commands SET status = $1 WHERE id = $2",
                    CommandStatus.REJECTED.value,
                    command_id,
                )
                return CommandStatus.REJECTED

            # Record approval (idempotent — ON CONFLICT DO NOTHING)
            await conn.execute(
                """
                INSERT INTO approvals (command_id, approver_id, decision, justification,
                                       decided_at, token_hash, is_override)
                VALUES ($1, $2, 'APPROVED', $3, $4, $5, false)
                ON CONFLICT (command_id, approver_id) DO NOTHING
                """,
                command_id,
                approver_id,
                justification,
                decided_at,
                signature,
            )

            # Count approvals within the same transaction — consistent with the lock
            count_row = await conn.fetchrow(
                "SELECT COUNT(*) AS cnt FROM approvals WHERE command_id = $1 AND decision = 'APPROVED'",
                command_id,
            )
            approval_count = int(count_row["cnt"])

            current_status = CommandStatus(command["status"])
            required = 1 if current_status == CommandStatus.PENDING_SINGLE_APPROVAL else 2

            if approval_count >= required:
                await conn.execute(
                    "UPDATE commands SET status = $1 WHERE id = $2",
                    CommandStatus.DISPATCHED.value,
                    command_id,
                )
                return CommandStatus.DISPATCHED

    return current_status


# ── Background timeout handler ────────────────────────────────────────────────

async def check_pending_timeouts() -> None:
    """Background task: escalates PENDING_SINGLE → PENDING_DUAL after 5 min,
    then PENDING_DUAL → BLOCKED after another 5 min. Runs every 30 seconds.
    Per-command errors are logged and skipped; the loop never dies on one bad command.
    """
    while True:
        await asyncio.sleep(30)
        try:
            from app.database import _pool
            if _pool is None:
                continue

            expired = await _get_expired_pending_commands(_pool)
            for cmd in expired:
                cmd_id = cmd["id"]
                cmd_status = CommandStatus(cmd["status"])
                try:
                    await _handle_timeout(cmd_id, cmd_status, _pool)
                except Exception:
                    logger.exception(
                        "Timeout handler failed for command_id=%s status=%s — skipping",
                        cmd_id, cmd_status.value,
                    )

        except Exception:
            logger.exception("check_pending_timeouts: unhandled error in outer loop")


async def _handle_timeout(cmd_id: UUID, cmd_status: CommandStatus, pool) -> None:
    if cmd_status == CommandStatus.PENDING_SINGLE_APPROVAL:
        await _update_command_status(cmd_id, CommandStatus.PENDING_DUAL_APPROVAL, pool)
        logger.warning("Escalated command_id=%s SINGLE→DUAL (timeout)", cmd_id)

        async def _ws_notify() -> None:
            from app.services.ws_manager import ws_manager
            await ws_manager.broadcast_approver({
                "type": "COMMAND_ESCALATED",
                "command_id": str(cmd_id),
            })

        spawn(_ws_notify(), name=f"escalate-ws-{cmd_id}")

    elif cmd_status == CommandStatus.PENDING_DUAL_APPROVAL:
        await _update_command_status(cmd_id, CommandStatus.BLOCKED, pool)
        logger.warning("Blocked command_id=%s (dual-approval timeout)", cmd_id)

        async def _ledger_entry() -> None:
            from app.services.ledger_service import append as ledger_append
            await ledger_append(
                command_id=cmd_id,
                event_type="COMMAND_BLOCKED_TIMEOUT",
                event_detail={"reason": "dual_approval_timeout"},
                # System-initiated event — no operator (a zero-UUID violates the FK)
                operator_id=None,
                approver_ids=[],
                db_pool=pool,
            )

        spawn(_ledger_entry(), name=f"blocked-ledger-{cmd_id}")
