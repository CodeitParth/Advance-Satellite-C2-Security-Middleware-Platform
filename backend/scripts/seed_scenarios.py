"""Seed demo warm-up scenarios. T-032

- One DISABLE_SAFE_MODE command in PENDING_DUAL_APPROVAL (0 approvals),
  submitted 2 minutes ago by op_chen with the low_power_eclipse snapshot —
  ready for an approver to decide on arrival.
- One DISPATCHED ATTITUDE_MANOEUVRE 8 minutes ago carrying the fixed replay
  nonce; resubmitting that nonce live triggers REPLAY_DETECTED.

Appends ledger entries via ledger_service so the chain stays valid on top of
the history seed.
"""
import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.ledger_service import append as ledger_append
from scripts._seed_common import create_seed_pool, load_fixtures, load_spec, tier_for_score


async def seed_scenarios(pool) -> None:
    spec = load_spec()
    fixtures = load_fixtures()
    scen = spec["demo_scenarios"]
    operators = {
        r["username"]: r["id"]
        for r in await pool.fetch("SELECT id, username FROM operators")
    }
    now = datetime.now(timezone.utc)

    # ── 1. Pending warm-up command ────────────────────────────────────────────
    warm = scen["pending_command_for_warmup"]
    existing = await pool.fetchval(
        "SELECT COUNT(*) FROM commands WHERE status = 'PENDING_DUAL_APPROVAL'"
    )
    if existing and existing > 0:
        print("  = pending warm-up command already exists — skipping")
    else:
        cmd_id = uuid.uuid4()
        submitted = now - timedelta(minutes=warm["submitted_minutes_ago"])
        snapshot = spec["telemetry_snapshots"][warm["telemetry_snapshot"]]
        await pool.execute(
            """
            INSERT INTO commands
              (id, nonce, ccsds_apid, command_type, subsystem, parameters,
               sequence_count, risk_score, risk_tier, ai_justification,
               sparta_technique, cvss_estimate, affected_subsystems,
               telemetry_snapshot, status, submitter_id, submitted_at, scored_at, demo_mode)
            VALUES ($1,$2,$3,$4,$5,'{}',$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,TRUE)
            """,
            cmd_id, str(uuid.uuid4()), str(warm["apid"]), warm["command_type"],
            warm["subsystem"], 731, warm["risk_score"], warm["risk_tier"],
            warm["ai_justification"], warm["sparta_technique"], warm["cvss_estimate"],
            warm["affected_subsystems"], json.dumps(snapshot), warm["status"],
            operators[warm["submitter_username"]], submitted, submitted + timedelta(seconds=3),
        )
        await ledger_append(
            command_id=cmd_id,
            event_type="COMMAND_SUBMITTED",
            event_detail={
                "command_type": warm["command_type"],
                "risk_score": warm["risk_score"],
                "risk_tier": warm["risk_tier"],
                "username": warm["submitter_username"],
                "status": warm["status"],
            },
            operator_id=operators[warm["submitter_username"]],
            approver_ids=[],
            db_pool=pool,
        )
        print(f"  + warm-up: {warm['command_type']} PENDING_DUAL_APPROVAL (risk {warm['risk_score']})")

    # ── 2. Replay-attack precursor ────────────────────────────────────────────
    replay = scen["replay_attack"]
    nonce = replay["nonce"]
    exists = await pool.fetchval("SELECT COUNT(*) FROM commands WHERE nonce = $1", nonce)
    if exists and exists > 0:
        print("  = replay precursor already exists — skipping")
    else:
        cmd_id = uuid.uuid4()
        submitted = now - timedelta(minutes=replay["first_submitted_minutes_ago"])
        score = 58
        op_id = operators["op_martinez"]
        await pool.execute(
            """
            INSERT INTO commands
              (id, nonce, ccsds_apid, command_type, subsystem, parameters,
               sequence_count, risk_score, risk_tier, ai_justification,
               affected_subsystems, telemetry_snapshot, status, submitter_id,
               submitted_at, scored_at, dispatched_at, demo_mode)
            VALUES ($1,$2,$3,$4,$5,'{}',$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,TRUE)
            """,
            cmd_id, nonce, "770", replay["command_type"], replay["subsystem"],
            882, score, tier_for_score(score),
            fixtures.get("UPDATE_PARAMETER", {}).get("justification", "Attitude adjustment within envelope."),
            ["ADCS"], json.dumps(spec["telemetry_snapshots"]["nominal"]),
            replay["first_status"], op_id,
            submitted, submitted + timedelta(seconds=3), submitted + timedelta(seconds=64),
        )
        for event_type in ("COMMAND_SUBMITTED", "COMMAND_DISPATCHED"):
            await ledger_append(
                command_id=cmd_id,
                event_type=event_type,
                event_detail={
                    "command_type": replay["command_type"],
                    "risk_score": score,
                    "risk_tier": tier_for_score(score),
                    "username": "op_martinez",
                    "nonce": nonce,
                },
                operator_id=op_id,
                approver_ids=[],
                db_pool=pool,
            )
        print(f"  + replay precursor: {replay['command_type']} DISPATCHED with nonce '{nonce}'")
        print("    → live demo: submit any command reusing that nonce twice in-session to trigger REPLAY_DETECTED")


async def main():
    pool = await create_seed_pool()
    try:
        await seed_scenarios(pool)
        print("seed_scenarios: done")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
