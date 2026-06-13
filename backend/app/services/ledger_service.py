"""SHA-256 hash-chain ledger: append entries, verify integrity. No UPDATE/DELETE ever."""
import hashlib
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

GENESIS_HASH = "0" * 64
_MAX_APPEND_RETRIES = 3


# ── Hash computation ──────────────────────────────────────────────────────────

def _compute_hash(prev_hash: str, payload: dict, timestamp: str) -> str:
    content = prev_hash + json.dumps(payload, sort_keys=True) + timestamp
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _build_payload(
    command_id: UUID | None,
    event_type: str,
    event_detail: dict,
    operator_id: UUID | None,
    approver_ids: list,
) -> dict:
    """Canonical payload dict — identical structure used for write AND verify."""
    return {
        "command_id": str(command_id) if command_id else None,
        "event_type": event_type,
        "event_detail": event_detail,
        "operator_id": str(operator_id) if operator_id else None,
        "approver_ids": [str(a) for a in approver_ids],
    }


# ── Public API ────────────────────────────────────────────────────────────────

async def append(
    command_id: UUID | None,
    event_type: str,
    event_detail: dict,
    operator_id: UUID | None,
    approver_ids: list,
    db_pool,
) -> str:
    """Append a new entry to the hash chain. Returns the new entry_hash.

    Uses SERIALIZABLE isolation so two concurrent appends cannot both read
    the same prev_hash and produce a broken chain link. Retries up to
    _MAX_APPEND_RETRIES times on serialization failure before raising.
    """
    for attempt in range(1, _MAX_APPEND_RETRIES + 1):
        try:
            return await _append_once(
                command_id, event_type, event_detail, operator_id, approver_ids, db_pool
            )
        except asyncpg.exceptions.SerializationError:
            if attempt == _MAX_APPEND_RETRIES:
                logger.error(
                    "Ledger append failed after %d serialization retries — event_type=%s",
                    attempt, event_type,
                )
                raise
            logger.debug(
                "Ledger append serialization conflict (attempt %d/%d) — retrying",
                attempt, _MAX_APPEND_RETRIES,
            )
    # unreachable — for type checker
    raise RuntimeError("ledger append retry loop exhausted")


async def _append_once(
    command_id: UUID | None,
    event_type: str,
    event_detail: dict,
    operator_id: UUID | None,
    approver_ids: list,
    db_pool,
) -> str:
    async with db_pool.acquire() as conn:
        async with conn.transaction(isolation="serializable"):
            prev = await conn.fetchrow(
                "SELECT entry_hash FROM ledger ORDER BY sequence DESC LIMIT 1"
            )
            prev_hash = prev["entry_hash"] if prev else GENESIS_HASH

            payload = _build_payload(command_id, event_type, event_detail, operator_id, approver_ids)
            ts = datetime.now(timezone.utc)
            entry_hash = _compute_hash(prev_hash, payload, ts.isoformat())
            uuid_approver_ids = [UUID(str(a)) for a in approver_ids]

            await conn.execute(
                """
                INSERT INTO ledger
                  (prev_hash, entry_hash, command_id, event_type, event_detail,
                   operator_id, approver_ids, timestamp)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
                """,
                prev_hash, entry_hash, command_id, event_type,
                json.dumps(event_detail), operator_id, uuid_approver_ids, ts,
            )
            return entry_hash


async def verify_chain(db_pool) -> dict:
    """Traverse the full ledger and verify every hash link.

    Uses a server-side cursor (prefetch=200) so only 200 rows are held in
    memory at a time — safe for arbitrarily large ledgers.

    Returns {"valid": True, "entries_checked": N} on success, or
    {"valid": False, "corrupted_at_sequence": N, ...} on first failure.
    """
    async with db_pool.acquire() as conn:
        prev_hash = GENESIS_HASH
        entries_checked = 0

        async with conn.transaction():
            async for entry in conn.cursor(
                "SELECT * FROM ledger ORDER BY sequence ASC",
                prefetch=200,
            ):
                # asyncpg returns JSONB as a raw str unless a codec is registered —
                # decode so the payload matches the dict that was hashed on append
                detail = entry["event_detail"]
                if isinstance(detail, str):
                    detail = json.loads(detail)
                payload = _build_payload(
                    command_id=entry["command_id"],
                    event_type=entry["event_type"],
                    event_detail=detail,
                    operator_id=entry["operator_id"],
                    approver_ids=entry["approver_ids"] or [],
                )
                # TIMESTAMPTZ returns timezone-aware datetime — isoformat is consistent
                # with the string stored during append() on the same connection tz
                expected = _compute_hash(prev_hash, payload, entry["timestamp"].isoformat())

                if expected != entry["entry_hash"]:
                    return {
                        "valid": False,
                        "corrupted_at_sequence": entry["sequence"],
                        "entry_id": str(entry["entry_id"]),
                        "expected_hash": expected,
                        "stored_hash": entry["entry_hash"],
                    }

                prev_hash = entry["entry_hash"]
                entries_checked += 1

    return {"valid": True, "entries_checked": entries_checked}
