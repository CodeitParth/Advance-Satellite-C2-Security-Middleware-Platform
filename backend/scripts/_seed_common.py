"""Shared helpers for seed scripts: DB connection, spec loading, score map. T-032"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg

from app.config import settings
from app.database import _build_ssl_context, _normalize_dsn

SPEC_PATH = Path(__file__).parent.parent.parent / "docs" / "SEED_DATA_SPEC.json"
FIXTURES_PATH = Path(__file__).parent.parent / "fixtures" / "demo_scores.json"


def load_spec() -> dict:
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def load_fixtures() -> dict:
    return json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))


async def create_seed_pool() -> asyncpg.Pool:
    """Small pool for seeding — ledger_service.append() requires a pool."""
    ssl_ctx = _build_ssl_context()
    dsn = _normalize_dsn(settings.database_url)
    return await asyncpg.create_pool(dsn=dsn, ssl=ssl_ctx, min_size=1, max_size=4)


# Deterministic per-type scores for history seeding (DEMO_MODE-consistent:
# matches fixtures where they exist; risk tier is derived from thresholds).
SCORE_BY_TYPE: dict[str, int] = {
    "REQUEST_TELEMETRY":  5,
    "REQUEST_STATUS":     8,
    "ENABLE_SAFE_MODE":   10,
    "SET_BEACON_RATE":    24,
    "PAYLOAD_ACTIVATE":   34,
    "SCHEDULE_MANOEUVRE": 46,
    "RESET_SUBSYSTEM":    50,
    "UPDATE_PARAMETER":   55,
    "ATTITUDE_MANOEUVRE": 58,
    "RESET_OBC":          76,
    "DISABLE_SAFE_MODE":  87,
    "THRUSTER_FIRE":      90,
    "DISABLE_WATCHDOG":   91,
    "FORCE_REBOOT":       84,
    "UPDATE_AUTH_KEY":    72,
}

SUBSYSTEM_BY_TYPE: dict[str, str] = {
    "REQUEST_TELEMETRY": "TM", "SET_BEACON_RATE": "TM", "REQUEST_STATUS": "OBC",
    "UPDATE_PARAMETER": "OBC", "RESET_SUBSYSTEM": "OBC", "UPDATE_AUTH_KEY": "OBC",
    "RESET_OBC": "OBC", "DISABLE_WATCHDOG": "OBC", "FORCE_REBOOT": "OBC",
    "ENABLE_SAFE_MODE": "EPS", "DISABLE_SAFE_MODE": "EPS",
    "SCHEDULE_MANOEUVRE": "ADCS", "ATTITUDE_MANOEUVRE": "ADCS", "THRUSTER_FIRE": "ADCS",
    "PAYLOAD_ACTIVATE": "PAYLOAD",
}


def tier_for_score(score: int) -> str:
    if score <= settings.risk_low_max:
        return "LOW"
    if score <= settings.risk_medium_max:
        return "MEDIUM"
    return "HIGH"
