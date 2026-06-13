"""Unit tests — ledger hash chain: pure functions + mocked DB paths. TRD §16.1"""
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.ledger_service import (
    GENESIS_HASH,
    _build_payload,
    _compute_hash,
    append,
    verify_chain,
)


# ── Pure function tests ───────────────────────────────────────────────────────

class TestComputeHash:
    def test_deterministic(self):
        h1 = _compute_hash("prev", {"key": "val"}, "ts")
        h2 = _compute_hash("prev", {"key": "val"}, "ts")
        assert h1 == h2

    def test_different_prev_hash_gives_different_output(self):
        h1 = _compute_hash("aaa", {"key": "val"}, "ts")
        h2 = _compute_hash("bbb", {"key": "val"}, "ts")
        assert h1 != h2

    def test_different_payload_gives_different_output(self):
        h1 = _compute_hash("prev", {"key": "v1"}, "ts")
        h2 = _compute_hash("prev", {"key": "v2"}, "ts")
        assert h1 != h2

    def test_different_timestamp_gives_different_output(self):
        h1 = _compute_hash("prev", {}, "2024-01-01T00:00:00")
        h2 = _compute_hash("prev", {}, "2024-01-01T00:00:01")
        assert h1 != h2

    def test_output_is_64_char_hex(self):
        h = _compute_hash("0" * 64, {}, "2024-01-01T00:00:00+00:00")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_genesis_hash_constant(self):
        assert len(GENESIS_HASH) == 64
        assert GENESIS_HASH == "0" * 64

    def test_payload_is_json_sorted(self):
        """Dict insertion order must not affect the hash."""
        h1 = _compute_hash("prev", {"b": 2, "a": 1}, "ts")
        h2 = _compute_hash("prev", {"a": 1, "b": 2}, "ts")
        assert h1 == h2


class TestBuildPayload:
    def test_command_id_serialised_as_string(self):
        cmd_id = uuid4()
        p = _build_payload(cmd_id, "COMMAND_SUBMITTED", {}, None, [])
        assert p["command_id"] == str(cmd_id)

    def test_none_command_id(self):
        p = _build_payload(None, "SYSTEM_EVENT", {}, None, [])
        assert p["command_id"] is None

    def test_operator_id_serialised_as_string(self):
        op_id = uuid4()
        p = _build_payload(None, "X", {}, op_id, [])
        assert p["operator_id"] == str(op_id)

    def test_none_operator_id(self):
        p = _build_payload(None, "X", {}, None, [])
        assert p["operator_id"] is None

    def test_approver_ids_serialised_as_strings(self):
        ids = [uuid4(), uuid4()]
        p = _build_payload(None, "APPROVED", {}, None, ids)
        assert p["approver_ids"] == [str(i) for i in ids]

    def test_empty_approver_ids(self):
        p = _build_payload(None, "X", {}, None, [])
        assert p["approver_ids"] == []

    def test_event_detail_preserved(self):
        detail = {"risk_score": 87, "decision": "APPROVED"}
        p = _build_payload(None, "X", detail, None, [])
        assert p["event_detail"] == detail

    def test_all_required_keys_present(self):
        p = _build_payload(uuid4(), "EVT", {"k": "v"}, uuid4(), [uuid4()])
        assert set(p.keys()) == {
            "command_id", "event_type", "event_detail", "operator_id", "approver_ids"
        }


# ── Mocked DB: append ─────────────────────────────────────────────────────────

def _make_pool(prev_hash: str = GENESIS_HASH) -> MagicMock:
    """Build a minimal asyncpg pool mock that satisfies ledger_service._append_once."""
    prev_row = MagicMock()
    prev_row.__getitem__ = lambda self, k: prev_hash if k == "entry_hash" else None

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=prev_row)
    conn.execute = AsyncMock()

    tx = AsyncMock()
    tx.__aenter__ = AsyncMock(return_value=None)
    tx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx)

    acm = AsyncMock()
    acm.__aenter__ = AsyncMock(return_value=conn)
    acm.__aexit__ = AsyncMock(return_value=False)

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=acm)
    return pool


class TestAppend:
    @pytest.mark.asyncio
    async def test_returns_64_char_hex_hash(self):
        pool = _make_pool()
        h = await append(uuid4(), "COMMAND_SUBMITTED", {"score": 50}, uuid4(), [], pool)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    @pytest.mark.asyncio
    async def test_uses_genesis_hash_for_first_entry(self):
        """When no previous row exists (fetchrow returns None), uses GENESIS_HASH."""
        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)
        conn.execute = AsyncMock()

        tx = AsyncMock()
        tx.__aenter__ = AsyncMock(return_value=None)
        tx.__aexit__ = AsyncMock(return_value=False)
        conn.transaction = MagicMock(return_value=tx)

        acm = AsyncMock()
        acm.__aenter__ = AsyncMock(return_value=conn)
        acm.__aexit__ = AsyncMock(return_value=False)

        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acm)

        h = await append(None, "SYSTEM_BOOT", {}, None, [], pool)
        assert len(h) == 64

    @pytest.mark.asyncio
    async def test_two_entries_have_different_hashes(self):
        pool1 = _make_pool(GENESIS_HASH)
        h1 = await append(uuid4(), "EVT_A", {}, None, [], pool1)

        pool2 = _make_pool(h1)
        h2 = await append(uuid4(), "EVT_B", {}, None, [], pool2)

        assert h1 != h2

    @pytest.mark.asyncio
    async def test_insert_executed_with_correct_event_type(self):
        pool = _make_pool()
        await append(uuid4(), "COMMAND_DISPATCHED", {"k": "v"}, uuid4(), [], pool)

        conn = pool.acquire.return_value.__aenter__.return_value
        call_args = conn.execute.call_args
        assert "COMMAND_DISPATCHED" in call_args[0][1:]  # positional param


# ── Mocked DB: verify_chain ───────────────────────────────────────────────────

def _build_chain_entries(n: int) -> list:
    """Build n valid linked ledger entries."""
    entries = []
    prev_hash = GENESIS_HASH
    from datetime import datetime, timezone

    for i in range(n):
        cmd_id = uuid4()
        op_id = uuid4()
        detail = {"seq": i}
        payload = _build_payload(cmd_id, "COMMAND_SUBMITTED", detail, op_id, [])
        ts = datetime(2024, 1, 1, 0, i % 60, 0, tzinfo=timezone.utc)
        entry_hash = _compute_hash(prev_hash, payload, ts.isoformat())

        row = MagicMock()
        row.__getitem__ = lambda self, k, _h=entry_hash, _ph=prev_hash, _e=detail, _c=cmd_id, _o=op_id, _t=ts: {
            "entry_hash": _h,
            "prev_hash": _ph,
            "event_detail": json.dumps(_e),
            "event_type": "COMMAND_SUBMITTED",
            "command_id": _c,
            "operator_id": _o,
            "approver_ids": [],
            "timestamp": _t,
            "sequence": i + 1,
            "entry_id": uuid4(),
        }[k]

        entries.append(row)
        prev_hash = entry_hash

    return entries


def _pool_for_verify(entries: list) -> MagicMock:
    """Pool whose cursor yields the provided entries."""
    async def _cursor_gen(*args, **kwargs):
        for e in entries:
            yield e

    conn = AsyncMock()

    tx = AsyncMock()
    tx.__aenter__ = AsyncMock(return_value=None)
    tx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx)
    conn.cursor = MagicMock(return_value=_cursor_gen())

    acm = AsyncMock()
    acm.__aenter__ = AsyncMock(return_value=conn)
    acm.__aexit__ = AsyncMock(return_value=False)

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=acm)
    return pool


class TestVerifyChain:
    @pytest.mark.asyncio
    async def test_empty_chain_is_valid(self):
        pool = _pool_for_verify([])
        result = await verify_chain(pool)
        assert result["valid"] is True
        assert result["entries_checked"] == 0

    @pytest.mark.asyncio
    async def test_valid_chain_of_one(self):
        entries = _build_chain_entries(1)
        pool = _pool_for_verify(entries)
        result = await verify_chain(pool)
        assert result["valid"] is True
        assert result["entries_checked"] == 1

    @pytest.mark.asyncio
    async def test_valid_chain_of_five(self):
        entries = _build_chain_entries(5)
        pool = _pool_for_verify(entries)
        result = await verify_chain(pool)
        assert result["valid"] is True
        assert result["entries_checked"] == 5

    @pytest.mark.asyncio
    async def test_tampered_entry_detected(self):
        entries = _build_chain_entries(3)
        original_row = entries[1]

        # Tamper entry at index 1: return a wrong entry_hash, delegate everything else
        bad_row = MagicMock()
        bad_row.__getitem__ = lambda _, k: "deadbeef" * 8 if k == "entry_hash" else original_row[k]
        entries[1] = bad_row

        pool = _pool_for_verify(entries)
        result = await verify_chain(pool)
        assert result["valid"] is False
        assert "corrupted_at_sequence" in result
