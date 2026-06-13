"""Telemetry router: GET /current, PUT /update."""
from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import get_current_operator, require_role
from app.models.operator import Role, TokenPayload
from app.models.telemetry import OrbitalPhase, ThermalStatus, TelemetryUpdate
from app.services.telemetry_service import TelemetryService

router = APIRouter()


@router.get("/current")
async def get_current_telemetry(
    _: TokenPayload = Depends(get_current_operator),
):
    state = await TelemetryService.get_current()
    return state.model_dump()


@router.put("/update")
async def update_telemetry(
    body: TelemetryUpdate,
    _: TokenPayload = Depends(require_role(Role.ADMIN)),
):
    updates = body.model_dump(exclude_none=True)
    # Coerce string values to enum types (model_copy doesn't validate)
    if "thermal_status" in updates and isinstance(updates["thermal_status"], str):
        updates["thermal_status"] = ThermalStatus(updates["thermal_status"])
    if "orbital_phase" in updates and isinstance(updates["orbital_phase"], str):
        updates["orbital_phase"] = OrbitalPhase(updates["orbital_phase"])
    new_state = await TelemetryService.update(updates)
    return new_state.model_dump()
