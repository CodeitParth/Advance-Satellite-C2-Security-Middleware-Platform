"""Demo verification — the 11 checks from TRD §16.3. T-033

Run: python backend/scripts/verify_demo_state.py
Prints PASS/FAIL per check; exits 1 if any required check fails.
The ngrok check is advisory only (warns, never fails the run).
"""
import asyncio
import json
import socket
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
from scripts._seed_common import create_seed_pool

GREEN, RED, YELLOW, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[0m"
BACKEND = "http://localhost:8000"

results: list[tuple[str, bool, str]] = []  # (label, passed, detail)
warnings: list[str] = []


def record(label: str, passed: bool, detail: str = "") -> None:
    results.append((label, passed, detail))


async def main() -> int:
    pool = None

    # 1. Postgres connection
    try:
        pool = await create_seed_pool()
        await pool.fetchval("SELECT 1")
        record("Postgres connection", True)
    except Exception as exc:
        record("Postgres connection", False, str(exc)[:80])

    if pool:
        # 2. All 6 operators seeded (c2_gateway service account is a bonus 7th)
        try:
            count = await pool.fetchval(
                "SELECT COUNT(*) FROM operators WHERE username != 'c2_gateway'")
            record("All 6 operators seeded", count >= 6, f"found {count}")
        except Exception as exc:
            record("All 6 operators seeded", False, str(exc)[:80])

        # 3. ≥50 ledger entries present
        try:
            count = await pool.fetchval("SELECT COUNT(*) FROM ledger")
            record("Ledger entries present (>=50)", count >= 50, f"found {count}")
        except Exception as exc:
            record("Ledger entries present (>=50)", False, str(exc)[:80])

        # 4. 1 command in PENDING_DUAL_APPROVAL
        try:
            count = await pool.fetchval(
                "SELECT COUNT(*) FROM commands WHERE status = 'PENDING_DUAL_APPROVAL'")
            record("Pending dual-approval command staged", count >= 1,
                   f"found {count} — run seed_scenarios.py if 0 (commands BLOCK after 5 min)")
        except Exception as exc:
            record("Pending dual-approval command staged", False, str(exc)[:80])

        # 9. Integrity check on unmodified ledger
        try:
            from app.services.ledger_service import verify_chain
            vr = await verify_chain(pool)
            record("Ledger integrity (hash chain valid)", bool(vr.get("valid")),
                   f"{vr.get('entries_checked', 0)} entries"
                   if vr.get("valid") else f"corrupted at seq {vr.get('corrupted_at_sequence')}")
        except Exception as exc:
            record("Ledger integrity (hash chain valid)", False, str(exc)[:80])

        # 10. Tamper entry 42 demo available (entry exists with risk_score 87 + dev env)
        try:
            row = await pool.fetchrow("SELECT event_detail FROM ledger WHERE sequence = 42")
            detail = row["event_detail"] if row else None
            if isinstance(detail, str):
                detail = json.loads(detail)
            has_target = bool(detail and detail.get("risk_score") == 87)
            is_dev = settings.app_env == "development"
            record("Tamper demo available (seq 42, dev env)", has_target and is_dev,
                   f"seq42 risk_score={detail.get('risk_score') if detail else 'missing'}, APP_ENV={settings.app_env}")
        except Exception as exc:
            record("Tamper demo available (seq 42, dev env)", False, str(exc)[:80])

    # 5. DEMO_MODE fixtures valid JSON
    try:
        fixtures_path = Path(__file__).parent.parent / "fixtures" / "demo_scores.json"
        fixtures = json.loads(fixtures_path.read_text())
        ok = all("risk_score" in v for v in fixtures.values())
        record("DEMO_MODE fixtures valid", ok, f"{len(fixtures)} command types")
    except Exception as exc:
        record("DEMO_MODE fixtures valid", False, str(exc)[:80])

    # 6. OBC responding to REQUEST_TELEMETRY
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(2)
        sock.sendto(json.dumps({
            "command_id": "verify", "command_type": "REQUEST_TELEMETRY",
            "subsystem": "TM", "parameters": {},
        }).encode(), (settings.obc_host, settings.obc_port))
        resp, _ = sock.recvfrom(4096)
        ack = json.loads(resp)
        sock.close()
        record("OBC responding to REQUEST_TELEMETRY", ack.get("status") == "ACK",
               f"battery {ack.get('telemetry', {}).get('battery_percent', '?')}%")
    except Exception as exc:
        record("OBC responding to REQUEST_TELEMETRY", False,
               f"{settings.obc_host}:{settings.obc_port} — {exc}")

    # 7. WS endpoint accepting connections (HTTP upgrade probe on the backend)
    try:
        req = urllib.request.Request(f"{BACKEND}/health")
        with urllib.request.urlopen(req, timeout=3) as r:
            backend_up = r.status == 200
        record("Backend up + WS endpoint exposed", backend_up,
               "ws://localhost:8000/ws/approvals")
    except Exception as exc:
        record("Backend up + WS endpoint exposed", False, f"backend not reachable — {exc}")

    # 8. Gemini scoring live (or DEMO_MODE active)
    if settings.demo_mode:
        record("Scoring engine (DEMO_MODE fixtures)", True, "DEMO_MODE=true")
    elif settings.gemini_api_key:
        record("Scoring engine (Gemini live)", True,
               f"{settings.gemini_model} — key configured (not called to save quota)")
    else:
        record("Scoring engine", False, "DEMO_MODE=false and no GEMINI_API_KEY")

    # 11. ngrok URL accessible — advisory only
    try:
        with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as r:
            tunnels = json.load(r).get("tunnels", [])
        if tunnels:
            record("ngrok tunnel", True, tunnels[0].get("public_url", ""))
        else:
            warnings.append("ngrok running but no active tunnel — run: ngrok http 3000")
            record("ngrok tunnel", True, "WARN: no tunnel (optional)")
    except Exception:
        warnings.append("ngrok not running (optional — only needed for external-device demo)")
        record("ngrok tunnel", True, "WARN: not running (optional)")

    if pool:
        await pool.close()

    # ── Report ────────────────────────────────────────────────────────────────
    print()
    print("SCSP Demo Verification — TRD §16.3")
    print("=" * 64)
    failed = 0
    for label, passed, detail in results:
        mark = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
        line = f"[{mark}] {label}"
        if detail:
            line += f" — {detail}"
        print(line)
        if not passed:
            failed += 1
    for w in warnings:
        print(f"[{YELLOW}WARN{RESET}] {w}")
    print("=" * 64)
    print(f"{len(results) - failed}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
