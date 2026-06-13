"""Command effect simulation — lightweight dry-run (no DB write, no AI call, no approval flow).

POST /simulate/effects   → project satellite state change from a command
GET  /simulate/satellites → telemetry for all three constellation satellites
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth_middleware import get_current_operator
from app.models.operator import TokenPayload
from app.models.telemetry import OrbitalPhase, TelemetryState, ThermalStatus

router = APIRouter()


# ── Effect table ──────────────────────────────────────────────────────────────

class CommandEffect(BaseModel):
    battery_delta: float = 0.0
    safe_mode: bool | None = None
    orbit_altitude_delta_km: float = 0.0
    animation: str = "generic"
    duration_ms: int = 800
    subsystems_affected: list[str] = []
    payload_deployed: bool = False
    thermal_impact: str = "NONE"   # NONE | RISE | DROP


_EFFECTS: dict[str, CommandEffect] = {
    "THRUSTER_FIRE": CommandEffect(
        battery_delta=-8.0,
        orbit_altitude_delta_km=5.0,
        animation="thruster_burst",
        duration_ms=3500,
        subsystems_affected=["PROPULSION", "POWER"],
        thermal_impact="RISE",
    ),
    "ATTITUDE_MANOEUVRE": CommandEffect(
        battery_delta=-1.5,
        animation="attitude_change",
        duration_ms=2200,
        subsystems_affected=["ADCS", "POWER"],
    ),
    "DISABLE_SAFE_MODE": CommandEffect(
        safe_mode=False,
        animation="mode_change",
        duration_ms=600,
        subsystems_affected=["OBC"],
    ),
    "ENABLE_SAFE_MODE": CommandEffect(
        safe_mode=True,
        animation="mode_change",
        duration_ms=600,
        subsystems_affected=["OBC"],
    ),
    "RESET_OBC": CommandEffect(
        battery_delta=-0.5,
        animation="system_reset",
        duration_ms=4200,
        subsystems_affected=["OBC"],
    ),
    "DEPLOY_PAYLOAD": CommandEffect(
        battery_delta=-2.0,
        payload_deployed=True,
        animation="payload_separation",
        duration_ms=8000,
        subsystems_affected=["PAYLOAD", "POWER"],
    ),
    "DISABLE_WATCHDOG": CommandEffect(
        animation="mode_change",
        duration_ms=400,
        subsystems_affected=["OBC"],
    ),
    "UPDATE_AUTH_KEY": CommandEffect(
        battery_delta=-0.1,
        animation="parameter_change",
        duration_ms=900,
        subsystems_affected=["COMMS", "CRYPTO"],
    ),
    "UPDATE_PARAMETER": CommandEffect(
        animation="parameter_change",
        duration_ms=300,
        subsystems_affected=["OBC"],
    ),
    "REQUEST_TELEMETRY": CommandEffect(
        animation="telemetry_pulse",
        duration_ms=150,
        subsystems_affected=[],
    ),
    "ENABLE_BEACON": CommandEffect(
        battery_delta=-0.2,
        animation="beacon_enable",
        duration_ms=350,
        subsystems_affected=["COMMS"],
    ),
    "DISABLE_BEACON": CommandEffect(
        animation="beacon_disable",
        duration_ms=350,
        subsystems_affected=["COMMS"],
    ),
}

_DEFAULT_EFFECT = CommandEffect(animation="generic", duration_ms=500)


# ── Request / Response models ─────────────────────────────────────────────────

class SimulateEffectsRequest(BaseModel):
    command_type: str
    parameters: dict = {}
    current_telemetry: TelemetryState | None = None


class ProjectedState(BaseModel):
    battery_percent: float
    safe_mode_active: bool
    thermal_status: str
    orbital_phase: str
    orbit_altitude_delta_km: float = 0.0
    payload_deployed: bool = False


class SimulateEffectsResponse(BaseModel):
    command_type: str
    effect: CommandEffect
    current_state: ProjectedState
    projected_state: ProjectedState
    warnings: list[str]


class SatelliteSimState(BaseModel):
    satellite_id: str
    battery_percent: float
    safe_mode_active: bool
    thermal_status: str
    orbital_phase: str
    altitude_km: float
    is_local: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/effects", response_model=SimulateEffectsResponse)
async def simulate_effects(
    body: SimulateEffectsRequest,
    _: TokenPayload = Depends(get_current_operator),
):
    """Project satellite state after a command without persisting or scoring."""
    effect = _EFFECTS.get(body.command_type, _DEFAULT_EFFECT)
    telem = body.current_telemetry or TelemetryState()

    thermal_str = telem.thermal_status.value if isinstance(telem.thermal_status, ThermalStatus) else str(telem.thermal_status)
    orbital_str = telem.orbital_phase.value if isinstance(telem.orbital_phase, OrbitalPhase) else str(telem.orbital_phase)

    current = ProjectedState(
        battery_percent=telem.battery_percent,
        safe_mode_active=telem.safe_mode_active,
        thermal_status=thermal_str,
        orbital_phase=orbital_str,
    )

    proj_battery = max(0.0, min(100.0, telem.battery_percent + effect.battery_delta))
    proj_safe_mode = effect.safe_mode if effect.safe_mode is not None else telem.safe_mode_active

    # Thermal: THRUSTER raises, RESET_OBC raises briefly
    proj_thermal = thermal_str
    if effect.thermal_impact == "RISE" and thermal_str == "NOMINAL":
        proj_thermal = "ELEVATED"
    elif effect.thermal_impact == "DROP" and thermal_str == "ELEVATED":
        proj_thermal = "NOMINAL"

    projected = ProjectedState(
        battery_percent=proj_battery,
        safe_mode_active=proj_safe_mode,
        thermal_status=proj_thermal,
        orbital_phase=orbital_str,
        orbit_altitude_delta_km=effect.orbit_altitude_delta_km,
        payload_deployed=effect.payload_deployed,
    )

    warnings: list[str] = []
    if proj_battery < 15 and effect.battery_delta < 0:
        warnings.append(f"SR-001: Battery will drop to {proj_battery:.0f}% — DISABLE_SAFE_MODE prohibited below 15%")
    if body.command_type == "THRUSTER_FIRE" and orbital_str == "PENUMBRA":
        warnings.append("SR-005: Thruster fire during PENUMBRA requires dual approval")
    if body.command_type == "ATTITUDE_MANOEUVRE" and orbital_str == "ECLIPSE":
        warnings.append("SR-002: Attitude manoeuvre during ECLIPSE requires dual approval")
    if body.command_type in ("RESET_OBC", "DISABLE_WATCHDOG"):
        warnings.append("SR-003: This command always requires safety officer approval")

    return SimulateEffectsResponse(
        command_type=body.command_type,
        effect=effect,
        current_state=current,
        projected_state=projected,
        warnings=warnings,
    )


@router.get("/satellites", response_model=list[SatelliteSimState])
async def get_satellite_states(
    _: TokenPayload = Depends(get_current_operator),
):
    """Return telemetry-level state for all three constellation satellites."""
    from app.services.telemetry_service import TelemetryService
    from app.services.constellation import constellation_hub

    local = await TelemetryService.get_current()
    peers = constellation_hub.get_peer_telemetry()

    result: list[SatelliteSimState] = [
        SatelliteSimState(
            satellite_id=local.satellite_id,
            battery_percent=local.battery_percent,
            safe_mode_active=local.safe_mode_active,
            thermal_status=local.thermal_status.value if isinstance(local.thermal_status, ThermalStatus) else str(local.thermal_status),
            orbital_phase=local.orbital_phase.value if isinstance(local.orbital_phase, OrbitalPhase) else str(local.orbital_phase),
            altitude_km=547.21,
            is_local=True,
        )
    ]

    for peer in peers:
        result.append(SatelliteSimState(
            satellite_id=peer["satellite_id"],
            battery_percent=peer.get("battery_percent", 80.0),
            safe_mode_active=peer.get("safe_mode_active", False),
            thermal_status=peer.get("thermal_status", "NOMINAL"),
            orbital_phase=peer.get("orbital_phase", "SUNLIT"),
            altitude_km=peer.get("altitude_km", 547.21),
            is_local=False,
        ))

    return result
