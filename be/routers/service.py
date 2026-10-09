"""Intake → preliminary consent → diagnosis → final approval → workshop → QC."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.response import success_response
from core.time import utcnow
from database.session import get_db
from middleware.auth import get_current_user, require_permission
from models import (
    Inventory,
    Mechanic,
    RepairTicket,
    ServiceQuote,
    ServiceVisit,
    Vehicle,
)
from schemas.garage_care import (
    ConvertInput,
    DiagnosisInput,
    QCInput,
    QuoteDecision,
    QuoteInput,
    VisitInput,
)
from schemas.repair import RepairItemCreate
from services.maintenance_service import row_dict
from services.repair_service import assigned_mechanic, replace_items, sync_vehicle

router = APIRouter(prefix="/api/service", tags=["Service workflow"])


def advisor(user):
    if (
        user["role"] not in ("admin", "advisor")
        or "workshop" not in user["permissions"]
    ):
        raise HTTPException(403, "Cần quyền cố vấn dịch vụ")


async def access(db, visit, user, diagnosis=False):
    vehicle = await db.get(Vehicle, visit.vehicleId)
    if user["role"] in ("admin", "advisor") and "workshop" in user["permissions"]:
        return vehicle
    if (
        not diagnosis
        and user["role"] == "customer"
        and vehicle.customerId == user["id"]
    ):
        return vehicle
    if (
        not diagnosis
        and user["role"] == "accountant"
        and "finance" in user["permissions"]
    ):
        return vehicle
    if user["role"] == "mechanic" and "workshop" in user["permissions"]:
        m = await db.get(Mechanic, visit.mechanicId) if visit.mechanicId else None
        if m and m.userId == user["id"] and m.status == "active":
            return vehicle
    raise HTTPException(403, "Không có quyền truy cập lượt dịch vụ")


async def lock_visit(db, visit_id):
    vid = await db.scalar(
        select(ServiceVisit.vehicleId).where(ServiceVisit.id == visit_id)
    )
    if vid is None:
        raise HTTPException(404, "Không tìm thấy lượt dịch vụ")
    await db.scalar(select(Vehicle).where(Vehicle.id == vid).with_for_update())
    return await db.scalar(
        select(ServiceVisit).where(ServiceVisit.id == visit_id).with_for_update()
    )


async def detail(db, visit):
    quotes = (
        await db.scalars(
            select(ServiceQuote)
            .where(ServiceQuote.visitId == visit.id)
            .order_by(ServiceQuote.revision)
        )
    ).all()
    ticket = await db.scalar(
        select(RepairTicket).where(RepairTicket.serviceVisitId == visit.id)
    )
    vehicle = await db.get(Vehicle, visit.vehicleId)
    return {
        **row_dict(visit),
        "licensePlate": vehicle.licensePlate,
        "vehicleStatus": vehicle.status,
        "customerId": vehicle.customerId,
        "quotes": [row_dict(q) for q in quotes],
        "ticketId": ticket.id if ticket else None,
        "ticketStatus": ticket.status if ticket else None,
    }


@router.get("/visits")
async def visits(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    query = select(ServiceVisit).join(Vehicle, Vehicle.id == ServiceVisit.vehicleId)
    if user["role"] == "customer":
        query = query.where(Vehicle.customerId == user["id"])
    elif user["role"] == "mechanic" and "workshop" in user["permissions"]:
        query = query.join(Mechanic, Mechanic.id == ServiceVisit.mechanicId).where(
            Mechanic.userId == user["id"], Mechanic.status == "active"
        )
    elif user["role"] == "accountant" and "finance" in user["permissions"]:
        pass
    else:
        advisor(user)
    rows = (await db.scalars(query.order_by(ServiceVisit.id.desc()).limit(100))).all()
    result = [await detail(db, r) for r in rows]
    if user["role"] == "accountant":
        keys = (
            "id",
            "vehicleId",
            "licensePlate",
            "ticketId",
            "ticketStatus",
            "qcAt",
            "status",
        )
        result = [{key: row[key] for key in keys} for row in result]
    return success_response(result)


@router.post("/visits", status_code=201)
async def intake(
    body: VisitInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("workshop")),
):
    advisor(user)
    vehicle = await db.scalar(
        select(Vehicle).where(Vehicle.id == body.vehicleId).with_for_update()
    )
    if not vehicle:
        raise HTTPException(404, "Không tìm thấy xe")
    if vehicle.status == "delivered":
        raise HTTPException(409, "Tiếp nhận lại xe trước khi tạo lượt dịch vụ")
    if await db.scalar(
        select(ServiceVisit.id).where(
            ServiceVisit.vehicleId == vehicle.id, ServiceVisit.status != "closed"
        )
    ):
        raise HTTPException(409, "Xe đang có lượt dịch vụ chưa kết thúc")
    if await db.scalar(
        select(RepairTicket.id).where(
            RepairTicket.vehicleId == vehicle.id, RepairTicket.status != "paid"
        )
    ):
        raise HTTPException(409, "Xe đã có phiếu sửa chữa chưa thanh toán")
    await assigned_mechanic(db, body.mechanicId)
    visit = ServiceVisit(advisorId=user["id"], status="intake", **body.model_dump())
    db.add(visit)
    await db.commit()
    return success_response(await detail(db, visit), "Đã ghi kiểm tra đầu vào", 201)


@router.put("/visits/{visit_id}/diagnosis")
async def diagnosis(
    visit_id: int,
    body: DiagnosisInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("workshop")),
):
    visit = await lock_visit(db, visit_id)
    await access(db, visit, user, diagnosis=True)
    if visit.status not in ("diagnosis", "awaiting_approval", "ready"):
        raise HTTPException(
            409, "Cần khách xác nhận báo giá sơ bộ trước khi kiểm tra kỹ"
        )
    # A changed diagnosis invalidates any unconverted final quote.
    quotes = (
        await db.scalars(
            select(ServiceQuote).where(
                ServiceQuote.visitId == visit.id, ServiceQuote.stage == "final"
            )
        )
    ).all()
    for quote in quotes:
        if quote.status in ("pending", "approved"):
            quote.status = "superseded"
    visit.diagnosis = body.diagnosis
    visit.status = "diagnosis"
    await db.commit()
    return success_response(await detail(db, visit), "Đã lưu chẩn đoán")


@router.post("/visits/{visit_id}/quotes", status_code=201)
async def quote(
    visit_id: int,
    body: QuoteInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("workshop")),
):
    advisor(user)
    visit = await lock_visit(db, visit_id)
    if body.stage == "preliminary" and visit.status != "intake":
        raise HTTPException(409, "Báo giá sơ bộ chỉ lập trước khi kiểm tra kỹ")
    if body.stage == "final" and (
        not visit.diagnosis
        or visit.status not in ("diagnosis", "awaiting_approval", "ready")
    ):
        raise HTTPException(409, "Cần chẩn đoán trước khi lập báo giá chính thức")
    ids = sorted({i.inventoryId for i in body.items if i.inventoryId})
    stock = (
        {
            s.id: s
            for s in (
                await db.scalars(
                    select(Inventory)
                    .where(Inventory.id.in_(ids))
                    .order_by(Inventory.id)
                    .with_for_update()
                )
            ).all()
        }
        if ids
        else {}
    )
    rows, total = [], Decimal(0)
    for item in body.items:
        part = stock.get(item.inventoryId)
        if item.inventoryId and part is None:
            raise HTTPException(422, "Vật tư không tồn tại")
        price = Decimal(part.unitPrice) if part else Decimal(0)
        value = price * item.quantity + Decimal(item.laborPrice)
        total += value
        rows.append(
            {
                **item.model_dump(mode="json"),
                "partName": part.name if part else "---",
                "partPrice": str(price),
                "totalPrice": str(value),
            }
        )
    if total >= Decimal("1000000000000"):
        raise HTTPException(422, "Báo giá vượt giới hạn")
    previous = (
        await db.scalars(select(ServiceQuote).where(ServiceQuote.visitId == visit.id))
    ).all()
    for old in previous:
        if old.stage == body.stage and old.status in ("pending", "approved"):
            old.status = "superseded"
    new = ServiceQuote(
        visitId=visit.id,
        revision=max((q.revision for q in previous), default=0) + 1,
        stage=body.stage,
        items=rows,
        totalAmount=total,
        status="pending",
    )
    db.add(new)
    if body.stage == "final":
        visit.status = "awaiting_approval"
    await db.commit()
    return success_response(
        row_dict(new), "Đã lưu phiên bản báo giá; chưa xuất kho", 201
    )


@router.post("/quotes/{quote_id}/decision")
async def decision(
    quote_id: int,
    body: QuoteDecision,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    visit_id = await db.scalar(
        select(ServiceQuote.visitId).where(ServiceQuote.id == quote_id)
    )
    if visit_id is None:
        raise HTTPException(404, "Không tìm thấy báo giá")
    visit = await lock_visit(db, visit_id)
    await access(db, visit, user)
    if user["role"] not in ("customer", "admin", "advisor"):
        raise HTTPException(403, "Không có quyền xác nhận báo giá")
    if user["role"] != "customer":
        advisor(user)
        if len(body.note.strip()) < 10:
            raise HTTPException(
                422, "Ghi cách liên hệ và nội dung khách đã xác nhận (ít nhất 10 ký tự)"
            )
    quote = await db.scalar(
        select(ServiceQuote).where(ServiceQuote.id == quote_id).with_for_update()
    )
    if quote.status != "pending":
        raise HTTPException(409, "Phiên bản báo giá này không còn chờ xác nhận")
    quote.status = "approved" if body.approved else "rejected"
    quote.decidedBy = user["id"]
    quote.decidedAt = utcnow()
    quote.decisionNote = body.note
    if quote.stage == "preliminary":
        visit.status = "diagnosis" if body.approved else "intake"
    else:
        visit.status = "ready" if body.approved else "diagnosis"
    await db.commit()
    return success_response(
        await detail(db, visit), "Đã ghi xác nhận đúng phiên bản báo giá"
    )


@router.post("/quotes/{quote_id}/convert", status_code=201)
async def convert(
    quote_id: int,
    body: ConvertInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("workshop")),
):
    advisor(user)
    visit_id = await db.scalar(
        select(ServiceQuote.visitId).where(ServiceQuote.id == quote_id)
    )
    if visit_id is None:
        raise HTTPException(404, "Không tìm thấy báo giá")
    visit = await lock_visit(db, visit_id)
    quote = await db.scalar(
        select(ServiceQuote).where(ServiceQuote.id == quote_id).with_for_update()
    )
    if quote.stage != "final" or quote.status != "approved" or visit.status != "ready":
        raise HTTPException(409, "Cần báo giá chính thức đã được khách duyệt")
    vehicle = await db.get(Vehicle, visit.vehicleId)
    if vehicle.status == "delivered" or await db.scalar(
        select(RepairTicket.id).where(
            RepairTicket.vehicleId == vehicle.id, RepairTicket.status != "paid"
        )
    ):
        raise HTTPException(409, "Xe đã giao hoặc đang có phiếu chưa thanh toán")
    mechanic = await assigned_mechanic(db, body.mechanicId)
    if not mechanic.userId:
        raise HTTPException(409, "Cấp tài khoản cho thợ trước khi chuyển vào xưởng")
    ids = sorted({r["inventoryId"] for r in quote.items if r.get("inventoryId")})
    stock = (
        {
            r.id: r
            for r in (
                await db.scalars(
                    select(Inventory)
                    .where(Inventory.id.in_(ids))
                    .order_by(Inventory.id)
                    .with_for_update()
                )
            ).all()
        }
        if ids
        else {}
    )
    for row in quote.items:
        if row.get("inventoryId"):
            part = stock.get(row["inventoryId"])
            if (
                not part
                or Decimal(part.unitPrice) != Decimal(row["partPrice"])
                or part.name != row["partName"]
            ):
                raise HTTPException(
                    409, "Tên / giá vật tư đã thay đổi; lập và xác nhận lại báo giá"
                )
    ticket = RepairTicket(
        vehicle=vehicle,
        serviceVisitId=visit.id,
        mechanicId=mechanic.id,
        mechanicName=mechanic.fullName,
        status="draft",
        items=[],
    )
    db.add(ticket)
    await db.flush()
    items = [
        RepairItemCreate(
            taskName=r["taskName"],
            inventoryId=r.get("inventoryId"),
            quantity=r["quantity"],
            laborPrice=r["laborPrice"],
        )
        for r in quote.items
    ]
    await replace_items(db, ticket, items)
    if ticket.totalAmount != quote.totalAmount:
        raise HTTPException(409, "Tổng tiền không khớp báo giá")
    visit.mechanicId = mechanic.id
    visit.status = "in_workshop"
    quote.status = "converted"
    await sync_vehicle(db, vehicle)
    await db.commit()
    return success_response(
        {"ticketId": ticket.id}, "Đã chuyển vào xưởng và xuất vật tư", 201
    )


@router.post("/visits/{visit_id}/qc")
async def qc(
    visit_id: int,
    body: QCInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("workshop")),
):
    advisor(user)
    visit = await lock_visit(db, visit_id)
    ticket = await db.scalar(
        select(RepairTicket).where(RepairTicket.serviceVisitId == visit.id)
    )
    if (
        not ticket
        or ticket.status not in ("completed", "paid")
        or not body.workVerified
        or not body.safetyChecked
    ):
        raise HTTPException(
            409, "Cần hoàn thành phiếu, kiểm tra công việc và kiểm tra an toàn"
        )
    if visit.qcAt:
        raise HTTPException(409, "Đã nghiệm thu")
    visit.qc = body.model_dump()
    visit.qcBy = user["id"]
    visit.qcAt = utcnow()
    visit.status = "qc_passed"
    await db.commit()
    return success_response(
        await detail(db, visit), "Đã nghiệm thu; chuyển bộ phận thu tiền"
    )


@router.post("/visits/{visit_id}/cancel")
async def cancel(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("workshop")),
):
    advisor(user)
    visit = await lock_visit(db, visit_id)
    if await db.scalar(
        select(RepairTicket.id).where(RepairTicket.serviceVisitId == visit_id)
    ):
        raise HTTPException(409, "Lượt đã có phiếu sửa chữa không được hủy")
    for q in (
        await db.scalars(
            select(ServiceQuote).where(
                ServiceQuote.visitId == visit_id,
                ServiceQuote.status.in_(["pending", "approved"]),
            )
        )
    ).all():
        q.status = "superseded"
    visit.status = "closed"
    await db.commit()
    return success_response(None, "Đã kết thúc lượt chưa sửa chữa")


@router.get("/resources")
async def resources(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("workshop"))
):
    advisor(user)
    vehicles = await db.scalars(select(Vehicle).order_by(Vehicle.id.desc()))
    mechanics = await db.scalars(
        select(Mechanic).where(Mechanic.status == "active").order_by(Mechanic.fullName)
    )
    parts = await db.scalars(select(Inventory).order_by(Inventory.name))
    return success_response(
        {
            "vehicles": [
                {
                    "id": v.id,
                    "licensePlate": v.licensePlate,
                    "customerName": v.customerName,
                    "status": v.status,
                }
                for v in vehicles
            ],
            "mechanics": [{"id": m.id, "fullName": m.fullName} for m in mechanics],
            "inventory": [
                {
                    "id": p.id,
                    "name": p.name,
                    "unitPrice": float(p.unitPrice),
                    "quantity": p.quantity,
                    "sku": p.sku,
                    "fitments": p.fitments,
                    "highVoltage": p.highVoltage,
                }
                for p in parts
            ],
        }
    )


@router.put("/visits/{visit_id}/assignment")
async def assign_diagnosis(
    visit_id: int,
    body: ConvertInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("workshop")),
):
    advisor(user)
    visit = await lock_visit(db, visit_id)
    if visit.status in ("in_workshop", "qc_passed", "closed"):
        raise HTTPException(
            409, "Lượt đã chuyển phiếu; cập nhật phân công tại phiếu sửa chữa"
        )
    mechanic = await assigned_mechanic(db, body.mechanicId)
    if not mechanic.userId:
        raise HTTPException(409, "Cấp tài khoản cho thợ trước khi giao kiểm tra kỹ")
    visit.mechanicId = mechanic.id
    await db.commit()
    return success_response(await detail(db, visit), "Đã phân công kiểm tra kỹ")
