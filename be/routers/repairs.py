from core.time import utcnow
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import Role
from core.response import success_response
from database.session import get_db
from middleware.auth import require_role
from core.pagination import Page
from models import Mechanic, RepairTicket, Vehicle, ServiceVisit
from schemas.repair import (
    RepairItemToggle,
    RepairTicketCreate,
    RepairTicketResponse,
    RepairTicketUpdate,
)
from services.repair_service import (
    assigned_mechanic,
    authorize_ticket,
    lock_ticket,
    replace_items,
    sync_vehicle,
    transition,
)

router = APIRouter(prefix="/api/repairs", tags=["Repairs"])


def serialize(ticket):
    return RepairTicketResponse.model_validate(ticket).model_dump()


async def repair_page(db, page, query):
    if page.vehicle_id:
        query = query.where(RepairTicket.vehicleId == page.vehicle_id)
    if page.mechanic_id:
        query = query.where(RepairTicket.mechanicId == page.mechanic_id)
    base = query.order_by(None).subquery()
    rows = await db.execute(select(base.c.status, func.count(), func.sum(base.c.totalAmount)).group_by(base.c.status))
    counts, amounts = {}, {}
    for status, count, amount in rows:
        counts[status], amounts[status] = count, float(amount or 0)
    from datetime import datetime, timedelta
    local = utcnow() + timedelta(hours=7)
    start = datetime(local.year, local.month, 1) - timedelta(hours=7)
    end = datetime(local.year + (local.month == 12), 1 if local.month == 12 else local.month + 1, 1) - timedelta(hours=7)
    month = await db.scalar(select(func.coalesce(func.sum(base.c.totalAmount), 0)).where(base.c.status == "paid", base.c.paidAt >= start, base.c.paidAt < end))
    if page.q:
        query = query.where(RepairTicket.vehicle.has(Vehicle.licensePlate.icontains(page.q, autoescape=True) | Vehicle.customerName.icontains(page.q, autoescape=True)) | RepairTicket.mechanicName.icontains(page.q, autoescape=True))
    query = query.options(selectinload(RepairTicket.vehicle).lazyload(Vehicle.repairTickets))
    if page.status:
        statuses = page.status.split(",")
        if set(statuses) - {"draft", "working", "completed", "paid"}:
            raise HTTPException(422, "Trạng thái phiếu không hợp lệ")
        query = query.where(RepairTicket.status.in_(statuses))
    return await page.fetch(db, query, RepairTicket.id, serialize, {"counts": counts, "amounts": amounts, "monthRevenue": float(month)})


@router.get("/my-tasks")
async def my_tasks(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(Role.MECHANIC, Role.ADMIN)),
    page: Page = Depends(),
):
    query = (
        select(RepairTicket)
        .join(Mechanic, RepairTicket.mechanicId == Mechanic.id)
        .where(Mechanic.userId == user["id"], Mechanic.status == "active")
        .order_by(RepairTicket.createdAt.desc())
    )
    return await repair_page(db, page, query)


@router.get("/my-repairs")
async def my_repairs(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(Role.CUSTOMER)),
    page: Page = Depends(),
):
    query = (
        select(RepairTicket)
        .join(Vehicle)
        .where(Vehicle.customerId == user["id"])
        .order_by(RepairTicket.createdAt.desc())
    )
    return await repair_page(db, page, query)


@router.get("")
async def list_repairs(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.ADVISOR, Role.ACCOUNTANT)),
    page: Page = Depends(),
):
    query = select(RepairTicket)
    return await repair_page(db, page, query)


@router.get("/{ticket_id}")
async def get_repair(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role(
            Role.ADMIN, Role.MECHANIC, Role.CUSTOMER, Role.ADVISOR, Role.ACCOUNTANT
        )
    ),
):
    ticket = await db.get(RepairTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Không tìm thấy phiếu sửa chữa")
    await authorize_ticket(db, ticket, user)
    return success_response(serialize(ticket))


@router.post("")
async def create_repair(
    body: RepairTicketCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    vehicle = await db.scalar(
        select(Vehicle).where(Vehicle.id == body.vehicleId).with_for_update()
    )
    if not vehicle:
        raise HTTPException(404, "Không tìm thấy xe")
    if vehicle.status == "delivered":
        raise HTTPException(409, "Cần tiếp nhận lại xe trước khi tạo phiếu")
    if await db.scalar(
        select(ServiceVisit.id).where(
            ServiceVisit.vehicleId == vehicle.id, ServiceVisit.status != "closed"
        )
    ):
        raise HTTPException(
            409, "Chuyển báo giá đã duyệt thành phiếu ở mục Cố vấn dịch vụ"
        )
    active = await db.scalar(
        select(RepairTicket.id).where(
            RepairTicket.vehicleId == vehicle.id, RepairTicket.status != "paid"
        )
    )
    if active:
        raise HTTPException(409, "Xe đã có phiếu chưa thanh toán")
    mechanic = await assigned_mechanic(db, body.mechanicId)
    ticket = RepairTicket(
        vehicle=vehicle,
        mechanicId=body.mechanicId,
        mechanicName=mechanic.fullName if mechanic else "Chưa phân công",
        status="draft",
        items=[],
    )
    db.add(ticket)
    await db.flush()
    await replace_items(db, ticket, body.items)
    await sync_vehicle(db, vehicle)
    await db.commit()
    await db.refresh(ticket)
    return success_response(
        serialize(ticket), "Tạo phiếu và xuất vật tư thành công", 201
    )


@router.put("/{ticket_id}")
async def update_repair(
    ticket_id: int,
    body: RepairTicketUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role(Role.ADMIN, Role.MECHANIC, Role.ADVISOR, Role.ACCOUNTANT)
    ),
):
    ticket = await lock_ticket(db, ticket_id)
    await authorize_ticket(db, ticket, user)
    fields = body.model_fields_set
    if (
        ticket.status == "paid"
        and body.status == "paid"
        and fields & {"paymentMethod", "paymentReference"}
    ):
        from models import PaymentReceipt

        receipt = await db.scalar(
            select(PaymentReceipt).where(PaymentReceipt.ticketId == ticket.id)
        )
        if (
            not receipt
            or ("paymentMethod" in fields and receipt.method != body.paymentMethod)
            or (
                "paymentReference" in fields
                and receipt.reference != body.paymentReference.strip()
            )
        ):
            raise HTTPException(
                409, "Phiếu đã thu; không được sửa phương thức hoặc mã giao dịch"
            )
    if (
        user["role"] == "admin"
        and body.status != "paid"
        and "workshop" not in user["permissions"]
    ):
        raise HTTPException(403, "Chức năng sửa chữa đã bị khóa")
    if body.status == "paid" and "finance" not in user["permissions"]:
        raise HTTPException(403, "Chức năng thu tiền đã bị khóa")
    if fields & {"paymentMethod", "paymentReference"} and body.status != "paid":
        raise HTTPException(422, "Thông tin thanh toán chỉ được gửi khi thu tiền")
    if user["role"] == "accountant" and (
        fields - {"status", "paymentMethod", "paymentReference"}
        or body.status != "paid"
    ):
        raise HTTPException(403, "Kế toán chỉ được thu tiền phiếu đã hoàn thành")
    if user["role"] == "advisor" and fields != {"mechanicId"}:
        raise HTTPException(
            403, "Cố vấn chỉ cập nhật phân công; thu tiền tại bộ phận kế toán"
        )
    if ticket.serviceVisitId and "items" in fields:
        raise HTTPException(409, "Giữ nguyên các hạng mục khách đã duyệt")
    if user["role"] == "mechanic" and (
        fields - {"status"} or body.status not in ("working", "completed")
    ):
        raise HTTPException(403, "Thợ chỉ được bắt đầu hoặc hoàn thành phiếu được giao")
    if fields & {"items", "mechanicId"}:
        legacy_link = (
            ticket.mechanicId is None
            and fields == {"mechanicId"}
            and body.mechanicId is not None
        )
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
            if any(
                item.inventoryId is None and item.partPrice > 0 for item in ticket.items
            ):
                raise HTTPException(
                    409,
                    "Phiếu cũ có vật tư chưa liên kết. Giữ nguyên hạng mục; chỉ cập nhật phân công.",
                )
            await replace_items(db, ticket, body.items)
    if body.status:
        await transition(
            db,
            ticket,
            body.status.value,
            user,
            body.paymentMethod,
            body.paymentReference,
        )
    await db.commit()
    await db.refresh(ticket)
    return success_response(serialize(ticket), "Cập nhật phiếu thành công")


@router.delete("/{ticket_id}")
async def delete_repair(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    ticket = await lock_ticket(db, ticket_id)
    if ticket.status != "draft":
        raise HTTPException(409, "Chỉ được xóa phiếu chưa bắt đầu sửa")
    if ticket.serviceVisitId:
        raise HTTPException(
            409, "Phiếu đã liên kết báo giá không được xóa; giữ lịch sử xác nhận"
        )
    vehicle = ticket.vehicle
    await replace_items(db, ticket, [])
    await db.delete(ticket)
    await sync_vehicle(db, vehicle)
    await db.commit()
    return success_response(None, "Đã xóa phiếu và hoàn vật tư về kho")


@router.put("/{ticket_id}/items/{item_id}/toggle")
async def toggle_item(
    ticket_id: int,
    item_id: int,
    body: RepairItemToggle,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    ticket = await lock_ticket(db, ticket_id)
    await authorize_ticket(db, ticket, user)
    if ticket.status != "working":
        raise HTTPException(409, "Chỉ cập nhật hạng mục khi phiếu đang sửa")
    item = next((item for item in ticket.items if item.id == item_id), None)
    if not item:
        raise HTTPException(404, "Không tìm thấy hạng mục")
    if body.isCompleted:
        from services.evidence_service import (
            require_item_evidence,
            check_ev_certificate,
        )
        from models import Inventory

        await check_ev_certificate(
            db,
            user,
            await db.get(Inventory, item.inventoryId) if item.inventoryId else None,
        )
        await require_item_evidence(db, item)
    elif item.isCompleted:
        item.evidenceRound += 1
    item.isCompleted = body.isCompleted
    item.completedAt = utcnow() if body.isCompleted else None
    await db.commit()
    return success_response(serialize(ticket), "Đã cập nhật tiến độ")


@router.get("/{ticket_id}/can-complete")
async def can_complete(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(Role.ADMIN, Role.MECHANIC)),
):
    ticket = await db.get(RepairTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Không tìm thấy phiếu sửa chữa")
    await authorize_ticket(db, ticket, user)
    total = len(ticket.items)
    done = sum(item.isCompleted for item in ticket.items)
    return success_response(
        {
            "canComplete": ticket.status == "working" and total > 0 and total == done,
            "totalItems": total,
            "completedItems": done,
            "incompleteItems": total - done,
        }
    )
