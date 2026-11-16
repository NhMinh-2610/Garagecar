from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import ROLE_VALUES, Role
from core.permissions import permissions
from core.security import decode_token
from database.session import get_db
from models.user import User

_bearer = HTTPBearer(auto_error=False)
_RESOURCE_PERMISSIONS = {
    "vehicles": "reception",
    "bookings": "reception",
    "inventory": "catalog",
    "settings": "catalog",
    "reports": "reports",
    "mechanics": "hr",
}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Đọc JWT, rồi lấy tài khoản và quyền hiện tại từ database.
    Tài khoản bị khóa, vai trò cũ hoặc sessionVersion lệch đều nhận 401.
    Không tin vai trò do client hoặc token cũ cung cấp.
    """
    try:
        if credentials is None:
            raise JWTError("Missing bearer token")
        payload = decode_token(credentials.credentials)
        user = await db.get(User, payload.get("id"))
        if (
            user is None
            or not user.isActive
            or user.role not in ROLE_VALUES
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


def _request_permission(request, user):
    """Chọn nhóm quyền theo endpoint; không thay kiểm tra sở hữu trong router."""
    path = request.url.path.split("/")
    if len(path) <= 2:
        return None
    resource = path[2]
    role = user["role"]
    if resource == "auth" and len(path) > 3 and path[3] in ("users", "register-staff"):
        return "accounts"
    if resource == "repairs":
        if role == "accountant":
            return "finance"
        billing_action = (request.method == "GET" and len(path) == 3) or (
            request.method == "PUT" and len(path) == 4
        )
        if role == "admin" and "workshop" not in user["permissions"] and billing_action:
            return "finance"
        return "workshop"
    if (
        resource in ("inventory", "mechanics")
        and request.method == "GET"
        and role in ("advisor", "mechanic")
    ):
        return "workshop"
    return _RESOURCE_PERMISSIONS.get(resource)


def require_role(*roles: Role) -> Callable:
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/admin-only")
        async def admin_route(user=Depends(require_role(Role.ADMIN))):
            ...
    """

    allowed_roles = frozenset(role.value for role in roles)

    async def _checker(
        request: Request, current_user: dict = Depends(get_current_user)
    ) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập chức năng này",
            )
        domain = _request_permission(request, current_user)
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
