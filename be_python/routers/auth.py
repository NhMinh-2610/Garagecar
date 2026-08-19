from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from database.session import get_db
from models.user import User
from schemas.auth import RegisterRequest, StaffRegisterRequest, LoginRequest, UserResponse, TokenResponse
from core.security import hash_password, verify_password, create_access_token
from core.constants import Role, STAFF_ROLES
from core.response import success_response, error_response
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", summary="Customer self-registration")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint — creates a Customer account.
    Staff accounts must be created by an admin via /register-staff.
    """
    # Duplicate check
    stmt = select(User).where(or_(User.email == body.email, User.username == body.username))
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        return error_response("Email hoặc username đã tồn tại", 400)

    user = User(
        username=body.username,
        email=body.email,
        password=hash_password(body.password),
        fullName=body.fullName,
        role=Role.CUSTOMER.value,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return success_response(
        UserResponse.model_validate(user).model_dump(),
        "Đăng ký thành công",
        201,
    )


@router.post("/register-staff", summary="Admin creates staff accounts")
async def register_staff(
    body: StaffRegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    """
    Admin-only: create mechanic or admin accounts.
    """
    if body.role not in [r.value for r in STAFF_ROLES]:
        return error_response(
            f"Chỉ có thể tạo tài khoản với vai trò: {', '.join(r.value for r in STAFF_ROLES)}",
            400,
        )

    stmt = select(User).where(or_(User.email == body.email, User.username == body.username))
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        return error_response("Email hoặc username đã tồn tại", 400)

    user = User(
        username=body.username,
        email=body.email,
        password=hash_password(body.password),
        fullName=body.fullName,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return success_response(
        UserResponse.model_validate(user).model_dump(),
        f"Tạo tài khoản {body.role} thành công",
        201,
    )


@router.post("/login", summary="Login and receive JWT")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == body.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password):
        return error_response("Email hoặc mật khẩu không đúng", 401)

    token = create_access_token({
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "fullName": user.fullName,
    })

    return success_response(
        {
            "token": token,
            "user": UserResponse.model_validate(user).model_dump(),
        },
        "Đăng nhập thành công",
    )


@router.get("/users", summary="List all users (admin only)")
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(User).order_by(User.createdAt.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return success_response([UserResponse.model_validate(u).model_dump() for u in users])


@router.delete("/users/{user_id}", summary="Delete a user account (admin only)")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(Role.ADMIN)),
):
    if user_id == current_user.get("id"):
        return error_response("Không thể xóa tài khoản của chính bạn", 400)

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        return error_response("Không tìm thấy người dùng", 404)

    await db.delete(user)
    await db.commit()
    return success_response(None, "Xóa tài khoản thành công")
