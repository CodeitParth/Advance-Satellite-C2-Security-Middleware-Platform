"""Integration — command pipeline TC-INT-001..007. TRD §16.2

Runs against scsp_test with DEMO_MODE=true (fixture scores) and OBC disabled.
Packets are the known-good fixtures from the frontend CCSDS builder.
"""
import uuid

from tests.conftest import auth

PKT_REQUEST_TELEMETRY = "1900C0000000012A4B"    # LOW (score 5)
PKT_DISABLE_SAFE_MODE = "198EC000000111B3A2"    # HIGH (score 87)
PKT_THRUSTER_FIRE = "1B028000000132000A00001492B1"  # HIGH (score 90)
PKT_INVALID_VERSION = "F900C0000000012A4B"      # version bits != 0


def submit(client, tokens, packet_hex, username="op_chen", nonce=None):
    return client.post(
        "/api/v1/commands",
        json={"packet_hex": packet_hex, "nonce": nonce or str(uuid.uuid4())},
        headers=auth(tokens, username),
    )


def ledger_events(client, tokens, command_id):
    page = client.get("/api/v1/ledger?per_page=100", headers=auth(tokens, "admin_root")).json()
    return [e for e in page["entries"] if e["command_id"] == command_id]


def test_tc_int_001_low_risk_auto_approved(client, tokens):
    resp = submit(client, tokens, PKT_REQUEST_TELEMETRY)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["risk_tier"] == "LOW"
    assert body["status"] == "AUTO_APPROVED"
    events = ledger_events(client, tokens, body["command_id"])
    assert any(e["event_type"] == "COMMAND_SUBMITTED" for e in events)


def test_tc_int_002_high_risk_pending_dual_with_ws_notification(client, tokens, monkeypatch):
    sent: list[dict] = []

    async def capture(message):
        sent.append(message)

    from app.routers import commands as commands_module
    monkeypatch.setattr(commands_module.ws_manager, "broadcast_approver", capture)

    resp = submit(client, tokens, PKT_DISABLE_SAFE_MODE)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["risk_score"] == 87
    assert body["risk_tier"] == "HIGH"
    assert body["status"] == "PENDING_DUAL_APPROVAL"
    pending_msgs = [m for m in sent if m.get("type") == "COMMAND_PENDING"]
    assert pending_msgs and pending_msgs[0]["command_id"] == body["command_id"]


def test_tc_int_003_replay_same_nonce_409(client, tokens):
    nonce = str(uuid.uuid4())
    first = submit(client, tokens, PKT_REQUEST_TELEMETRY, nonce=nonce)
    assert first.status_code == 200
    second = submit(client, tokens, PKT_REQUEST_TELEMETRY, nonce=nonce)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "REPLAY_DETECTED"


def test_tc_int_004_dangerous_sequence_elevates_score(client, tokens):
    submit(client, tokens, PKT_DISABLE_SAFE_MODE)
    resp = submit(client, tokens, PKT_THRUSTER_FIRE)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # THRUSTER_FIRE fixture 90 + SEQ-002 elevation 25, capped at 100
    assert body["risk_score"] == 100
    rule_ids = [a["rule_id"] for a in body["sequence_alerts"]]
    assert "SEQ-002" in rule_ids


def test_tc_int_005_override_active_high_risk_dispatches(client, tokens):
    act = client.post(
        "/api/v1/override/activate",
        json={"justification": "Integration test emergency override justification"},
        headers=auth(tokens, "so_kim"),
    )
    assert act.status_code == 200, act.text

    resp = submit(client, tokens, PKT_DISABLE_SAFE_MODE)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "EMERGENCY_OVERRIDE"


def test_tc_int_006_invalid_packet_400(client, tokens):
    resp = submit(client, tokens, PKT_INVALID_VERSION)
    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "INVALID_CCSDS_PACKET"
    assert err["detail"]["error_code"] == "INVALID_VERSION"


def test_tc_int_007_unknown_apid_400(client, tokens):
    # APID 0x0FF is not in the registry; rebuild a valid-CRC packet around it
    from app.services.ccsds_parser import compute_crc16_ccitt
    header = bytes([0x18, 0xFF, 0xC0, 0x00, 0x00, 0x00, 0x01])
    crc = compute_crc16_ccitt(header)
    pkt = (header + bytes([crc >> 8, crc & 0xFF])).hex()

    resp = submit(client, tokens, pkt)
    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "INVALID_CCSDS_PACKET"
    assert err["detail"]["error_code"] == "UNKNOWN_APID"
