"""Repair workflow. Every mutation runs in the request's single transaction."""

from collections import Counter
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import utcnow
from models import Inventory, Mechanic, RepairItem, RepairTicket, Vehicle
from models.inventory_movement import InventoryMovement

TRANSITIONS = {
    "draft": {"working"},
    "working": {"completed"},
    "completed": {"paid"},
    "paid": set(),
}


async def assigned_mechanic(db: AsyncSession, mechanic_id: int | None):
    if mechanic_id is None:
        return None
    mechanic = await db.scalar(
        select(Mechanic).where(Mechanic.id == mechanic_id).with_for_update()
    )
    if mechanic and mechanic.userId:
        from models import User

        account = await db.get(User, mechanic.userId)
        if not account or not account.isActive or account.role != "mechanic":
            raise HTTPException(409, "Tài khoản thợ đã bị khóa hoặc không hợp lệ")
    if not mechanic or mechanic.status != "active":
        raise HTTPException(400, "Thợ không tồn tại hoặc đã ngừng hoạt động")
    return mechanic


async def authorize_ticket(db, ticket, user):
    if user["role"] in ("admin", "advisor", "accountant"):
        return
    if user["role"] == "customer" and ticket.vehicle.customerId == user["id"]:
        return
    if user["role"] == "mechanic":
        mechanic = await db.scalar(
            select(Mechanic).where(
                Mechanic.id == ticket.mechanicId,
                Mechanic.userId == user["id"],
                Mechanic.status == "active",
            )
        )
        if mechanic:
            return
    raise HTTPException(403, "Bạn không có quyền truy cập phiếu này")


async def lock_ticket(db, ticket_id):
    # Vehicle first: identical lock order to intake/create/delivery.
    vehicle_id = await db.scalar(
        select(RepairTicket.vehicleId).where(RepairTicket.id == ticket_id)
    )
    if vehicle_id is None:
        raise HTTPException(404, "Không tìm thấy phiếu sửa chữa")
    await db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id).with_for_update())
    ticket = await db.scalar(
        select(RepairTicket).where(RepairTicket.id == ticket_id).with_for_update()
    )
    if not ticket:
        raise HTTPException(404, "Không tìm thấy phiếu sửa chữa")
    return ticket


async def replace_items(db, ticket, requested):
    old = Counter()
    for item in ticket.items:
        if item.inventoryId:
            old[item.inventoryId] += item.quantity
    needed = Counter()
    for item in requested:
        if item.inventoryId:
            needed[item.inventoryId] += item.quantity
    ids = sorted(old.keys() | needed.keys())
    stock = {}
    if ids:
        rows = (
            await db.scalars(
                select(Inventory)
                .where(Inventory.id.in_(ids))
                .order_by(Inventory.id)
                .with_for_update()
            )
        ).all()
        stock = {row.id: row for row in rows}
    for inventory_id in ids:
        part = stock.get(inventory_id)
        if part is None:
            raise HTTPException(400, "Vật tư không tồn tại")
        if needed[inventory_id] and part.fitments:
            from models import VehicleCare

            care = await db.get(VehicleCare, ticket.vehicleId)
            matches = care and any(
                f["brand"].strip().casefold()
                == ticket.vehicle.carBrand.strip().casefold()
                and f["model"].strip().casefold()
                == (ticket.vehicle.carModel or "").strip().casefold()
                and f["yearFrom"] <= care.modelYear <= f["yearTo"]
                and f["engine"].strip().casefold() == care.engine.strip().casefold()
                for f in part.fitments
            )
            if not matches:
                raise HTTPException(
                    409,
                    f"Vật tư {part.name} chưa có cấu hình tương thích khớp hồ sơ xe. Bổ sung năm/động cơ hoặc chọn đúng mã",
                )
        available = part.quantity + old[inventory_id]
        if needed[inventory_id] > available:
            raise HTTPException(409, f"Không đủ tồn kho: {part.name} (còn {available})")
        part.quantity = available - needed[inventory_id]
        change = old[inventory_id] - needed[inventory_id]
        if change:
            db.add(
                InventoryMovement(
                    inventoryId=inventory_id,
                    quantityChange=change,
                    balanceAfter=part.quantity,
                    reason="repair",
                    reference=f"repair:{ticket.id}",
                )
            )
    items = []
    for data in requested:
        part = stock.get(data.inventoryId)
        price = Decimal(part.unitPrice) if part else Decimal(0)
        labor = Decimal(data.laborPrice)
        total = price * data.quantity + labor
        if total >= Decimal("1000000000000"):
            raise HTTPException(400, "Giá trị hạng mục vượt giới hạn")
        items.append(
            RepairItem(
                taskName=data.taskName,
                inventoryId=data.inventoryId,
                partName=part.name if part else "---",
                partCode=part.sku if part else None,
                quantity=data.quantity,
                partPrice=price,
                laborPrice=labor,
                totalPrice=total,
            )
        )
    ticket.items = items
    ticket.totalAmount = sum((item.totalPrice for item in items), Decimal(0))
    if ticket.totalAmount >= Decimal("1000000000000"):
        raise HTTPException(400, "Tổng tiền vượt giới hạn")


async def sync_vehicle(db, vehicle):
    await db.flush()
    tickets = (
        await db.scalars(
            select(RepairTicket).where(RepairTicket.vehicleId == vehicle.id)
        )
    ).all()
    if any(t.status == "working" for t in tickets):
        vehicle.status = "repairing"
    elif any(t.status == "draft" for t in tickets):
        vehicle.status = "waiting"
    elif tickets:
        if vehicle.status != "delivered":
            vehicle.status = "completed"
    else:
        vehicle.status = "waiting"


async def transition(
    db, ticket, status, user=None, payment_method="cash", payment_reference=""
):
    if status == ticket.status:
        return
    if status not in TRANSITIONS[ticket.status]:
        raise HTTPException(
            409,
            "Trạng thái phải theo thứ tự: chờ sửa → đang sửa → hoàn thành → thanh toán",
        )
    if status == "working":
        if not ticket.mechanicId:
            raise HTTPException(400, "Vui lòng phân công thợ trước khi bắt đầu")
        await assigned_mechanic(db, ticket.mechanicId)
        ticket.startedAt = utcnow()
    elif status == "completed":
        if not ticket.items or any(not item.isCompleted for item in ticket.items):
            raise HTTPException(
                400, "Cần hoàn thành tất cả hạng mục trước khi kết thúc phiếu"
            )
        ticket.completedAt = utcnow()
    elif status == "paid":
        if ticket.serviceVisitId:
            from models import ServiceVisit

            visit = await db.get(ServiceVisit, ticket.serviceVisitId)
            if not visit or not visit.qcAt:
                raise HTTPException(409, "Cần nghiệm thu trước khi thu tiền")
        from models import PaymentReceipt

        if payment_method != "cash" and not payment_reference.strip():
            raise HTTPException(422, "Cần mã giao dịch khi thu qua ngân hàng hoặc thẻ")
        if not user:
            raise HTTPException(403, "Cần xác định người thu tiền")
        db.add(
            PaymentReceipt(
                ticketId=ticket.id,
                amount=ticket.totalAmount,
                method=payment_method,
                reference=payment_reference.strip(),
                receivedBy=user["id"],
            )
        )
        ticket.paidAt = utcnow()
    ticket.status = status
    await sync_vehicle(db, ticket.vehicle)
