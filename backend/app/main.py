"""FastAPI application factory, lifespan, middleware stack, and router registration."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import close_pool, create_pool
from app.middleware.error_handler import register_error_handlers
from app.middleware.rate_limiter import RateLimitMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import admin, auth, c2_proxy, commands, constellation, ledger, override, reports, simulate, telemetry, websocket
from app.routers import health
from app.services.auth_chain import check_pending_timeouts
from app.services.constellation import constellation_hub
from app.services.telemetry_service import TelemetryService
from app.utils.logging_utils import setup_logging

logger = logging.getLogger(__name__)

_pending_timeout_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _pending_timeout_task

    log_fmt = settings.log_format or ("json" if settings.app_env == "production" else "text")
    setup_logging(settings.log_level, log_fmt)

    await create_pool()
    await TelemetryService.get_current()
    _pending_timeout_task = asyncio.create_task(
        check_pending_timeouts(), name="pending-timeout-handler"
    )
    await constellation_hub.start()
    logger.info(
        "SCSP backend started — env=%s demo_mode=%s host=%s port=%d",
        settings.app_env, settings.demo_mode, settings.app_host, settings.app_port,
    )

    yield

    if _pending_timeout_task and not _pending_timeout_task.done():
        _pending_timeout_task.cancel()
        try:
            await asyncio.wait_for(_pending_timeout_task, timeout=5.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass
    await constellation_hub.stop()
    await close_pool()
    logger.info("SCSP backend stopped")


# ── App factory ───────────────────────────────────────────────────────────────

# Hide interactive docs in production to reduce attack surface
_docs_url = "/docs" if settings.app_env != "production" else None
_redoc_url = "/redoc" if settings.app_env != "production" else None

app = FastAPI(
    title="Satellite Command Security Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

# ── Middleware stack ──────────────────────────────────────────────────────────
# RequestContextMiddleware: assigns per-request ID for correlation logging
# SecurityHeadersMiddleware: adds defensive headers (X-Frame-Options etc.)
# CORSMiddleware: must run after security headers, before route handlers
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)

register_error_handlers(app)

# ── Routers ───────────────────────────────────────────────────────────────────
# /health and /ready at root — no /api/v1 prefix (k8s liveness/readiness convention)
app.include_router(health.router,    tags=["health"])

app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["auth"])
app.include_router(commands.router,  prefix="/api/v1/commands",  tags=["commands"])
app.include_router(telemetry.router, prefix="/api/v1/telemetry", tags=["telemetry"])
app.include_router(ledger.router,    prefix="/api/v1/ledger",    tags=["ledger"])
app.include_router(override.router,  prefix="/api/v1/override",  tags=["override"])
app.include_router(admin.router,     prefix="/api/v1/admin",     tags=["admin"])
app.include_router(reports.router,   prefix="/api/v1/admin/reports", tags=["reports"])
app.include_router(constellation.router, prefix="/api/v1/constellation", tags=["constellation"])
app.include_router(simulate.router,    prefix="/api/v1/simulate",   tags=["simulate"])
app.include_router(c2_proxy.router,    prefix="/api/v1/c2",         tags=["c2-proxy"])
app.include_router(websocket.router, tags=["websocket"])
