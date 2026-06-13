"""Apply all SQL migrations in backend/migrations/ in filename order (idempotent)."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import _normalize_dsn, _build_ssl_context
from app.config import settings


async def run():
    import asyncpg
    migrations_dir = Path(__file__).parent.parent / "migrations"

    ssl_ctx = _build_ssl_context()
    dsn = _normalize_dsn(settings.database_url)
    if ssl_ctx is not None:
        conn = await asyncpg.connect(dsn=dsn, ssl=ssl_ctx)
    else:
        conn = await asyncpg.connect(dsn=dsn)
    try:
        for sql_path in sorted(migrations_dir.glob("*.sql")):
            await conn.execute(sql_path.read_text())
            print(f"Migration {sql_path.name} applied.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
