from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from database.session import get_db
from models.user import User
from models.mechanic import Mechanic
from schemas.auth import RegisterRequest, StaffRegisterRequest, LoginRequest, UserResponse, TokenResponse
from core.security import hash_password, verify_password, create_access_token, needs_rehash
from core.rate_limit import check_rate_limit, record_attempt
from core.constants import Role, STAFF_ROLES
from core.response import success_response, error_response
from middleware.auth import get_current_user, require_role
from core.time import utcnow

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", summary="Customer self-registration")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint — creates a Customer account.
    Staff accounts must be created by an admin via /register-staff.
    """
    stmt = select(User).where(or_(User.email == body.email, User.username == body.username))
    result = await db.execute(stmt)
    if result.scalars().first():
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
    """Admin-only: create mechanic or admin accounts."""
    if body.role not in [r.value for r in STAFF_ROLES]:
        return error_response(
            f"Chỉ có thể tạo tài khoản với vai trò: {', '.join(r.value for r in STAFF_ROLES)}",
            400,
        )

    stmt = select(User).where(or_(User.email == body.email, User.username == body.username))
    result = await db.execute(stmt)
    if result.scalars().first():
        return error_response("Email hoặc username đã tồn tại", 400)

    user = User(
        username=body.username,
        email=body.email,
        password=hash_password(body.password),
        fullName=body.fullName,
        role=body.role,
    )
    db.add(user)
    await db.flush()
    if user.role == Role.MECHANIC.value:
        if body.mechanicId:
            mechanic = await db.scalar(select(Mechanic).where(Mechanic.id == body.mechanicId).with_for_update())
            if not mechanic or mechanic.userId or mechanic.status != "active":
                await db.rollback()
                return error_response("Hồ sơ thợ không hợp lệ hoặc đã có tài khoản", 409)
            mechanic.userId = user.id
        else:
            db.add(Mechanic(userId=user.id, fullName=user.fullName))
    await db.commit()
    await db.refresh(user)

    return success_response(
        UserResponse.model_validate(user).model_dump(),
        f"Tạo tài khoản {body.role} thành công",
        201,
    )


@router.post("/login", summary="Login and receive JWT")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Authenticates the user and returns a JWT access token.

    Security layers:
    - Rate limit: max 5 failed attempts per email and per IP in 15 minutes.
    - Argon2id password hashing (auto-migrates legacy bcrypt hashes on login).
    - Generic error message: does not reveal whether email exists.
    """
    ip    = request.client.host if request.client else "unknown"
    email = body.email.lower()

    # ── Rate limiting (check BEFORE hitting the DB for credentials) ────────────
    await check_rate_limit(db, f"ip:{ip}")
    await check_rate_limit(db, f"email:{email}")

    # ── Credential check ───────────────────────────────────────────────────────
    user = await db.scalar(select(User).where(func.lower(User.email) == email))

    if not user or not user.isActive or not verify_password(body.password, user.password):
        # Record failure for both identifiers; always commit so counts are durable
        await record_attempt(db, f"ip:{ip}",       success=False)
        await record_attempt(db, f"email:{email}", success=False)
        await db.commit()
        # Generic message — do NOT say "email not found" vs "wrong password"
        return error_response("Email hoặc mật khẩu không đúng", 401)

    # ── Auto-upgrade legacy bcrypt → Argon2id on successful login ─────────────
    if needs_rehash(user.password):
        user.password = hash_password(body.password)

    await record_attempt(db, f"email:{email}", success=True)
    user.lastLoginAt = utcnow()
    await db.commit()

    token = create_access_token({
        "id":       user.id,
        "email":    user.email,
        "role":     user.role,
        "fullName": user.fullName,
        "version":  user.sessionVersion,
    })

    return success_response(
        {
            "token": token,
            "user":  UserResponse.model_validate(user).model_dump(),
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

    await db.scalars(select(User).where(User.role == "admin").order_by(User.id).with_for_update())
    actor = await db.get(User, current_user["id"], populate_existing=True)
    if not actor or not actor.isActive:
        return error_response("Tài khoản quản trị đã bị khóa", 403)
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        return error_response("Không tìm thấy người dùng", 404)

    await db.delete(user)
    await db.commit()
    return success_response(None, "Xóa tài khoản thành công")
