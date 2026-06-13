"""Constellation-level threat correlation — Phase 2 F-11 (TRD §18.2).

Hybrid event bus:
- When REDIS_URL is configured, HIGH-risk events are published to the Redis
  pub/sub channel ``scsp:constellation:alerts`` and events from peer SCSP
  instances are consumed from the same channel (one instance per satellite).
- Without Redis, an in-process simulator stands in for the peers: SAT_BRAVO
  and SAT_CHARLIE emit occasional HIGH-risk events so the cross-satellite
  elevation behavior is demonstrable with zero extra infrastructure.

Effect of a peer HIGH event: the local instance raises its minimum approval
tier for ``elevation_window_minutes`` — LOW commands lose auto-approve and
MEDIUM commands require dual approval.
"""
import asyncio
import json
import logging
import random
from collections import deque
from datetime import datetime, timedelta, timezone

from app.config import settings

logger = logging.getLogger(__name__)

CHANNEL = "scsp:constellation:alerts"
CONSTELLATION = ["SAT_ALPHA", "SAT_BRAVO", "SAT_CHARLIE"]
LOCAL_SATELLITE = settings.satellite_id
PEER_SATELLITES = [s for s in CONSTELLATION if s != LOCAL_SATELLITE] or ["SAT_BRAVO", "SAT_CHARLIE"]

_PEER_EVENT_COMMANDS = [
    ("DISABLE_SAFE_MODE", 87),
    ("THRUSTER_FIRE", 90),
    ("DISABLE_WATCHDOG", 91),
    ("RESET_OBC", 78),
    ("UPDATE_AUTH_KEY", 74),
]


_PEER_INIT_TELEMETRY: dict[str, dict] = {
    "SAT_BRAVO": {
        "satellite_id": "SAT_BRAVO",
        "battery_percent": 85.0,
        "safe_mode_active": False,
        "thermal_status": "NOMINAL",
        "orbital_phase": "SUNLIT",
        "altitude_km": 551.4,
    },
    "SAT_CHARLIE": {
        "satellite_id": "SAT_CHARLIE",
        "battery_percent": 72.0,
        "safe_mode_active": True,
        "thermal_status": "ELEVATED",
        "orbital_phase": "ECLIPSE",
        "altitude_km": 543.8,
    },
}


class ConstellationHub:
    """Singleton coordinating cross-satellite alert state."""

    def __init__(self) -> None:
        self.alerts: deque[dict] = deque(maxlen=50)
        self.elevated_until: datetime | None = None
        self.elevation_source: str | None = None
        self.peer_last_seen: dict[str, datetime] = {}
        self._redis = None
        self._tasks: list[asyncio.Task] = []
        # Simulated peer telemetry — evolves as peer events arrive
        self._peer_telemetry: dict[str, dict] = {
            k: dict(v) for k, v in _PEER_INIT_TELEMETRY.items()
        }

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self) -> None:
        if not settings.constellation_enabled:
            logger.info("Constellation correlation disabled")
            return
        if settings.redis_url:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
                await self._redis.ping()
                self._tasks.append(asyncio.create_task(self._redis_listener(), name="constellation-redis"))
                logger.info("Constellation bus: Redis pub/sub on %s", CHANNEL)
                return
            except Exception as exc:
                logger.warning("Redis unavailable (%s) — falling back to in-process simulator", exc)
                self._redis = None
        self._tasks.append(asyncio.create_task(self._peer_simulator(), name="constellation-sim"))
        logger.info("Constellation bus: in-process peer simulator (SAT_BRAVO, SAT_CHARLIE)")

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        self._tasks.clear()
        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None

    # ── State ─────────────────────────────────────────────────────────────────

    def elevation_active(self) -> bool:
        return self.elevated_until is not None and datetime.now(timezone.utc) < self.elevated_until

    def status(self) -> dict:
        now = datetime.now(timezone.utc)
        active = self.elevation_active() and self.elevated_until is not None
        return {
            "local_satellite": LOCAL_SATELLITE,
            "bus": "redis" if self._redis else "simulated",
            "elevation_active": self.elevation_active(),
            "elevated_until": self.elevated_until.isoformat() if active else None,
            "elevation_source": self.elevation_source if self.elevation_active() else None,
            "peers": [
                {
                    "satellite_id": peer,
                    "last_event_at": self.peer_last_seen[peer].isoformat() if peer in self.peer_last_seen else None,
                    "online": True,
                    **{k: v for k, v in self._peer_telemetry.get(peer, {}).items()
                       if k in ("battery_percent", "safe_mode_active", "thermal_status", "orbital_phase", "altitude_km")},
                }
                for peer in PEER_SATELLITES
            ],
            "alerts": list(self.alerts),
            "generated_at": now.isoformat(),
        }

    def get_peer_telemetry(self) -> list[dict]:
        """Return current simulated telemetry for all peer satellites."""
        return list(self._peer_telemetry.values())

    # ── Publishing (local HIGH-risk events) ───────────────────────────────────

    async def publish_local_high_risk(self, command_type: str, risk_score: int) -> None:
        """Called by the command pipeline when a local command scores HIGH."""
        event = {
            "source_satellite": LOCAL_SATELLITE,
            "event_type": "HIGH_RISK_COMMAND_DETECTED",
            "command_type": command_type,
            "risk_score": risk_score,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "elevation_window_minutes": settings.constellation_elevation_minutes,
        }
        self.alerts.appendleft(event)
        if self._redis:
            try:
                await self._redis.publish(CHANNEL, json.dumps(event))
            except Exception as exc:
                logger.error("Constellation publish failed: %s", exc)
        await self._ws_broadcast(event)

    # ── Event ingestion (peer events) ─────────────────────────────────────────

    async def _handle_peer_event(self, event: dict) -> None:
        source = event.get("source_satellite", "")
        if source == LOCAL_SATELLITE or not source:
            return
        window = int(event.get("elevation_window_minutes", settings.constellation_elevation_minutes))
        self.elevated_until = datetime.now(timezone.utc) + timedelta(minutes=window)
        self.elevation_source = source
        self.peer_last_seen[source] = datetime.now(timezone.utc)
        self.alerts.appendleft(event)

        # Simulate the effect on peer telemetry so the UI shows changing state
        if source in self._peer_telemetry:
            cmd = event.get("command_type", "")
            peer = self._peer_telemetry[source]
            import random as _rng
            if cmd == "THRUSTER_FIRE":
                peer["battery_percent"] = max(0, peer["battery_percent"] - 8)
                peer["thermal_status"] = "ELEVATED"
            elif cmd == "DISABLE_SAFE_MODE":
                peer["safe_mode_active"] = False
            elif cmd == "ENABLE_SAFE_MODE":
                peer["safe_mode_active"] = True
            # Drift orbital phase periodically
            phases = ["SUNLIT", "PENUMBRA", "ECLIPSE", "SUNLIT", "SUNLIT"]
            peer["orbital_phase"] = _rng.choice(phases)
        logger.warning(
            "CONSTELLATION ALERT — %s reported %s (score %s) — approval tiers elevated for %d min",
            source, event.get("command_type"), event.get("risk_score"), window,
        )
        await self._ws_broadcast(event)

    async def _ws_broadcast(self, event: dict) -> None:
        try:
            from app.services.ws_manager import ws_manager
            await ws_manager.broadcast_approver({
                "type": "CONSTELLATION_ALERT",
                **event,
                "elevation_active": self.elevation_active(),
            })
        except Exception as exc:
            logger.debug("Constellation WS broadcast failed: %s", exc)

    # ── Bus backends ──────────────────────────────────────────────────────────

    async def _redis_listener(self) -> None:
        assert self._redis is not None
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            try:
                await self._handle_peer_event(json.loads(message["data"]))
            except Exception as exc:
                logger.error("Bad constellation event: %s", exc)

    async def _peer_simulator(self) -> None:
        """Simulated peers: a HIGH-risk event from BRAVO/CHARLIE every 3–6 min."""
        rng = random.Random()
        # First simulated event arrives quickly so demos see the behavior
        await asyncio.sleep(rng.uniform(45, 90))
        while True:
            cmd, score = rng.choice(_PEER_EVENT_COMMANDS)
            await self._handle_peer_event({
                "source_satellite": rng.choice(PEER_SATELLITES),
                "event_type": "HIGH_RISK_COMMAND_DETECTED",
                "command_type": cmd,
                "risk_score": score + rng.randint(-3, 3),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "elevation_window_minutes": settings.constellation_elevation_minutes,
            })
            await asyncio.sleep(rng.uniform(180, 360))


constellation_hub = ConstellationHub()


def apply_constellation_elevation(status_value: str) -> str:
    """Tighten the initial command status while a constellation alert is active:
    AUTO_APPROVED → PENDING_SINGLE_APPROVAL, SINGLE → DUAL. Override unaffected."""
    if not constellation_hub.elevation_active():
        return status_value
    if status_value == "AUTO_APPROVED":
        return "PENDING_SINGLE_APPROVAL"
    if status_value == "PENDING_SINGLE_APPROVAL":
        return "PENDING_DUAL_APPROVAL"
    return status_value
