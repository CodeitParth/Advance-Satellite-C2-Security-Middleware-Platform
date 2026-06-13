"""Health and readiness probes — no auth required, used by load balancers / k8s."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

_start_time = datetime.now(timezone.utc)


@router.get("/health")
async def health():
    """Liveness probe — returns 200 if the process is alive."""
    return {
        "status": "ok",
        "uptime_seconds": (datetime.now(timezone.utc) - _start_time).total_seconds(),
        "env": settings.app_env,
        "demo_mode": settings.demo_mode,
    }


@router.get("/ready")
async def ready():
    """Readiness probe — returns 200 only if the DB pool is up."""
    try:
        from app.database import get_pool
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ready"}
    except Exception as exc:
        logger.warning("Readiness check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "database unavailable"},
        )
