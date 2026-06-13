"""Constellation router — cross-satellite threat status. Phase 2 F-11."""
from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import get_current_operator
from app.models.operator import TokenPayload
from app.services.constellation import constellation_hub

router = APIRouter()


@router.get("/status")
async def constellation_status(
    _: TokenPayload = Depends(get_current_operator),
):
    """Current constellation state: peers, recent alerts, elevation window."""
    return constellation_hub.status()
