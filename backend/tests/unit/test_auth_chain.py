"""Unit tests — authorization state machine: status routing, quorum, timeout. TRD §16.1"""
import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.models.command import CommandStatus
from app.services.auth_chain import (
    _get_expired_pending_commands,
    _handle_timeout,
    _update_command_status,
    determine_initial_status,
    process_approval,
)


# ── Status determination ──────────────────────────────────────────────────────

class TestDetermineInitialStatus:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("risk_tier,override,expected", [
        ("LOW",    False, CommandStatus.AUTO_APPROVED),
        ("MEDIUM", False, CommandStatus.PENDING_SINGLE_APPROVAL),
        ("HIGH",   False, CommandStatus.PENDING_DUAL_APPROVAL),
        ("LOW",    True,  CommandStatus.EMERGENCY_OVERRIDE),
        ("MEDIUM", True,  CommandStatus.EMERGENCY_OVERRIDE),
        ("HIGH",   True,  CommandStatus.EMERGENCY_OVERRIDE),
    ])
    async def test_all_branches(self, risk_tier, override, expected):
        result = await determine_initial_status(risk_tier, override)
        assert result == expected


# ── DB helper: _update_command_status ────────────────────────────────────────

def _make_pool_for_update() -> MagicMock:
    conn = AsyncMock()
    conn.execute = AsyncMock()
    acm = AsyncMock()
    acm.__aenter__ = AsyncMock(return_value=conn)
    acm.__aexit__ = AsyncMock(return_value=False)
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=acm)
    return pool


class TestUpdateCommandStatus:
    @pytest.mark.asyncio
    async def test_executes_update(self):
        pool = _make_pool_for_update()
        cmd_id = uuid4()
        await _update_command_status(cmd_id, CommandStatus.DISPATCHED, pool)
        conn = pool.acquire.return_value.__aenter__.return_value
        conn.execute.assert_awaited_once()
        args = conn.execute.call_args[0]
        assert args[1] == "DISPATCHED"
        assert args[2] == cmd_id


# ── DB helper: _get_expired_pending_commands ──────────────────────────────────

class TestGetExpiredPendingCommands:
    @pytest.mark.asyncio
    async def test_returns_fetch_result(self):
        fake_rows = [MagicMock(), MagicMock()]
        conn = AsyncMock()
        conn.fetch = AsyncMock(return_value=fake_rows)
        acm = AsyncMock()
        acm.__aenter__ = AsyncMock(return_value=conn)
        acm.__aexit__ = AsyncMock(return_value=False)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acm)

        result = await _get_expired_pending_commands(pool)
        assert result == fake_rows
        conn.fetch.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_empty_result(self):
        conn = AsyncMock()
        conn.fetch = AsyncMock(return_value=[])
        acm = AsyncMock()
        acm.__aenter__ = AsyncMock(return_value=conn)
        acm.__aexit__ = AsyncMock(return_value=False)
        pool = MagicMock()
        pool.acquire = MagicMock(return_value=acm)

        result = await _get_expired_pending_commands(pool)
        assert result == []


# ── process_approval ──────────────────────────────────────────────────────────

def _make_approval_pool(submitter_id: str, status: CommandStatus, approval_count: int = 0):
    cmd_row = MagicMock()
    cmd_row.__getitem__ = lambda _, k: {
        "id": uuid4(), "submitter_id": submitter_id, "status": status.value,
    }[k]
    count_row = MagicMock()
    count_row.__getitem__ = lambda _, k: approval_count if k == "cnt" else None

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(side_effect=[cmd_row, count_row])
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


class TestProcessApproval:
    @pytest.mark.asyncio
    async def test_self_approval_raises(self):
        op_id = uuid4()
        pool = _make_approval_pool(str(op_id), CommandStatus.PENDING_SINGLE_APPROVAL)
        with pytest.raises(ValueError, match="Self-approval"):
            await process_approval(uuid4(), op_id, "APPROVED", "justification", pool)

    @pytest.mark.asyncio
    async def test_rejection_returns_rejected(self):
        pool = _make_approval_pool(str(uuid4()), CommandStatus.PENDING_SINGLE_APPROVAL)
        result = await process_approval(uuid4(), uuid4(), "REJECTED", "unsafe", pool)
        assert result == CommandStatus.REJECTED

    @pytest.mark.asyncio
    async def test_single_quorum_dispatches(self):
        pool = _make_approval_pool(str(uuid4()), CommandStatus.PENDING_SINGLE_APPROVAL, approval_count=1)
        result = await process_approval(uuid4(), uuid4(), "APPROVED", "ok", pool)
        assert result == CommandStatus.DISPATCHED

    @pytest.mark.asyncio
    async def test_dual_first_vote_still_pending(self):
        pool = _make_approval_pool(str(uuid4()), CommandStatus.PENDING_DUAL_APPROVAL, approval_count=1)
        result = await process_approval(uuid4(), uuid4(), "APPROVED", "first ok", pool)
        assert result == CommandStatus.PENDING_DUAL_APPROVAL

    @pytest.mark.asyncio
    async def test_dual_second_vote_dispatches(self):
        pool = _make_approval_pool(str(uuid4()), CommandStatus.PENDING_DUAL_APPROVAL, approval_count=2)
        result = await process_approval(uuid4(), uuid4(), "APPROVED", "second ok", pool)
        assert result == CommandStatus.DISPATCHED

    @pytest.mark.asyncio
    async def test_command_not_found_raises(self):
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
        with pytest.raises(ValueError, match="COMMAND_NOT_FOUND"):
            await process_approval(uuid4(), uuid4(), "APPROVED", "ok", pool)


# ── Timeout handler ───────────────────────────────────────────────────────────

class TestHandleTimeout:
    @pytest.mark.asyncio
    async def test_single_approval_escalates_to_dual(self, monkeypatch):
        from app.services import auth_chain
        import app.services.ws_manager as ws_mod

        mock_update = AsyncMock()
        mock_broadcast = AsyncMock()
        monkeypatch.setattr(auth_chain, "_update_command_status", mock_update)
        monkeypatch.setattr(ws_mod.ws_manager, "broadcast_approver", mock_broadcast)

        cmd_id = uuid4()
        pool = MagicMock()
        await _handle_timeout(cmd_id, CommandStatus.PENDING_SINGLE_APPROVAL, pool)
        await asyncio.sleep(0.05)  # let spawned task execute

        mock_update.assert_awaited_once_with(cmd_id, CommandStatus.PENDING_DUAL_APPROVAL, pool)
        mock_broadcast.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_dual_approval_escalates_to_blocked(self, monkeypatch):
        from app.services import auth_chain
        import app.services.ledger_service as ledger_mod

        mock_update = AsyncMock()
        mock_append = AsyncMock()
        monkeypatch.setattr(auth_chain, "_update_command_status", mock_update)
        monkeypatch.setattr(ledger_mod, "append", mock_append)

        cmd_id = uuid4()
        pool = MagicMock()
        await _handle_timeout(cmd_id, CommandStatus.PENDING_DUAL_APPROVAL, pool)
        await asyncio.sleep(0.05)  # let spawned task execute

        mock_update.assert_awaited_once_with(cmd_id, CommandStatus.BLOCKED, pool)
        mock_append.assert_awaited_once()


# ── check_pending_timeouts (one cycle) ────────────────────────────────────────

class TestCheckPendingTimeouts:
    @pytest.mark.asyncio
    async def test_skips_when_pool_is_none(self, monkeypatch):
        import app.database as db_mod
        from app.services import auth_chain

        sleep_count = [0]

        async def _fast_sleep(_: float) -> None:
            sleep_count[0] += 1
            if sleep_count[0] > 1:
                raise asyncio.CancelledError()

        monkeypatch.setattr(asyncio, "sleep", _fast_sleep)
        monkeypatch.setattr(db_mod, "_pool", None)

        task = asyncio.create_task(auth_chain.check_pending_timeouts())
        try:
            await asyncio.wait_for(task, timeout=1.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        assert sleep_count[0] >= 1

    @pytest.mark.asyncio
    async def test_processes_expired_commands(self, monkeypatch):
        import app.database as db_mod
        from app.services import auth_chain

        sleep_count = [0]

        async def _fast_sleep(_: float) -> None:
            sleep_count[0] += 1
            if sleep_count[0] > 1:
                raise asyncio.CancelledError()

        mock_pool = MagicMock()
        expired_cmd = MagicMock()
        _expired_id = uuid4()
        expired_cmd.__getitem__ = lambda _, k: {
            "id": _expired_id,
            "status": "PENDING_SINGLE_APPROVAL",
        }[k]

        mock_get_expired = AsyncMock(return_value=[expired_cmd])
        mock_handle = AsyncMock()

        monkeypatch.setattr(asyncio, "sleep", _fast_sleep)
        monkeypatch.setattr(db_mod, "_pool", mock_pool)
        monkeypatch.setattr(auth_chain, "_get_expired_pending_commands", mock_get_expired)
        monkeypatch.setattr(auth_chain, "_handle_timeout", mock_handle)

        task = asyncio.create_task(auth_chain.check_pending_timeouts())
        try:
            await asyncio.wait_for(task, timeout=1.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        mock_get_expired.assert_awaited()
        mock_handle.assert_awaited()
