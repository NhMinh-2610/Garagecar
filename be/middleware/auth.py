from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from typing import Callable

from core.security import decode_token
from core.constants import Role

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency: extract and validate the JWT Bearer token.
    Attaches the decoded payload (id, email, role, fullName) to the request.
    """
    try:
        payload = decode_token(credentials.credentials)
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(*roles: Role) -> Callable:
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/admin-only")
        async def admin_route(user=Depends(require_role(Role.ADMIN))):
            ...
    """
    async def _checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập chức năng này",
            )
        return current_user

    return _checker
