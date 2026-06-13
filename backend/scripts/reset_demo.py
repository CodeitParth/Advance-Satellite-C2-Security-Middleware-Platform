"""Truncate all demo data and re-seed from scratch. T-032

TRUNCATE ... RESTART IDENTITY resets the ledger BIGSERIAL so the tamper
target lands back at sequence 42 on every reset.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts._seed_common import create_seed_pool
from scripts.seed_demo import main as seed_all


async def truncate():
    pool = await create_seed_pool()
    try:
        await pool.execute(
            "TRUNCATE approvals, ledger, commands, telemetry_states, operators RESTART IDENTITY CASCADE"
        )
        print("reset_demo: all tables truncated")
    finally:
        await pool.close()


async def main():
    await truncate()
    await seed_all()


if __name__ == "__main__":
    asyncio.run(main())
