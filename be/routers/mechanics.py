from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.session import get_db
from models.mechanic import Mechanic
from schemas.mechanic import MechanicCreate, MechanicResponse
from core.constants import Role
from core.response import success_response, error_response
from middleware.auth import require_role

router = APIRouter(prefix="/api/mechanics", tags=["Mechanics"])


@router.get("", summary="List active mechanics (admin + mechanic)")
async def list_mechanics(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    stmt = select(Mechanic).where(Mechanic.status == "active").order_by(Mechanic.createdAt.desc())
    result = await db.execute(stmt)
    mechanics = result.scalars().all()
    return success_response([MechanicResponse.model_validate(m).model_dump() for m in mechanics])


@router.post("", summary="Add a new mechanic profile (admin only)")
async def create_mechanic(
    body: MechanicCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    mechanic = Mechanic(**body.model_dump())
    db.add(mechanic)
    await db.commit()
    await db.refresh(mechanic)
    return success_response(MechanicResponse.model_validate(mechanic).model_dump(), "Thêm thợ thành công", 201)


@router.delete("/{mechanic_id}", summary="Soft-delete a mechanic (admin only)")
async def delete_mechanic(
    mechanic_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Mechanic).where(Mechanic.id == mechanic_id)
    result = await db.execute(stmt)
    mechanic = result.scalar_one_or_none()
    if not mechanic:
        return error_response("Không tìm thấy thợ", 404)

    mechanic.status = "inactive"
    await db.commit()
    return success_response(None, "Đã xóa thợ thành công")
