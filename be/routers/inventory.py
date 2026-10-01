from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database.session import get_db
from models.inventory import Inventory
from schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
    StockReceipt,
)
from models.inventory_movement import InventoryMovement
from models.repair_item import RepairItem
from core.constants import Role
from core.response import success_response, error_response
from middleware.auth import require_role

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("", summary="List all inventory items (admin + mechanic)")
async def list_inventory(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC, Role.ADVISOR)),
):
    stmt = select(Inventory).order_by(Inventory.name.asc())
    result = await db.execute(stmt)
    items = result.scalars().all()
    return success_response(
        [InventoryResponse.model_validate(i).model_dump() for i in items]
    )


@router.post("", summary="Add an inventory item (admin only)")
async def create_inventory(
    body: InventoryCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    existing = await db.scalar(
        select(Inventory.id).where(func.lower(Inventory.name) == body.name.lower())
    )
    if existing:
        return error_response(
            "Vật tư đã tồn tại. Chọn vật tư có sẵn để nhập thêm.", 409
        )
    item = Inventory(**body.model_dump(mode="json"))
    db.add(item)
    await db.flush()
    db.add(
        InventoryMovement(
            inventoryId=item.id,
            quantityChange=item.quantity,
            balanceAfter=item.quantity,
            reason="opening",
        )
    )
    await db.commit()
    await db.refresh(item)
    return success_response(
        InventoryResponse.model_validate(item).model_dump(), "Nhập kho thành công", 201
    )


@router.put("/{item_id}", summary="Update an inventory item (admin only)")
async def update_inventory(
    item_id: int,
    body: InventoryUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Inventory).where(Inventory.id == item_id).with_for_update()
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        return error_response("Không tìm thấy vật tư", 404)

    old_quantity = item.quantity
    if (
        "sku" in body.model_fields_set
        and body.sku != item.sku
        and await db.scalar(
            select(RepairItem.id).where(
                RepairItem.inventoryId == item_id, RepairItem.partCode.is_not(None)
            )
        )
    ):
        raise HTTPException(
            409,
            "Mã SKU đã có trên phiếu sửa chữa. Tạo mã vật tư riêng để giữ lịch sử nhận dạng",
        )
    for field, value in body.model_dump(exclude_unset=True, mode="json").items():
        if value is None and field not in ("sku", "barcode"):
            continue
        setattr(item, field, value)
    if item.quantity != old_quantity:
        db.add(
            InventoryMovement(
                inventoryId=item.id,
                quantityChange=item.quantity - old_quantity,
                balanceAfter=item.quantity,
                reason="adjustment",
            )
        )

    await db.commit()
    await db.refresh(item)
    return success_response(
        InventoryResponse.model_validate(item).model_dump(), "Cập nhật thành công"
    )


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


@router.post("/{item_id}/receive")
async def receive_stock(
    item_id: int,
    body: StockReceipt,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    item = await db.scalar(
        select(Inventory).where(Inventory.id == item_id).with_for_update()
    )
    if not item:
        return error_response("Không tìm thấy vật tư", 404)
    item.quantity += body.quantity
    if body.unitPrice is not None:
        item.unitPrice = body.unitPrice
    db.add(
        InventoryMovement(
            inventoryId=item.id,
            quantityChange=body.quantity,
            balanceAfter=item.quantity,
            reason="receipt",
        )
    )
    await db.commit()
    await db.refresh(item)
    return success_response(
        InventoryResponse.model_validate(item).model_dump(), "Đã nhập thêm vật tư"
    )


@router.get("/{item_id}/movements")
async def stock_history(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    rows = await db.scalars(
        select(InventoryMovement)
        .where(InventoryMovement.inventoryId == item_id)
        .order_by(InventoryMovement.id.desc())
        .limit(200)
    )
    return success_response(
        [
            {
                "id": r.id,
                "quantityChange": r.quantityChange,
                "balanceAfter": r.balanceAfter,
                "reason": r.reason,
                "reference": r.reference,
                "createdAt": r.createdAt,
            }
            for r in rows
        ]
    )
