"""In-memory telemetry state singleton with async lock and fire-and-forget DB persist."""
import asyncio
import logging
from datetime import datetime, timezone

from app.models.telemetry import TelemetryState
from app.utils.tasks import spawn

logger = logging.getLogger(__name__)


async def _persist_snapshot(state: TelemetryState) -> None:
    """Write telemetry snapshot to DB. Runs as a background task via spawn().
    Failures are logged (not silently swallowed) but never block the update path.
    """
    try:
        from app.database import get_pool
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO telemetry_states "
                "(satellite_id, battery_percent, safe_mode_active, "
                " thermal_status, orbital_phase, link_margin_db, "
                " last_contact_min, recorded_at) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
                state.satellite_id,
                state.battery_percent,
                state.safe_mode_active,
                state.thermal_status.value,
                state.orbital_phase.value,
                state.link_margin_db,
                state.last_contact_min,
            )
    except Exception as exc:
        # Logged by spawn()'s done-callback — raise so the caller sees it
        raise RuntimeError(f"Telemetry persist failed: {exc}") from exc


class TelemetryService:
    """Async singleton holding current satellite telemetry state.

    asyncio.Lock is created at class-definition time (safe in Python 3.10+).
    """

    _state: TelemetryState = TelemetryState()
    _lock: asyncio.Lock = asyncio.Lock()

    @classmethod
    async def get_current(cls) -> TelemetryState:
        return cls._state

    @classmethod
    async def update(cls, updates: dict) -> TelemetryState:
        async with cls._lock:
            new_state = cls._state.model_copy(
                update={**updates, "updated_at": datetime.now(timezone.utc).isoformat()}
            )
            cls._state = new_state
        # spawn() keeps a strong reference so GC cannot collect the task mid-flight;
        # failures are logged by the done-callback in utils/tasks.py
        spawn(_persist_snapshot(cls._state), name="telemetry-persist")
        return cls._state
