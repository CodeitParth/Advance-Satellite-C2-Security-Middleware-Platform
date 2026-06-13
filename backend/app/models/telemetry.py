"""Telemetry state Pydantic models."""
from pydantic import BaseModel
from enum import Enum


class ThermalStatus(str, Enum):
    NOMINAL  = "NOMINAL"
    ELEVATED = "ELEVATED"
    CRITICAL = "CRITICAL"


class OrbitalPhase(str, Enum):
    SUNLIT   = "SUNLIT"
    ECLIPSE  = "ECLIPSE"
    PENUMBRA = "PENUMBRA"


class TelemetryState(BaseModel):
    satellite_id: str          = "SAT_ALPHA"
    battery_percent: float     = 78.0
    safe_mode_active: bool     = False
    thermal_status: ThermalStatus  = ThermalStatus.NOMINAL
    orbital_phase: OrbitalPhase    = OrbitalPhase.SUNLIT
    link_margin_db: float      = 12.5
    last_contact_min: int      = 0
    updated_at: str            = ""


class TelemetryUpdate(BaseModel):
    """Partial update — all fields optional."""
    battery_percent: float | None     = None
    safe_mode_active: bool | None     = None
    thermal_status: ThermalStatus | None  = None
    orbital_phase: OrbitalPhase | None    = None
    link_margin_db: float | None      = None
    last_contact_min: int | None      = None
