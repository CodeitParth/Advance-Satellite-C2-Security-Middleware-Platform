"""asyncpg connection pool: create, close, retry on startup, FastAPI dependency."""
import asyncio
import logging
import ssl

import asyncpg

from app.config import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


def _build_ssl_context() -> ssl.SSLContext | None:
    """SSL context for Aiven/cloud DBs that require sslmode=require."""
    if "sslmode=require" not in settings.database_url:
        return None
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    # NOTE: CERT_NONE skips peer-certificate validation.
    # Acceptable for Aiven free-tier dev; must be replaced with a real CA bundle
    # (ctx.load_verify_locations / CERT_REQUIRED) before production hardening.
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _normalize_dsn(url: str) -> str:
    """asyncpg requires postgresql:// scheme; strip sslmode query param."""
    url = url.replace("postgres://", "postgresql://", 1)
    return url.split("?")[0]


async def create_pool() -> None:
    """Create the asyncpg connection pool with exponential-backoff retry.

    Retries up to settings.database_startup_retry_max times so the server
    survives a momentarily-unavailable DB (container startup race, Aiven cold start).
    """
    global _pool
    ssl_ctx = _build_ssl_context()
    dsn = _normalize_dsn(settings.database_url)

    for attempt in range(1, settings.database_startup_retry_max + 1):
        try:
            if ssl_ctx is not None:
                _pool = await asyncpg.create_pool(
                    dsn=dsn,
                    min_size=settings.database_pool_min,
                    max_size=settings.database_pool_max,
                    command_timeout=settings.database_pool_timeout,
                    max_inactive_connection_lifetime=settings.database_pool_max_inactive_lifetime,
                    ssl=ssl_ctx,
                )
            else:
                _pool = await asyncpg.create_pool(
                    dsn=dsn,
                    min_size=settings.database_pool_min,
                    max_size=settings.database_pool_max,
                    command_timeout=settings.database_pool_timeout,
                    max_inactive_connection_lifetime=settings.database_pool_max_inactive_lifetime,
                )
            logger.info("DB pool created (attempt %d/%d)", attempt, settings.database_startup_retry_max)
            return
        except Exception as exc:
            if attempt == settings.database_startup_retry_max:
                logger.critical("DB pool failed after %d attempts: %s", attempt, exc)
                raise
            delay = settings.database_startup_retry_delay * (2 ** (attempt - 1))
            logger.warning("DB connect failed (attempt %d/%d), retrying in %.1fs: %s",
                           attempt, settings.database_startup_retry_max, delay, exc)
            await asyncio.sleep(delay)


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("DB pool closed")


def get_pool() -> asyncpg.Pool:
    """Synchronous pool accessor for service helpers that run inside a request."""
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call create_pool() first")
    return _pool


async def get_db() -> asyncpg.Pool:
    """FastAPI dependency — Depends(get_db) in route functions."""
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call create_pool() first")
    return _pool
