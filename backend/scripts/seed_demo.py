"""Run all seed scripts in order: operators → telemetry → history → scenarios. T-032"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.drift_detector import compute_all_baselines
from scripts._seed_common import create_seed_pool
from scripts.seed_operators import seed_operators
from scripts.seed_telemetry import seed_telemetry
from scripts.seed_history import seed_history
from scripts.seed_scenarios import seed_scenarios


async def main():
    pool = await create_seed_pool()
    try:
        print("── seed_operators ──")
        await seed_operators(pool)
        print("── seed_telemetry ──")
        await seed_telemetry(pool)
        print("── seed_history ──")
        await seed_history(pool)
        print("── seed_scenarios ──")
        await seed_scenarios(pool)
        print("── compute_baselines (Phase 2 F-10) ──")
        results = await compute_all_baselines(pool)
        print(f"  baselines: {sum(results.values())}/{len(results)} operators")
        print("seed_demo: complete ✔")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
