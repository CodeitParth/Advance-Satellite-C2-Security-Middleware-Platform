"""WebSocket router: WS /ws/approvals?token=<jwt>."""
import asyncio
import logging
from collections import defaultdict
from fastapi import APIRouter, Query, WebSocket
from jose import ExpiredSignatureError, JWTError

from app.config import settings
from app.services.auth_service import decode_token
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

_HEARTBEAT_INTERVAL = 30  # seconds

# Per-IP active WebSocket connection counter
_ip_connection_count: defaultdict[str, int] = defaultdict(int)


@router.websocket("/ws/approvals")
async def ws_approvals(
    ws: WebSocket,
    token: str = Query(default=""),
) -> None:
    # Validate token BEFORE accept() — on failure close with 4001 without upgrading.
    try:
        payload = decode_token(token, require_type="access")
    except Exception:
        # Must accept then close — RFC 6455 requires the server to complete the
        # handshake before sending a close frame; 4001 = "Unauthorized"
        await ws.accept()
        await ws.close(code=4001, reason="Invalid or expired token")
        return

    # Per-IP connection limit — prevents a single client from exhausting file descriptors
    client_ip = ws.client.host if ws.client else "unknown"
    if _ip_connection_count[client_ip] >= settings.ws_max_connections_per_ip:
        await ws.accept()
        await ws.close(code=4008, reason="Too many connections from this IP")
        logger.warning("WS connection rejected — too many from ip=%s", client_ip)
        return

    role = payload.role.lower()
    _ip_connection_count[client_ip] += 1
    await ws_manager.connect(ws, role)
    logger.info("WS connected — role=%s ip=%s", role, client_ip)

    async def _heartbeat() -> None:
        while True:
            await asyncio.sleep(_HEARTBEAT_INTERVAL)
            # Mid-session token expiry check — close cleanly if the JWT has expired
            try:
                decode_token(token, require_type="access")
            except ExpiredSignatureError:
                logger.info("WS token expired mid-session — closing role=%s ip=%s", role, client_ip)
                try:
                    await ws.close(code=4001, reason="Token expired")
                except Exception as exc:  # nosec B110
                    logger.debug("WS close error after token expiry: %s", exc)
                return
            except (JWTError, Exception) as exc:
                logger.warning("WS heartbeat token decode error — role=%s: %s", role, exc)

            try:
                await ws.send_json({"type": "PING"})
            except Exception:
                return  # Connection dead — exit heartbeat loop

    hb_task = asyncio.create_task(_heartbeat(), name=f"ws-heartbeat-{role}-{client_ip}")
    try:
        while True:
            data = await ws.receive_json()
            if isinstance(data, dict) and data.get("type") == "PING":
                await ws.send_json({"type": "PONG"})
    except Exception:  # nosec B110
        logger.debug("WS receive loop ended — role=%s ip=%s", role, client_ip)
    finally:
        hb_task.cancel()
        ws_manager.disconnect(ws, role)
        _ip_connection_count[client_ip] = max(0, _ip_connection_count[client_ip] - 1)
        logger.info("WS disconnected — role=%s ip=%s", role, client_ip)
