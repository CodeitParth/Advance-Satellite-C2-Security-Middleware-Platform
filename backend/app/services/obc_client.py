"""UDP client for dispatching approved commands to the mock OBC satellite simulator."""
import asyncio
import json
import logging
import socket
from datetime import datetime, timezone
from uuid import UUID

from app.config import settings
from app.models.telemetry import OrbitalPhase, ThermalStatus
from app.services.telemetry_service import TelemetryService

logger = logging.getLogger(__name__)

_TELEMETRY_FIELDS = frozenset({
    "battery_percent", "safe_mode_active", "thermal_status", "orbital_phase", "link_margin_db"
})


def _send_udp(payload: bytes) -> dict | None:
    """Synchronous UDP send/receive — runs in a thread via asyncio.to_thread.
    Returns None on timeout or socket error.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(settings.obc_timeout_ms / 1000)
    try:
        sock.sendto(payload, (settings.obc_host, settings.obc_port))
        data, _ = sock.recvfrom(4096)
        return json.loads(data)
    except socket.timeout:
        return None
    except Exception as exc:
        logger.warning("OBC UDP error: %s", exc)
        return None
    finally:
        sock.close()


async def _update_dispatched_at(command_id: UUID, db_pool) -> None:
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE commands SET dispatched_at = NOW() WHERE id = $1",
            command_id,
        )


async def dispatch_to_obc(parsed_command, command_id: UUID, db_pool) -> dict:
    """Send an approved command to the mock OBC via UDP.

    On ACK  : syncs TelemetryService from OBC response, marks dispatched_at.
    On NACK : logs the error, returns the NACK payload (status stays DISPATCHED
              so ops can investigate — a follow-up revert is a manual action).
    On timeout: logs warning, returns {"status": "TIMEOUT", ...}.
    Never raises.
    """
    if not settings.obc_enabled:
        logger.info("OBC disabled — skipping dispatch for command_id=%s", command_id)
        return {"status": "OBC_DISABLED", "command_id": str(command_id)}

    payload = json.dumps({
        "command_id":   str(command_id),
        "command_type": parsed_command.command_type,
        "subsystem":    parsed_command.subsystem,
        "parameters":   parsed_command.parameters,
    }).encode("utf-8")

    result = await asyncio.to_thread(_send_udp, payload)

    if result is None:
        logger.warning(
            "OBC dispatch TIMEOUT — command_id=%s command_type=%s",
            command_id, parsed_command.command_type,
        )
        return {"status": "TIMEOUT", "command_id": str(command_id)}

    obc_status = result.get("status")

    if obc_status == "ACK" and "telemetry" in result:
        obc_tel = result["telemetry"]
        update = {k: v for k, v in obc_tel.items() if k in _TELEMETRY_FIELDS}
        if "thermal_status" in update:
            update["thermal_status"] = ThermalStatus(update["thermal_status"])
        if "orbital_phase" in update:
            update["orbital_phase"] = OrbitalPhase(update["orbital_phase"])
        await TelemetryService.update(update)
        await _update_dispatched_at(command_id, db_pool)
        logger.info(
            "OBC ACK — command_id=%s command_type=%s",
            command_id, parsed_command.command_type,
        )
    elif obc_status == "NACK":
        logger.error(
            "OBC NACK — command_id=%s command_type=%s error=%s",
            command_id, parsed_command.command_type, result.get("error"),
        )
    else:
        logger.warning(
            "OBC unexpected response — command_id=%s status=%s",
            command_id, obc_status,
        )

    return result


async def _poll_once() -> bool:
    """Send REQUEST_TELEMETRY to OBC and sync TelemetryService. Returns True on ACK."""
    payload = json.dumps({
        "command_id": f"poll-{datetime.now(timezone.utc).strftime('%H%M%S%f')}",
        "command_type": "REQUEST_TELEMETRY",
        "subsystem": "TM",
        "parameters": {},
    }).encode("utf-8")

    result = await asyncio.to_thread(_send_udp, payload)
    if result is None:
        return False

    if result.get("status") == "ACK" and "telemetry" in result:
        obc_tel = result["telemetry"]
        update = {k: v for k, v in obc_tel.items() if k in _TELEMETRY_FIELDS}
        if "thermal_status" in update:
            update["thermal_status"] = ThermalStatus(update["thermal_status"])
        if "orbital_phase" in update:
            update["orbital_phase"] = OrbitalPhase(update["orbital_phase"])
        await TelemetryService.update(update)
        return True

    return False


async def start_obc_poller(interval_s: float = 5.0) -> None:
    """Background task: keep TelemetryService in sync with the live OBC state."""
    if not settings.obc_enabled:
        logger.info("OBC disabled — telemetry poller not started")
        return
    logger.info("OBC telemetry poller started (interval=%ss)", interval_s)
    # Sync immediately on startup so the frontend never shows stale defaults
    try:
        synced = await _poll_once()
        if synced:
            logger.info("OBC initial telemetry sync complete")
        else:
            logger.warning("OBC initial telemetry sync failed — will retry on next poll")
    except Exception as exc:
        logger.warning("OBC initial telemetry sync error: %s", exc)
    while True:
        await asyncio.sleep(interval_s)
        try:
            await _poll_once()
        except Exception as exc:
            logger.warning("OBC telemetry poll error: %s", exc)
