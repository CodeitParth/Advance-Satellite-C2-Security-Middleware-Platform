"""Shared pytest fixtures: scsp_test DB, TestClient with lifespan, state resets. T-034

Environment is pinned BEFORE app.config is imported: tests always run against
the scsp_test database with DEMO_MODE=true (no Gemini calls), OBC disabled,
and the constellation simulator off so background tasks don't mutate state.
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# Derive TEST_DATABASE_URL from DATABASE_URL unless explicitly provided (TRD §16.4)
_test_url = os.environ.get("TEST_DATABASE_URL") or os.environ["DATABASE_URL"].replace(
    "/scsp_db", "/scsp_test"
)
os.environ.update({
    "DATABASE_URL": _test_url,
    "DEMO_MODE": "true",
    "APP_ENV": "development",
    "OBC_ENABLED": "false",
    "CONSTELLATION_ENABLED": "false",
    "C2_PROXY_API_KEY": "test-c2-proxy-key",
    "JWT_SECRET_KEY": os.environ.get("JWT_SECRET_KEY", "test-secret-key-0123456789abcdef-pad"),
    "RATE_LIMIT_GLOBAL_PER_MINUTE": "100000",
    "RATE_LIMIT_COMMANDS_PER_MINUTE": "100000",
    "RATE_LIMIT_LOGIN_PER_MINUTE": "100000",
    "MFA_ENABLED": "false",
})

import pytest
from fastapi.testclient import TestClient

OPERATORS = {
    "op_chen":     ("operator123", "operator"),
    "op_martinez": ("operator123", "operator"),
    "so_kim":      ("approver123", "approver"),
    "so_okonkwo":  ("approver123", "approver"),
    "admin_root":  ("admin123",    "admin"),
    "c2_gateway":  ("c2gateway123!", "operator"),  # service account for C2 proxy tests
}


def run_async(coro):
    """Run a coroutine on a private event loop (asyncpg conns are loop-bound)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _direct_execute(*statements: str) -> None:
    """Execute statements over a fresh direct connection to scsp_test."""
    import asyncpg
    from app.database import _build_ssl_context, _normalize_dsn

    conn = await asyncpg.connect(dsn=_normalize_dsn(_test_url), ssl=_build_ssl_context())
    try:
        for stmt in statements:
            await conn.execute(stmt)
    finally:
        await conn.close()


async def _prepare_database() -> None:
    """Apply migration + seed test operators into scsp_test (idempotent)."""
    import asyncpg
    from app.database import _build_ssl_context, _normalize_dsn
    from app.services.auth_service import hash_password

    conn = await asyncpg.connect(dsn=_normalize_dsn(_test_url), ssl=_build_ssl_context())
    try:
        sql = (Path(__file__).parent.parent / "migrations" / "001_initial_schema.sql").read_text()
        await conn.execute(sql)
        await conn.execute("TRUNCATE approvals, ledger, commands RESTART IDENTITY CASCADE")
        for username, (password, role) in OPERATORS.items():
            await conn.execute(
                """
                INSERT INTO operators (username, password_hash, role, full_name)
                VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING
                """,
                username, hash_password(password), role, username,
            )
    finally:
        await conn.close()


@pytest.fixture(scope="session")
def client():
    """TestClient with lifespan — boots the app pool against scsp_test."""
    run_async(_prepare_database())
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def tokens(client) -> dict[str, str]:
    """One JWT per seeded operator — logged in once per session."""
    out = {}
    for username, (password, _) in OPERATORS.items():
        resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
        assert resp.status_code == 200, f"login failed for {username}: {resp.text}"
        out[username] = resp.json()["access_token"]
    return out


def auth(tokens: dict[str, str], username: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens[username]}"}


@pytest.fixture(autouse=True)
def clean_state():
    """Per-test reset of in-process singletons; DB truncation after each test
    that touched the app (detected via the live pool)."""
    from app.middleware.rate_limiter import _buckets
    from app.services.override_service import _override
    from app.services.replay_detector import ReplayDetector

    ReplayDetector._nonce_window.clear()
    ReplayDetector._sequence_window.clear()
    _override.active = False
    _override.expires_at = None
    for bucket in _buckets.values():
        bucket.clear()

    yield

    from app.database import _pool
    if _pool is not None:
        # TRUNCATE bypasses the ledger's append-only rules by design — test DB only.
        run_async(_direct_execute(
            "TRUNCATE approvals, ledger, commands RESTART IDENTITY CASCADE"
        ))
