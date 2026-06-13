"""Seed 30 days of command history + hash-chained ledger entries. T-032

- 50 commands per operator (status split 45 DISPATCHED / 3 REJECTED / 2 BLOCKED)
- Timestamps distributed across the past 30 days within each operator's session hours
- Every command gets COMMAND_SUBMITTED + terminal ledger events, appended in
  chronological order with backdated timestamps while preserving the SHA-256 chain
- Ledger sequence 42 is forced to be the demo tamper target:
  DISABLE_SAFE_MODE / DISPATCHED / risk_score 87 / op_chen
"""
import asyncio
import json
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.ledger_service import GENESIS_HASH, _build_payload, _compute_hash
from scripts._seed_common import (
    SCORE_BY_TYPE,
    SUBSYSTEM_BY_TYPE,
    create_seed_pool,
    load_fixtures,
    load_spec,
    tier_for_score,
)

rng = random.Random(20260611)  # deterministic seeding

TAMPER_SEQUENCE = 42


def pick_weighted(weights: dict[str, float]) -> str:
    types = list(weights.keys())
    return rng.choices(types, weights=[weights[t] for t in types], k=1)[0]


def session_timestamp(days_back: int, start_h: int, end_h: int) -> datetime:
    """Random moment within the operator's session hours on a random past day."""
    day = rng.randint(1, days_back)
    span = (end_h - start_h) % 24 or 8
    minute_offset = rng.randint(0, span * 60 - 1)
    base = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return (base - timedelta(days=day)).replace(hour=start_h % 24) + timedelta(minutes=minute_offset)


async def append_backdated(conn, prev_hash: str, *, command_id, event_type,
                           event_detail, operator_id, approver_ids, ts) -> str:
    """Single-writer chain append with an explicit (backdated) timestamp.
    Hash math is identical to ledger_service so verify_chain passes."""
    payload = _build_payload(command_id, event_type, event_detail, operator_id, approver_ids)
    entry_hash = _compute_hash(prev_hash, payload, ts.isoformat())
    await conn.execute(
        """
        INSERT INTO ledger
          (prev_hash, entry_hash, command_id, event_type, event_detail,
           operator_id, approver_ids, timestamp)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
        """,
        prev_hash, entry_hash, command_id, event_type,
        json.dumps(event_detail), operator_id, approver_ids, ts,
    )
    return entry_hash


async def seed_history(pool) -> tuple[int, int]:
    spec = load_spec()
    fixtures = load_fixtures()
    cfg = spec["history_config"]
    nominal = spec["telemetry_snapshots"]["nominal"]

    operators = {
        r["username"]: r["id"]
        for r in await pool.fetch("SELECT id, username FROM operators")
    }
    approver_ids = [operators[u] for u in ("so_kim", "so_okonkwo") if u in operators]

    existing = await pool.fetchval("SELECT COUNT(*) FROM ledger")
    if existing and existing > 0:
        print(f"  ! ledger already has {existing} entries — skipping history seed (run reset_demo.py for a clean slate)")
        return 0, 0

    # ── 1. Generate command records ───────────────────────────────────────────
    commands: list[dict] = []
    for op in spec["operators"]:
        if not op["command_type_weights"]:
            continue
        statuses = (
            ["DISPATCHED"] * cfg["status_distribution"]["DISPATCHED"]
            + ["REJECTED"] * cfg["status_distribution"]["REJECTED"]
            + ["BLOCKED"] * cfg["status_distribution"]["BLOCKED"]
        )
        rng.shuffle(statuses)
        for status in statuses[: cfg["commands_per_operator"]]:
            cmd_type = pick_weighted(op["command_type_weights"])
            score = SCORE_BY_TYPE.get(cmd_type, 55)
            fixture = fixtures.get(cmd_type, {})
            submitted = session_timestamp(cfg["days_back"], op["session_hour_start"], op["session_hour_end"])
            commands.append({
                "id": uuid.uuid4(),
                "nonce": str(uuid.uuid4()),
                "apid": str(rng.randint(256, 1023)),
                "command_type": cmd_type,
                "subsystem": SUBSYSTEM_BY_TYPE.get(cmd_type, "OBC"),
                "sequence_count": rng.randint(1, 16383),
                "risk_score": score,
                "risk_tier": tier_for_score(score),
                "justification": fixture.get("justification", f"{cmd_type} routine operation within nominal parameters."),
                "sparta": fixture.get("sparta_technique"),
                "cvss": fixture.get("cvss_estimate"),
                "affected": fixture.get("affected_subsystems", [SUBSYSTEM_BY_TYPE.get(cmd_type, "OBC")]),
                "status": status,
                "submitter_username": op["username"],
                "submitter_id": operators[op["username"]],
                "submitted_at": submitted,
                "resolved_at": submitted + timedelta(seconds=rng.randint(20, 280)),
            })

    # Dedicated tamper-target command (becomes ledger sequence 42)
    tamper_cfg = spec["demo_scenarios"]["ledger_tamper"]
    tamper_cmd = {
        "id": uuid.uuid4(),
        "nonce": str(uuid.uuid4()),
        "apid": "398",
        "command_type": tamper_cfg["command_type"],
        "subsystem": "EPS",
        "sequence_count": rng.randint(1, 16383),
        "risk_score": tamper_cfg["original_risk_score"],
        "risk_tier": tier_for_score(tamper_cfg["original_risk_score"]),
        "justification": fixtures["DISABLE_SAFE_MODE"]["justification"],
        "sparta": fixtures["DISABLE_SAFE_MODE"]["sparta_technique"],
        "cvss": fixtures["DISABLE_SAFE_MODE"]["cvss_estimate"],
        "affected": fixtures["DISABLE_SAFE_MODE"]["affected_subsystems"],
        "status": tamper_cfg["status"],
        "submitter_username": tamper_cfg["submitter_username"],
        "submitter_id": operators[tamper_cfg["submitter_username"]],
        "submitted_at": datetime.now(timezone.utc) - timedelta(days=14),
        "resolved_at": datetime.now(timezone.utc) - timedelta(days=14) + timedelta(seconds=95),
    }
    commands.append(tamper_cmd)

    # ── 2. Insert command rows ────────────────────────────────────────────────
    async with pool.acquire() as conn:
        async with conn.transaction():
            for c in commands:
                await conn.execute(
                    """
                    INSERT INTO commands
                      (id, nonce, ccsds_apid, command_type, subsystem, parameters,
                       sequence_count, risk_score, risk_tier, ai_justification,
                       sparta_technique, cvss_estimate, affected_subsystems,
                       telemetry_snapshot, status, submitter_id, submitted_at,
                       scored_at, dispatched_at, demo_mode)
                    VALUES ($1,$2,$3,$4,$5,'{}',$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,TRUE)
                    """,
                    c["id"], c["nonce"], c["apid"], c["command_type"], c["subsystem"],
                    c["sequence_count"], c["risk_score"], c["risk_tier"], c["justification"],
                    c["sparta"], c["cvss"], c["affected"], json.dumps(nominal),
                    c["status"], c["submitter_id"], c["submitted_at"],
                    c["submitted_at"] + timedelta(seconds=3),
                    c["resolved_at"] if c["status"] == "DISPATCHED" else None,
                )

            # ── 3. Build chronological ledger events ──────────────────────────
            TERMINAL_EVENT = {
                "DISPATCHED": "COMMAND_DISPATCHED",
                "REJECTED": "COMMAND_REJECTED",
                "BLOCKED": "COMMAND_BLOCKED_TIMEOUT",
            }
            events: list[dict] = []
            for c in commands:
                if c is tamper_cmd:
                    continue  # injected manually at sequence 42
                base_detail = {
                    "command_type": c["command_type"],
                    "risk_score": c["risk_score"],
                    "risk_tier": c["risk_tier"],
                    "username": c["submitter_username"],
                }
                events.append({
                    "ts": c["submitted_at"], "command_id": c["id"],
                    "event_type": "COMMAND_SUBMITTED",
                    "detail": {**base_detail, "nonce": c["nonce"]},
                    "operator_id": c["submitter_id"], "approvers": [],
                })
                approvers = (
                    [rng.choice(approver_ids)]
                    if c["status"] in ("DISPATCHED", "REJECTED") and c["risk_tier"] != "LOW" and approver_ids
                    else []
                )
                events.append({
                    "ts": c["resolved_at"], "command_id": c["id"],
                    "event_type": TERMINAL_EVENT[c["status"]],
                    "detail": {**base_detail, "status": c["status"]},
                    "operator_id": c["submitter_id"], "approvers": approvers,
                })

            events.sort(key=lambda e: e["ts"])

            # Inject the tamper target as the 42nd entry
            tamper_event = {
                "ts": events[TAMPER_SEQUENCE - 2]["ts"] + timedelta(seconds=1),
                "command_id": tamper_cmd["id"],
                "event_type": "COMMAND_DISPATCHED",
                "detail": {
                    "command_type": tamper_cmd["command_type"],
                    "risk_score": tamper_cmd["risk_score"],
                    "risk_tier": tamper_cmd["risk_tier"],
                    "username": tamper_cmd["submitter_username"],
                    "status": "DISPATCHED",
                },
                "operator_id": tamper_cmd["submitter_id"],
                "approvers": approver_ids[:2],
            }
            events.insert(TAMPER_SEQUENCE - 1, tamper_event)

            # ── 4. Append the chain ───────────────────────────────────────────
            prev_hash = GENESIS_HASH
            for e in events:
                prev_hash = await append_backdated(
                    conn, prev_hash,
                    command_id=e["command_id"], event_type=e["event_type"],
                    event_detail=e["detail"], operator_id=e["operator_id"],
                    approver_ids=e["approvers"], ts=e["ts"],
                )

    seq42 = await pool.fetchrow("SELECT event_type, event_detail FROM ledger WHERE sequence = $1", TAMPER_SEQUENCE)
    detail42 = json.loads(seq42["event_detail"]) if seq42 else {}
    print(f"  + {len(commands)} commands, {len(events)} ledger entries")
    print(f"  + sequence 42 check: {seq42['event_type'] if seq42 else 'MISSING'} risk_score={detail42.get('risk_score')}")
    return len(commands), len(events)


async def main():
    pool = await create_seed_pool()
    try:
        n_cmd, n_led = await seed_history(pool)
        print(f"seed_history: {n_cmd} commands, {n_led} ledger entries")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
