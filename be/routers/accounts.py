"""Account lifecycle; roles stay fixed to protect existing profile ownership."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import Role
from core.response import success_response
from core.security import hash_password, verify_password
from database.session import get_db
from middleware.auth import get_current_user, require_role
from models import User, Mechanic, Vehicle
from schemas.auth import AccountCreate, AccountUpdate, PasswordReset, PasswordChange, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Accounts"])


async def ensure_unique(db, username, email, user_id=None):
    query = select(User.id).where(or_(User.username == username, func.lower(User.email) == email.lower()))
    if user_id is not None:
        query = query.where(User.id != user_id)
    if await db.scalar(query):
        raise HTTPException(409, "Email hoặc tên đăng nhập đã được sử dụng")


@router.post("/users", status_code=201)
async def create_account(body: AccountCreate, db: AsyncSession = Depends(get_db),
                         _: dict = Depends(require_role(Role.ADMIN))):
    await ensure_unique(db, body.username, body.email)
    if body.mechanicId and body.role != "mechanic" or body.vehicleIds and body.role != "customer":
        raise HTTPException(422, "Hồ sơ liên kết không phù hợp với vai trò")
    mechanic = None
    if body.mechanicId:
        mechanic = await db.scalar(select(Mechanic).where(Mechanic.id == body.mechanicId).with_for_update())
        if not mechanic or mechanic.userId or mechanic.status != "active":
            raise HTTPException(409, "Hồ sơ thợ đã có tài khoản hoặc không còn hoạt động")
    vehicle_ids = sorted(set(body.vehicleIds))
    vehicles = list((await db.scalars(select(Vehicle).where(Vehicle.id.in_(vehicle_ids))
                                    .order_by(Vehicle.id).with_for_update())).all()) if vehicle_ids else []
    if len(vehicles) != len(vehicle_ids) or any(v.customerId for v in vehicles):
        raise HTTPException(409, "Xe không tồn tại hoặc đã liên kết khách hàng khác")
    user = User(username=body.username, fullName=body.fullName, email=body.email,
                role=body.role, password=hash_password(body.password))
    db.add(user)
    await db.flush()
    if body.role == "mechanic":
        if mechanic:
            mechanic.userId = user.id
        else:
            db.add(Mechanic(userId=user.id, fullName=user.fullName))
    for vehicle in vehicles:
        vehicle.customerId = user.id
    await db.commit()
    return success_response(UserResponse.model_validate(user).model_dump(), "Đã tạo tài khoản", 201)


@router.put("/users/{user_id}")
async def update_account(user_id: int, body: AccountUpdate, db: AsyncSession = Depends(get_db),
                         current: dict = Depends(require_role(Role.ADMIN))):
    # Serialize account lifecycle operations, including concurrent admin requests.
    await db.scalars(select(User).where(User.role == "admin").order_by(User.id).with_for_update())
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        raise HTTPException(404, "Không tìm thấy tài khoản")
    actor = await db.get(User, current["id"], populate_existing=True)
    if not actor or not actor.isActive:
        raise HTTPException(403, "Tài khoản quản trị đã bị khóa")
    if user_id == current["id"] and not body.isActive:
        raise HTTPException(409, "Không thể tự khóa tài khoản đang sử dụng")
    await ensure_unique(db, body.username, body.email, user_id)
    if user.isActive != body.isActive:
        user.sessionVersion += 1
    for field, value in body.model_dump().items():
        setattr(user, field, value)
    await db.commit()
    return success_response(UserResponse.model_validate(user).model_dump(), "Đã cập nhật tài khoản")


@router.post("/users/{user_id}/password")
async def reset_password(user_id: int, body: PasswordReset, db: AsyncSession = Depends(get_db),
                         current: dict = Depends(require_role(Role.ADMIN))):
    if user_id == current["id"]:
        raise HTTPException(409, "Dùng mục Tài khoản của tôi để đổi mật khẩu của bạn")
    user = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not user:
        raise HTTPException(404, "Không tìm thấy tài khoản")
    user.password = hash_password(body.password)
    user.sessionVersion += 1
    await db.commit()
    return success_response(None, "Đã đặt lại mật khẩu và kết thúc các phiên đăng nhập cũ")


@router.get("/me")
async def profile(db: AsyncSession = Depends(get_db), current: dict = Depends(get_current_user)):
    user = await db.get(User, current["id"])
    return success_response(UserResponse.model_validate(user).model_dump())


@router.put("/me/password")
async def change_password(body: PasswordChange, db: AsyncSession = Depends(get_db),
                          current: dict = Depends(get_current_user)):
    user = await db.scalar(select(User).where(User.id == current["id"]).with_for_update())
    if not verify_password(body.currentPassword, user.password):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    if body.currentPassword == body.password:
        raise HTTPException(400, "Mật khẩu mới phải khác mật khẩu hiện tại")
    user.password = hash_password(body.password)
    user.sessionVersion += 1
    await db.commit()
    return success_response(None, "Đã đổi mật khẩu. Vui lòng đăng nhập lại")
