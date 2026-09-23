from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.session import get_db
from models.repair_ticket import RepairTicket
from models.repair_item import RepairItem
from models.vehicle import Vehicle
from schemas.repair import (
    RepairTicketCreate,
    RepairTicketUpdate,
    RepairTicketResponse,
    RepairItemToggle,
)
from core.constants import Role
from core.response import success_response, error_response
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/repairs", tags=["Repairs"])


def _serialize_ticket(ticket: RepairTicket) -> dict:
    return RepairTicketResponse.model_validate(ticket).model_dump()


# ── Mechanic view: tasks assigned to me ───────────────────────────────────────

@router.get("/my-tasks", summary="Get repairs assigned to the logged-in mechanic")
async def my_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    stmt = (
        select(RepairTicket)
        .where(RepairTicket.mechanicName == current_user["fullName"])
        .order_by(RepairTicket.createdAt.desc())
    )
    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return success_response([_serialize_ticket(t) for t in tickets])


# ── Customer view: repairs for my vehicles ────────────────────────────────────

@router.get("/my-repairs", summary="Get repair history for the logged-in customer's vehicles")
async def my_repairs(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Find vehicles owned by this customer
    v_stmt = select(Vehicle.id).where(Vehicle.customerName == current_user["fullName"])
    v_result = await db.execute(v_stmt)
    vehicle_ids = [row[0] for row in v_result.all()]

    if not vehicle_ids:
        return success_response([])

    stmt = (
        select(RepairTicket)
        .where(RepairTicket.vehicleId.in_(vehicle_ids))
        .order_by(RepairTicket.createdAt.desc())
    )
    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return success_response([_serialize_ticket(t) for t in tickets])


# ── Admin view: all tickets ────────────────────────────────────────────────────

@router.get("", summary="List all repair tickets (admin only)")
async def list_repairs(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(RepairTicket).order_by(RepairTicket.createdAt.desc())
    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return success_response([_serialize_ticket(t) for t in tickets])


# ── Single ticket ──────────────────────────────────────────────────────────────

@router.get("/{ticket_id}", summary="Get a single repair ticket")
async def get_repair(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC, Role.CUSTOMER)),
):
    stmt = select(RepairTicket).where(RepairTicket.id == ticket_id)
    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()

    if not ticket:
        return error_response("Không tìm thấy phiếu sửa chữa", 404)

    # Customer: only see repairs for their own vehicles
    if current_user["role"] == Role.CUSTOMER.value:
        v_stmt = select(Vehicle).where(
            Vehicle.id == ticket.vehicleId,
            Vehicle.customerName == current_user["fullName"],
        )
        v_result = await db.execute(v_stmt)
        if not v_result.scalar_one_or_none():
            return error_response("Bạn không có quyền xem phiếu này", 403)

    # Mechanic: only see repairs assigned to them
    if current_user["role"] == Role.MECHANIC.value:
        if ticket.mechanicName != current_user["fullName"]:
            return error_response("Bạn không được phân công phiếu này", 403)

    return success_response(_serialize_ticket(ticket))


# ── Create ─────────────────────────────────────────────────────────────────────

@router.post("", summary="Create a repair ticket (admin only)")
async def create_repair(
    body: RepairTicketCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    total = sum(float(i.totalPrice) for i in (body.items or []))

    ticket = RepairTicket(
        vehicleId=body.vehicleId,
        mechanicName=body.mechanicName or "Chưa phân công",
        totalAmount=total,
        status="draft",
    )
    db.add(ticket)
    await db.flush()  # get ticket.id without full commit

    for item_data in (body.items or []):
        item = RepairItem(repairTicketId=ticket.id, **item_data.model_dump())
        db.add(item)

    # Update vehicle status to repairing
    v_stmt = select(Vehicle).where(Vehicle.id == body.vehicleId)
    v_result = await db.execute(v_stmt)
    vehicle = v_result.scalar_one_or_none()
    if vehicle and vehicle.status == "waiting":
        vehicle.status = "repairing"

    await db.commit()
    await db.refresh(ticket)
    return success_response(_serialize_ticket(ticket), "Tạo phiếu sửa chữa thành công", 201)


# ── Update ─────────────────────────────────────────────────────────────────────

@router.put("/{ticket_id}", summary="Update repair ticket status or details (admin + mechanic)")
async def update_repair(
    ticket_id: int,
    body: RepairTicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    stmt = select(RepairTicket).where(RepairTicket.id == ticket_id)
    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()
    if not ticket:
        return error_response("Không tìm thấy phiếu sửa chữa", 404)

    # Mechanic restrictions
    if current_user["role"] == Role.MECHANIC.value:
        if ticket.mechanicName != current_user["fullName"]:
            return error_response("Bạn không được phân công phiếu này", 403)
        if body.status and body.status != "completed":
            return error_response("Thợ chỉ có thể đánh dấu hoàn thành phiếu sửa", 403)

    new_status = body.status
    old_status = ticket.status

    if new_status and new_status != old_status:
        # All items must be done before completing
        if new_status == "completed":
            incomplete = [i for i in ticket.items if not i.isCompleted]
            if incomplete:
                return error_response("Không thể hoàn thành! Vẫn còn hạng mục chưa hoàn thành.", 400)

        # Auto-set timestamps on status transitions
        now = datetime.now(timezone.utc)
        if new_status == "working" and not ticket.startedAt:
            ticket.startedAt = now
        if new_status == "completed" and not ticket.completedAt:
            ticket.completedAt = now
        if new_status == "paid" and not ticket.paidAt:
            ticket.paidAt = now

    # Apply update fields
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ticket, field, value)

    # Sync vehicle status
    if new_status and new_status != old_status and ticket.vehicleId:
        v_stmt = select(Vehicle).where(Vehicle.id == ticket.vehicleId)
        v_result = await db.execute(v_stmt)
        vehicle = v_result.scalar_one_or_none()
        if vehicle:
            vehicle.status = "repairing" if new_status in ("draft", "working") else "completed"

    await db.commit()
    await db.refresh(ticket)
    return success_response(_serialize_ticket(ticket), "Cập nhật thành công")


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/{ticket_id}", summary="Delete a repair ticket (admin only)")
async def delete_repair(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(RepairTicket).where(RepairTicket.id == ticket_id)
    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()
    if not ticket:
        return error_response("Không tìm thấy phiếu sửa chữa", 404)
    if ticket.status in ("completed", "paid"):
        return error_response("Không thể xóa phiếu đã hoàn thành hoặc đã thanh toán!", 400)
    await db.delete(ticket)
    await db.commit()
    return success_response(None, "Xóa thành công")


# ── Toggle repair item completion ──────────────────────────────────────────────

@router.put("/{ticket_id}/items/{item_id}/toggle", summary="Toggle completion status of a repair item")
async def toggle_item(
    ticket_id: int,
    item_id: int,
    body: RepairItemToggle,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    # Mechanic: verify assignment
    if current_user["role"] == Role.MECHANIC.value:
        t_stmt = select(RepairTicket).where(RepairTicket.id == ticket_id)
        t_result = await db.execute(t_stmt)
        ticket = t_result.scalar_one_or_none()
        if not ticket or ticket.mechanicName != current_user["fullName"]:
            return error_response("Bạn không được phân công phiếu này", 403)

    stmt = select(RepairItem).where(
        RepairItem.id == item_id, RepairItem.repairTicketId == ticket_id
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        return error_response("Không tìm thấy hạng mục", 404)

    item.isCompleted = body.isCompleted
    item.completedAt = datetime.now(timezone.utc) if body.isCompleted else None
    await db.commit()
    await db.refresh(item)
    return success_response(
        {"id": item.id, "isCompleted": item.isCompleted, "completedAt": str(item.completedAt)},
        "Đã cập nhật trạng thái hạng mục",
    )


# ── Can-complete check ─────────────────────────────────────────────────────────

@router.get("/{ticket_id}/can-complete", summary="Check if all items are done (admin + mechanic)")
async def can_complete(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    stmt = select(RepairTicket).where(RepairTicket.id == ticket_id)
    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()
    if not ticket:
        return error_response("Không tìm thấy phiếu sửa chữa", 404)

    total = len(ticket.items)
    done = sum(1 for i in ticket.items if i.isCompleted)
    return success_response({
        "canComplete": total > 0 and done == total,
        "totalItems": total,
        "completedItems": done,
        "incompleteItems": total - done,
    })
