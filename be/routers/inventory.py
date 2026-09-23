from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.session import get_db
from models.inventory import Inventory
from schemas.inventory import InventoryCreate, InventoryUpdate, InventoryResponse
from core.constants import Role
from core.response import success_response, error_response
from middleware.auth import require_role

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("", summary="List all inventory items (admin + mechanic)")
async def list_inventory(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    stmt = select(Inventory).order_by(Inventory.name.asc())
    result = await db.execute(stmt)
    items = result.scalars().all()
    return success_response([InventoryResponse.model_validate(i).model_dump() for i in items])


@router.post("", summary="Add an inventory item (admin only)")
async def create_inventory(
    body: InventoryCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    item = Inventory(**body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return success_response(InventoryResponse.model_validate(item).model_dump(), "Nhập kho thành công", 201)


@router.put("/{item_id}", summary="Update an inventory item (admin only)")
async def update_inventory(
    item_id: int,
    body: InventoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Inventory).where(Inventory.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        return error_response("Không tìm thấy vật tư", 404)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return success_response(InventoryResponse.model_validate(item).model_dump(), "Cập nhật thành công")


@router.delete("/{item_id}", summary="Delete an inventory item (admin only)")
async def delete_inventory(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Inventory).where(Inventory.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        return error_response("Không tìm thấy vật tư", 404)
    await db.delete(item)
    await db.commit()
    return success_response(None, "Xóa thành công")
