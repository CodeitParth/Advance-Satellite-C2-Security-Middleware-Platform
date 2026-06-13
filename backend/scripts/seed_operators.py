"""Seed the 6 operators from SEED_DATA_SPEC.json. Idempotent. T-032"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.auth_service import hash_password
from scripts._seed_common import create_seed_pool, load_spec

# Fixed UUIDs per username — must never change after first demo deployment.
# JWTs encode the operator UUID as `sub`; if the UUID changes on re-seed the
# old token causes a FK violation on the commands table (submitter_id_fkey).
FIXED_IDS: dict[str, str] = {
    "op_chen":     "a0000001-0000-4000-8000-000000000001",
    "op_martinez": "a0000002-0000-4000-8000-000000000002",
    "op_patel":    "a0000003-0000-4000-8000-000000000003",
    "so_kim":      "a0000004-0000-4000-8000-000000000004",
    "so_okonkwo":  "a0000005-0000-4000-8000-000000000005",
    "admin_root":  "a0000006-0000-4000-8000-000000000006",
    "c2_gateway":  "a0000007-0000-4000-8000-000000000007",
}


async def seed_operators(pool) -> int:
    spec = load_spec()
    inserted = 0

    import secrets
    operators = [*spec["operators"], {
        "username": "c2_gateway",
        "password": secrets.token_urlsafe(32),
        "role": "operator",
        "full_name": "C2 Gateway Service",
    }]

    for op in operators:
        fixed_id = FIXED_IDS.get(op["username"])
        # Always supply the fixed id — PostgreSQL only uses it when the row is
        # new (after TRUNCATE); ON CONFLICT DO NOTHING leaves existing rows
        # (and their FK-referenced UUIDs) untouched.
        if fixed_id:
            result = await pool.execute(
                """
                INSERT INTO operators (id, username, password_hash, role, full_name)
                VALUES ($1::uuid, $2, $3, $4, $5)
                ON CONFLICT (username) DO NOTHING
                """,
                fixed_id,
                op["username"],
                hash_password(op["password"]),
                op["role"],
                op["full_name"],
            )
        else:
            result = await pool.execute(
                """
                INSERT INTO operators (username, password_hash, role, full_name)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (username) DO NOTHING
                """,
                op["username"],
                hash_password(op["password"]),
                op["role"],
                op["full_name"],
            )
        if result.endswith("1"):
            inserted += 1
            print(f"  + {op['username']} ({op['role']}) → {fixed_id or 'random-uuid'}")
        else:
            print(f"  = {op['username']} already exists")
    return inserted


async def main():
    pool = await create_seed_pool()
    try:
        n = await seed_operators(pool)
        print(f"seed_operators: {n} inserted")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
