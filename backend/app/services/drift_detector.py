"""Behavioral drift detection — Phase 2 F-10 (TRD §18.1).

Per-operator baselines are computed from historical command sessions (a session
= one calendar day with at least one command) and stored in
operators.baseline_profile (JSONB). At submit time the current session is
compared against the baseline with Z-scores; any |Z| > DRIFT_Z_THRESHOLD raises
a non-blocking BEHAVIORAL_DRIFT alert that adds +10 to the AI risk score.
"""
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

DRIFT_Z_THRESHOLD = 2.5
DRIFT_SCORE_ELEVATION = 10


class OperatorBaseline(BaseModel):
    operator_id: str
    mean_commands_per_session: float
    std_commands_per_session: float
    subsystem_distribution: dict[str, float]   # {"EPS": 0.3, "TM": 0.5, ...}
    typical_hour_start: int                     # 0–23 (UTC)
    typical_hour_window: int                    # ± hours
    mean_session_duration_min: float
    std_session_duration_min: float
    sessions_observed: int
    computed_at: str


# ── Baseline computation ──────────────────────────────────────────────────────

async def compute_baseline(operator_id: UUID, pool) -> OperatorBaseline | None:
    """Aggregate the operator's history into a baseline. Returns None when
    fewer than settings.drift_min_sessions sessions exist (too sparse)."""
    sessions = await pool.fetch(
        """
        SELECT
            DATE(submitted_at)                                         AS day,
            COUNT(*)                                                   AS cmd_count,
            EXTRACT(EPOCH FROM (MAX(submitted_at) - MIN(submitted_at))) / 60 AS duration_min,
            MIN(EXTRACT(HOUR FROM submitted_at))                       AS start_hour,
            MAX(EXTRACT(HOUR FROM submitted_at))                       AS end_hour
        FROM commands
        WHERE submitter_id = $1
        GROUP BY DATE(submitted_at)
        ORDER BY day
        """,
        operator_id,
    )
    if len(sessions) < settings.drift_min_sessions:
        return None

    counts = [int(s["cmd_count"]) for s in sessions]
    durations = [float(s["duration_min"] or 0) for s in sessions]
    start_hours = [int(s["start_hour"]) for s in sessions]
    end_hours = [int(s["end_hour"]) for s in sessions]

    def mean(xs: list[float]) -> float:
        return sum(xs) / len(xs)

    def std(xs: list[float]) -> float:
        m = mean(xs)
        return (sum((x - m) ** 2 for x in xs) / len(xs)) ** 0.5

    sub_rows = await pool.fetch(
        """
        SELECT subsystem, COUNT(*) AS cnt
        FROM commands WHERE submitter_id = $1
        GROUP BY subsystem
        """,
        operator_id,
    )
    total = sum(int(r["cnt"]) for r in sub_rows) or 1
    subsystem_distribution = {r["subsystem"]: round(int(r["cnt"]) / total, 4) for r in sub_rows}

    typical_start = round(mean([float(h) for h in start_hours]))
    # window: half the typical session hour span, at least ±2h
    typical_window = max(2, round((mean([float(h) for h in end_hours]) - typical_start) / 2) + 1)

    baseline = OperatorBaseline(
        operator_id=str(operator_id),
        mean_commands_per_session=round(mean([float(c) for c in counts]), 2),
        std_commands_per_session=round(max(std([float(c) for c in counts]), 0.5), 2),
        subsystem_distribution=subsystem_distribution,
        typical_hour_start=typical_start % 24,
        typical_hour_window=typical_window,
        mean_session_duration_min=round(mean(durations), 2),
        std_session_duration_min=round(max(std(durations), 1.0), 2),
        sessions_observed=len(sessions),
        computed_at=datetime.now(timezone.utc).isoformat(),
    )

    await pool.execute(
        "UPDATE operators SET baseline_profile = $1::jsonb WHERE id = $2",
        baseline.model_dump_json(), operator_id,
    )
    return baseline


async def compute_all_baselines(pool) -> dict[str, bool]:
    """Compute baselines for every active operator. Returns {username: computed}."""
    rows = await pool.fetch("SELECT id, username FROM operators WHERE is_active = TRUE")
    results: dict[str, bool] = {}
    for r in rows:
        baseline = await compute_baseline(r["id"], pool)
        results[r["username"]] = baseline is not None
        if baseline:
            logger.info(
                "Baseline computed — operator=%s sessions=%d mean_cmds=%.1f",
                r["username"], baseline.sessions_observed, baseline.mean_commands_per_session,
            )
    return results


# ── Drift assessment (called per command submit) ──────────────────────────────

async def check_drift(
    operator_id: str,
    session_command_count: int,
    session_duration_min: int,
    pool,
) -> dict | None:
    """Compare the live session against the stored baseline.

    Returns a sequence-alert-shaped dict ({rule_id, trigger_command,
    score_elevation}) when any Z-score exceeds the threshold, else None.
    Never raises — drift detection must not break command submission.
    """
    try:
        raw = await pool.fetchval(
            "SELECT baseline_profile FROM operators WHERE id = $1", UUID(operator_id)
        )
        if not raw:
            return None
        profile = json.loads(raw) if isinstance(raw, str) else raw
        if not profile or "mean_commands_per_session" not in profile:
            return None
        baseline = OperatorBaseline(**profile)

        z_scores: dict[str, float] = {}

        z_scores["commands_per_session"] = (
            (session_command_count - baseline.mean_commands_per_session)
            / baseline.std_commands_per_session
        )
        z_scores["session_duration_min"] = (
            (session_duration_min - baseline.mean_session_duration_min)
            / baseline.std_session_duration_min
        )
        # Hour-of-day drift: distance outside the typical window, scaled so that
        # being right at the window edge ≈ Z of 1
        hour_now = datetime.now(timezone.utc).hour
        hour_dist = min(
            abs(hour_now - baseline.typical_hour_start),
            24 - abs(hour_now - baseline.typical_hour_start),
        )
        z_scores["session_hour"] = hour_dist / max(baseline.typical_hour_window, 1)

        worst_metric, worst_z = max(z_scores.items(), key=lambda kv: abs(kv[1]))
        if abs(worst_z) <= DRIFT_Z_THRESHOLD:
            return None

        logger.warning(
            "BEHAVIORAL_DRIFT — operator=%s metric=%s z=%.2f (threshold %.1f)",
            operator_id, worst_metric, worst_z, DRIFT_Z_THRESHOLD,
        )
        return {
            "rule_id": "BEHAVIORAL_DRIFT",
            "trigger_command": f"{worst_metric} z={worst_z:+.1f}",
            "score_elevation": DRIFT_SCORE_ELEVATION,
        }
    except Exception as exc:
        logger.error("Drift check failed for operator=%s: %s", operator_id, exc)
        return None
