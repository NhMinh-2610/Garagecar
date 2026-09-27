from core.time import utcnow
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import Role
from core.response import success_response
from database.session import get_db
from middleware.auth import require_role
from models import Mechanic, RepairTicket, Vehicle
from schemas.repair import RepairItemToggle, RepairTicketCreate, RepairTicketResponse, RepairTicketUpdate
from services.repair_service import (
    assigned_mechanic, authorize_ticket, lock_ticket, replace_items, sync_vehicle, transition,
)

router = APIRouter(prefix="/api/repairs", tags=["Repairs"])


def serialize(ticket):
    return RepairTicketResponse.model_validate(ticket).model_dump()


@router.get("/my-tasks")
async def my_tasks(db: AsyncSession = Depends(get_db),
                   user: dict = Depends(require_role(Role.MECHANIC, Role.ADMIN))):
    tickets = await db.scalars(select(RepairTicket).join(Mechanic, RepairTicket.mechanicId == Mechanic.id)
                              .where(Mechanic.userId == user["id"], Mechanic.status == "active")
                              .order_by(RepairTicket.createdAt.desc()))
    return success_response([serialize(t) for t in tickets])


@router.get("/my-repairs")
async def my_repairs(db: AsyncSession = Depends(get_db),
                     user: dict = Depends(require_role(Role.CUSTOMER))):
    tickets = await db.scalars(select(RepairTicket).join(Vehicle)
                              .where(Vehicle.customerId == user["id"]).order_by(RepairTicket.createdAt.desc()))
    return success_response([serialize(t) for t in tickets])


@router.get("")
async def list_repairs(db: AsyncSession = Depends(get_db),
                       _: dict = Depends(require_role(Role.ADMIN))):
    tickets = await db.scalars(select(RepairTicket).order_by(RepairTicket.createdAt.desc()))
    return success_response([serialize(t) for t in tickets])


@router.get("/{ticket_id}")
async def get_repair(ticket_id: int, db: AsyncSession = Depends(get_db),
                     user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC, Role.CUSTOMER))):
    ticket = await db.get(RepairTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Không tìm thấy phiếu sửa chữa")
    await authorize_ticket(db, ticket, user)
    return success_response(serialize(ticket))


@router.post("")
async def create_repair(body: RepairTicketCreate, db: AsyncSession = Depends(get_db),
                        _: dict = Depends(require_role(Role.ADMIN))):
    vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == body.vehicleId).with_for_update())
    if not vehicle:
        raise HTTPException(404, "Không tìm thấy xe")
    if vehicle.status == "delivered":
        raise HTTPException(409, "Cần tiếp nhận lại xe trước khi tạo phiếu")
    active = await db.scalar(select(RepairTicket.id).where(
        RepairTicket.vehicleId == vehicle.id, RepairTicket.status != "paid"))
    if active:
        raise HTTPException(409, "Xe đã có phiếu chưa thanh toán")
    mechanic = await assigned_mechanic(db, body.mechanicId)
    ticket = RepairTicket(vehicle=vehicle, mechanicId=body.mechanicId,
                          mechanicName=mechanic.fullName if mechanic else "Chưa phân công",
                          status="draft", items=[])
    db.add(ticket)
    await db.flush()
    await replace_items(db, ticket, body.items)
    await sync_vehicle(db, vehicle)
    await db.commit()
    await db.refresh(ticket)
    return success_response(serialize(ticket), "Tạo phiếu và xuất vật tư thành công", 201)


@router.put("/{ticket_id}")
async def update_repair(ticket_id: int, body: RepairTicketUpdate, db: AsyncSession = Depends(get_db),
                        user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC))):
    ticket = await lock_ticket(db, ticket_id)
    await authorize_ticket(db, ticket, user)
    fields = body.model_fields_set
    if user["role"] == "mechanic" and (fields - {"status"} or body.status not in ("working", "completed")):
        raise HTTPException(403, "Thợ chỉ được bắt đầu hoặc hoàn thành phiếu được giao")
    if fields & {"items", "mechanicId"}:
        legacy_link = ticket.mechanicId is None and fields == {"mechanicId"} and body.mechanicId is not None
        if ticket.status not in ("draft", "working") and not legacy_link:
            raise HTTPException(409, "Phiếu đã hoàn thành không được chỉnh sửa")
        if "mechanicId" in fields:
            if ticket.status == "working" and body.mechanicId is None:
                raise HTTPException(400, "Phiếu đang sửa cần có thợ phụ trách")
            mechanic = await assigned_mechanic(db, body.mechanicId)
            ticket.mechanicId = body.mechanicId
            ticket.mechanicName = mechanic.fullName if mechanic else "Chưa phân công"
        if "items" in fields:
            if ticket.status != "draft" or body.items is None:
                raise HTTPException(409, "Chỉ thay đổi hạng mục khi phiếu đang chờ sửa")
            if any(item.inventoryId is None and item.partPrice > 0 for item in ticket.items):
                raise HTTPException(409, "Phiếu cũ có vật tư chưa liên kết. Giữ nguyên hạng mục; chỉ cập nhật phân công.")
            await replace_items(db, ticket, body.items)
    if body.status:
        await transition(db, ticket, body.status.value)
    await db.commit()
    await db.refresh(ticket)
    return success_response(serialize(ticket), "Cập nhật phiếu thành công")


@router.delete("/{ticket_id}")
async def delete_repair(ticket_id: int, db: AsyncSession = Depends(get_db),
                        _: dict = Depends(require_role(Role.ADMIN))):
    ticket = await lock_ticket(db, ticket_id)
    if ticket.status != "draft":
        raise HTTPException(409, "Chỉ được xóa phiếu chưa bắt đầu sửa")
    vehicle = ticket.vehicle
    await replace_items(db, ticket, [])
    await db.delete(ticket)
    await sync_vehicle(db, vehicle)
    await db.commit()
    return success_response(None, "Đã xóa phiếu và hoàn vật tư về kho")


@router.put("/{ticket_id}/items/{item_id}/toggle")
async def toggle_item(ticket_id: int, item_id: int, body: RepairItemToggle,
                      db: AsyncSession = Depends(get_db),
                      user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC))):
    from datetime import datetime
    ticket = await lock_ticket(db, ticket_id)
    await authorize_ticket(db, ticket, user)
    if ticket.status != "working":
        raise HTTPException(409, "Chỉ cập nhật hạng mục khi phiếu đang sửa")
    item = next((item for item in ticket.items if item.id == item_id), None)
    if not item:
        raise HTTPException(404, "Không tìm thấy hạng mục")
    item.isCompleted = body.isCompleted
    item.completedAt = utcnow() if body.isCompleted else None
    await db.commit()
    return success_response(serialize(ticket), "Đã cập nhật tiến độ")


@router.get("/{ticket_id}/can-complete")
async def can_complete(ticket_id: int, db: AsyncSession = Depends(get_db),
                       user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC))):
    ticket = await db.get(RepairTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Không tìm thấy phiếu sửa chữa")
    await authorize_ticket(db, ticket, user)
    total = len(ticket.items)
    done = sum(item.isCompleted for item in ticket.items)
    return success_response({"canComplete": ticket.status == "working" and total > 0 and total == done,
                             "totalItems": total, "completedItems": done, "incompleteItems": total - done})

