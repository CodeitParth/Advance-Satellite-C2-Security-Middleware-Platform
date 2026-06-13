"""Compute behavioral baselines for all operators from seeded history. Phase 2 F-10."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.drift_detector import compute_all_baselines
from scripts._seed_common import create_seed_pool


async def main():
    pool = await create_seed_pool()
    try:
        results = await compute_all_baselines(pool)
        for username, computed in results.items():
            print(f"  {'+' if computed else '='} {username}: {'baseline computed' if computed else 'too few sessions — skipped'}")
        print(f"compute_baselines: {sum(results.values())}/{len(results)} operators")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
