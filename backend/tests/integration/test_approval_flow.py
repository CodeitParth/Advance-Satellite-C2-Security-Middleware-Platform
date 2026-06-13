"""Integration — approval flow TC-INT-010..017. TRD §16.2"""
import json
import uuid

from tests.conftest import auth, run_async, _direct_execute

PKT_UPDATE_PARAMETER = "1A008000000120050A3C7D"   # MEDIUM (score 55) → single approval
PKT_DISABLE_SAFE_MODE = "198EC000000111B3A2"      # HIGH (score 87) → dual approval


def submit(client, tokens, packet_hex, username="op_chen"):
    resp = client.post(
        "/api/v1/commands",
        json={"packet_hex": packet_hex, "nonce": str(uuid.uuid4())},
        headers=auth(tokens, username),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def decide(client, tokens, command_id, username, action="approve", justification="integration test decision"):
    return client.post(
        f"/api/v1/commands/{command_id}/{action}",
        json={"justification": justification},
        headers=auth(tokens, username),
    )


def test_tc_int_010_medium_single_approval_dispatches(client, tokens):
    cmd = submit(client, tokens, PKT_UPDATE_PARAMETER)
    assert cmd["status"] == "PENDING_SINGLE_APPROVAL"
    resp = decide(client, tokens, cmd["command_id"], "so_kim")
    assert resp.status_code == 200, resp.text
    assert resp.json()["new_status"] == "DISPATCHED"


def test_tc_int_011_high_first_approval_still_pending(client, tokens):
    cmd = submit(client, tokens, PKT_DISABLE_SAFE_MODE)
    assert cmd["status"] == "PENDING_DUAL_APPROVAL"
    resp = decide(client, tokens, cmd["command_id"], "so_kim")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["new_status"] == "PENDING_DUAL_APPROVAL"
    assert body["approvals_recorded"] == 1
    assert body["approvals_required"] == 2


def test_tc_int_012_high_second_distinct_approver_dispatches(client, tokens):
    cmd = submit(client, tokens, PKT_DISABLE_SAFE_MODE)
    decide(client, tokens, cmd["command_id"], "so_kim")
    resp = decide(client, tokens, cmd["command_id"], "so_okonkwo")
    assert resp.status_code == 200, resp.text
    assert resp.json()["new_status"] == "DISPATCHED"

    detail = client.get(f"/api/v1/commands/{cmd['command_id']}", headers=auth(tokens, "so_kim"))
    assert detail.json()["status"] == "DISPATCHED"


def test_tc_int_013_rejection_recorded_in_ledger(client, tokens):
    cmd = submit(client, tokens, PKT_DISABLE_SAFE_MODE)
    resp = decide(client, tokens, cmd["command_id"], "so_kim", action="reject",
                  justification="unsafe during eclipse")
    assert resp.status_code == 200, resp.text
    assert resp.json()["new_status"] == "REJECTED"

    page = client.get("/api/v1/ledger?per_page=100", headers=auth(tokens, "admin_root")).json()
    rejected = [e for e in page["entries"]
                if e["command_id"] == cmd["command_id"] and e["event_type"] == "COMMAND_REJECTED"]
    assert rejected, "COMMAND_REJECTED ledger entry missing"


def test_tc_int_014_self_approval_forbidden(client, tokens):
    # so_kim (approver) submits, then tries to approve their own command
    cmd = submit(client, tokens, PKT_DISABLE_SAFE_MODE, username="so_kim")
    resp = decide(client, tokens, cmd["command_id"], "so_kim")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "SELF_APPROVAL_FORBIDDEN"


def test_tc_int_015_approving_resolved_command_409(client, tokens):
    cmd = submit(client, tokens, PKT_UPDATE_PARAMETER)
    assert decide(client, tokens, cmd["command_id"], "so_kim").status_code == 200
    resp = decide(client, tokens, cmd["command_id"], "so_okonkwo")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "COMMAND_ALREADY_RESOLVED"


def test_tc_int_016_ledger_integrity_valid_chain(client, tokens):
    submit(client, tokens, PKT_REQUEST := "1900C0000000012A4B")
    resp = client.get("/api/v1/ledger/verify", headers=auth(tokens, "admin_root"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["entries_checked"] >= 1


def test_tc_int_017_ledger_integrity_detects_corruption(client, tokens):
    submit(client, tokens, "1900C0000000012A4B")
    submit(client, tokens, PKT_UPDATE_PARAMETER)

    # Corrupt sequence 1 directly (rules disabled for the test DB only)
    run_async(_direct_execute(
        "ALTER TABLE ledger DISABLE RULE ledger_no_update",
        """UPDATE ledger SET event_detail = jsonb_set(event_detail, '{risk_score}', '1')
           WHERE sequence = 1""",
        "ALTER TABLE ledger ENABLE RULE ledger_no_update",
    ))

    resp = client.get("/api/v1/ledger/verify", headers=auth(tokens, "admin_root"))
    body = resp.json()
    assert body["valid"] is False
    assert body["corrupted_at_sequence"] == 1


def test_ed25519_signature_stored_and_verifiable(client, tokens):
    """Beyond TRD: approval rows carry a verifiable Ed25519 signature."""
    import asyncpg
    from app.database import _build_ssl_context, _normalize_dsn
    from app.services.signing_service import verify_approval
    from tests.conftest import _test_url

    cmd = submit(client, tokens, PKT_UPDATE_PARAMETER)
    decide(client, tokens, cmd["command_id"], "so_kim")

    async def fetch_row():
        conn = await asyncpg.connect(dsn=_normalize_dsn(_test_url), ssl=_build_ssl_context())
        try:
            return await conn.fetchrow(
                "SELECT command_id, approver_id, decision, decided_at, token_hash "
                "FROM approvals WHERE command_id = $1", uuid.UUID(cmd["command_id"]))
        finally:
            await conn.close()

    row = run_async(fetch_row())
    assert row is not None and len(row["token_hash"]) == 128
    assert verify_approval(row["token_hash"], row["command_id"], row["approver_id"],
                           row["decision"], row["decided_at"])
