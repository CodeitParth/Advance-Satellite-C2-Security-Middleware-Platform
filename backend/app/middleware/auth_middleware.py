"""FastAPI JWT dependency and require_role factory."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.operator import Role, TokenPayload
from app.services.auth_service import decode_token
from app.utils.errors import error_dict

_bearer = HTTPBearer(auto_error=False)


async def get_current_operator(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> TokenPayload:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict("TOKEN_INVALID", "Authorization header missing"),
            headers={"WWW-Authenticate": "Bearer"},
        )
    # require_type="access" prevents approval/override tokens from authenticating routes
    return decode_token(credentials.credentials, require_type="access")


def require_role(*roles: Role):
    """Dependency factory — raises 403 if operator's role is not in the allowed list."""
    async def _check(operator: TokenPayload = Depends(get_current_operator)) -> TokenPayload:
        if operator.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_dict(
                    "INSUFFICIENT_ROLE",
                    f"Requires one of: {[r.value for r in roles]}",
                ),
            )
        return operator
    return _check
