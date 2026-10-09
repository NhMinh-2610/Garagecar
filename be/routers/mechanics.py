from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import Role
from core.response import error_response, success_response
from database.session import get_db
from middleware.auth import require_role
from models import RepairTicket, User
from models.mechanic import Mechanic
from schemas.mechanic import MechanicCreate, MechanicResponse, MechanicUpdate

router = APIRouter(prefix="/api/mechanics", tags=["Mechanics"])


@router.get("", summary="List active mechanics (admin + mechanic)")
async def list_mechanics(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role(Role.ADMIN, Role.MECHANIC, Role.ADVISOR, Role.HR)
    ),
):
    stmt = select(Mechanic).order_by(Mechanic.createdAt.desc())
    if include_inactive and user["role"] not in ("admin", "hr"):
        raise HTTPException(403, "Chỉ admin được xem hồ sơ ngừng hoạt động")
    if not include_inactive:
        stmt = stmt.where(Mechanic.status == "active")
    result = await db.execute(stmt)
    mechanics = result.scalars().all()
    return success_response(
        [MechanicResponse.model_validate(m).model_dump() for m in mechanics]
    )


@router.post("", summary="Add a new mechanic profile (admin only)")
async def create_mechanic(
    body: MechanicCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    mechanic = Mechanic(**body.model_dump())
    if body.userId:
        user = await db.get(User, body.userId)
        if not user or user.role != "mechanic":
            raise HTTPException(400, "Tài khoản thợ không hợp lệ")
    db.add(mechanic)
    await db.commit()
    await db.refresh(mechanic)
    return success_response(
        MechanicResponse.model_validate(mechanic).model_dump(),
        "Thêm thợ thành công",
        201,
    )


@router.delete("/{mechanic_id}", summary="Soft-delete a mechanic (admin only)")
async def delete_mechanic(
    mechanic_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Mechanic).where(Mechanic.id == mechanic_id).with_for_update()
    result = await db.execute(stmt)
    mechanic = result.scalar_one_or_none()
    if not mechanic:
        return error_response("Không tìm thấy thợ", 404)

    active_ticket = await db.scalar(
        select(RepairTicket.id).where(
            RepairTicket.mechanicId == mechanic.id,
            RepairTicket.status.in_(["draft", "working"]),
        )
    )
    if active_ticket:
        raise HTTPException(
            409, "Cần phân công lại các phiếu đang mở trước khi ngừng hoạt động thợ"
        )
    mechanic.status = "inactive"
    await db.commit()
    return success_response(None, "Đã xóa thợ thành công")


@router.put("/{mechanic_id}")
async def update_mechanic(
    mechanic_id: int,
    body: MechanicUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    mechanic = await db.scalar(
        select(Mechanic).where(Mechanic.id == mechanic_id).with_for_update()
    )
    if not mechanic:
        raise HTTPException(404, "Không tìm thấy thợ")
    if body.userId:
        user = await db.get(User, body.userId)
        if not user or user.role != "mechanic":
            raise HTTPException(400, "Tài khoản phải có vai trò thợ")
    if body.status == "inactive":
        active = await db.scalar(
            select(RepairTicket.id).where(
                RepairTicket.mechanicId == mechanic.id,
                RepairTicket.status.in_(["draft", "working"]),
            )
        )
        if active:
            raise HTTPException(
                409, "Cần phân công lại phiếu đang mở trước khi ngừng hoạt động"
            )
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None or field in ("userId", "phone"):
            setattr(mechanic, field, value)
    await db.commit()
    return success_response(
        MechanicResponse.model_validate(mechanic).model_dump(), "Đã cập nhật hồ sơ thợ"
    )
