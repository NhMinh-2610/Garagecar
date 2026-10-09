from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import Role
from core.permissions import permissions
from core.security import decode_token
from database.session import get_db
from models.user import User

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    FastAPI dependency: extract and validate the JWT Bearer token.
    Attaches the decoded payload (id, email, role, fullName) to the request.
    """
    try:
        payload = decode_token(credentials.credentials)
        user = await db.get(User, payload.get("id"))
        if (
            user is None
            or not user.isActive
            or payload.get("version", 0) != user.sessionVersion
        ):
            raise JWTError("Account no longer exists")
        return {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "fullName": user.fullName,
            "permissions": permissions(user.role, user.disabledPermissions),
        }
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

    async def _checker(
        request: Request, current_user: dict = Depends(get_current_user)
    ) -> dict:
        if current_user.get("role") not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập chức năng này",
            )
        domains = {
            "vehicles": "reception",
            "bookings": "reception",
            "inventory": "catalog",
            "settings": "catalog",
            "reports": "reports",
            "mechanics": "hr",
            "ai": "workshop",
        }
        path = request.url.path.split("/")
        domain = domains.get(path[2]) if len(path) > 2 else None
        if len(path) > 2 and path[2] == "repairs":
            domain = "finance" if current_user["role"] == "accountant" else "workshop"
        if (
            len(path) > 2
            and path[2] == "repairs"
            and (
                (request.method == "GET" and len(path) == 3)
                or (request.method == "PUT" and len(path) == 4)
            )
            and current_user["role"] == "admin"
            and "workshop" not in current_user["permissions"]
        ):
            domain = "finance"
        if (
            len(path) > 2
            and path[2] in ("inventory", "mechanics")
            and request.method == "GET"
            and current_user["role"] in ("advisor", "mechanic")
        ):
            domain = "workshop"
        if (
            len(path) > 3
            and path[2] == "auth"
            and path[3] in ("users", "register-staff")
        ):
            domain = "accounts"
        if (
            current_user["role"] != "customer"
            and domain
            and domain not in current_user["permissions"]
        ):
            raise HTTPException(403, "Chức năng đã bị khóa cho tài khoản này")
        return current_user

    return _checker


def require_permission(permission):
    async def checker(user: dict = Depends(get_current_user)):
        if permission not in user["permissions"]:
            raise HTTPException(403, "Bạn không có quyền hoặc chức năng đã bị khóa")
        return user

    return checker
