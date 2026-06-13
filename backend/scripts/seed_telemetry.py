"""Seed the 4 canonical telemetry snapshots from SEED_DATA_SPEC.json. T-032

Inserts all snapshots into telemetry_states; "nominal" is inserted last so it
is the most recent row. The in-memory TelemetryService starts from its model
defaults on backend boot (nominal-equivalent), so no live sync is required here.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts._seed_common import create_seed_pool, load_spec

# nominal goes last → newest recorded_at
SNAPSHOT_ORDER = ["optimal", "stress_state", "low_power_eclipse", "nominal"]


async def seed_telemetry(pool) -> int:
    spec = load_spec()
    snaps = spec["telemetry_snapshots"]
    count = 0
    for name in SNAPSHOT_ORDER:
        s = snaps[name]
        await pool.execute(
            """
            INSERT INTO telemetry_states
              (satellite_id, battery_percent, safe_mode_active, thermal_status,
               orbital_phase, link_margin_db, last_contact_min)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            s["satellite_id"], s["battery_percent"], s["safe_mode_active"],
            s["thermal_status"], s["orbital_phase"], s["link_margin_db"],
            s["last_contact_min"],
        )
        count += 1
        print(f"  + snapshot '{name}' (battery {s['battery_percent']}%)")
    return count


async def main():
    pool = await create_seed_pool()
    try:
        n = await seed_telemetry(pool)
        print(f"seed_telemetry: {n} snapshots inserted")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
