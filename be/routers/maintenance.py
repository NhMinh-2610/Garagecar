"""Maintenance catalogue, exact scopes and reviewed customer reminders."""

import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.session import get_db
from middleware.auth import get_current_user, require_permission
from models import (
    Vehicle,
    VehicleCare,
    MaintenanceProfile,
    MaintenanceRecord,
    MaintenanceReminder,
    RepairTicket,
)
from schemas.garage_care import ProfileInput, CareInput, RecordInput
from services.maintenance_service import (
    vehicle_access,
    schedule,
    row_dict,
    matches,
    scan_reminders,
)
from core.response import success_response
from core.time import utcnow

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])
CATALOG = Path(__file__).resolve().parents[1] / "data" / "maintenance_catalog.json"


@router.get("/catalog")
async def catalog(_: dict = Depends(get_current_user)):
    return success_response(json.loads(CATALOG.read_text(encoding="utf-8")))


@router.get("/profiles")
async def profiles(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("maintenance"))
):
    if user["role"] not in ("admin", "advisor"):
        raise HTTPException(403, "Chỉ quản trị / cố vấn quản lý lịch hãng")
    rows = await db.scalars(
        select(MaintenanceProfile).order_by(MaintenanceProfile.id.desc())
    )
    return success_response([row_dict(r) for r in rows])


@router.post("/profiles", status_code=201)
async def create_profile(
    body: ProfileInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("maintenance")),
):
    if user["role"] not in ("admin", "advisor"):
        raise HTTPException(403, "Không có quyền lập lịch hãng")
    catalog_data = json.loads(CATALOG.read_text(encoding="utf-8"))
    codes = {c["code"] for c in catalog_data["components"]}
    if any(r.component not in codes for r in body.rules):
        raise HTTPException(422, "Bộ phận chưa có trong danh mục")
    data = body.model_dump(mode="json")
    profile = MaintenanceProfile(**data, status="draft")
    db.add(profile)
    await db.commit()
    return success_response(
        row_dict(profile),
        "Đã lưu bản nháp; cần kiểm tra đúng sách và phiên bản xe",
        201,
    )


@router.post("/profiles/{profile_id}/approve")
async def approve(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("catalog")),
):
    profile = await db.scalar(
        select(MaintenanceProfile)
        .where(MaintenanceProfile.id == profile_id)
        .with_for_update()
    )
    if not profile:
        raise HTTPException(404, "Không tìm thấy lịch")
    if any(
        "CẦN XÁC MINH" in str(profile.scope[k]).upper() for k in ("engine", "gearbox")
    ):
        raise HTTPException(
            409, "Điền đúng mã động cơ/hộp số từ sách trước khi xác minh"
        )
    if profile.status != "draft":
        raise HTTPException(409, "Lịch đã được xác minh; tạo phiên bản mới khi cần sửa")
    profile.status = "approved"
    profile.approvedBy = user["id"]
    profile.approvedAt = utcnow()
    await db.commit()
    return success_response(row_dict(profile), "Đã xác minh lịch theo tài liệu hãng")


@router.get("/vehicles")
async def care_vehicles(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("maintenance"))
):
    query = select(Vehicle).order_by(Vehicle.id.desc())
    if user["role"] == "customer":
        query = query.where(Vehicle.customerId == user["id"])
    elif user["role"] == "mechanic":
        from models import Mechanic

        query = query.where(
            Vehicle.id.in_(
                select(RepairTicket.vehicleId)
                .join(Mechanic, RepairTicket.mechanicId == Mechanic.id)
                .where(Mechanic.userId == user["id"], Mechanic.status == "active")
            )
        )
    rows = (await db.scalars(query)).all()
    return success_response(
        [
            {
                "id": v.id,
                "licensePlate": v.licensePlate,
                "carBrand": v.carBrand,
                "carModel": v.carModel,
            }
            for v in rows
        ]
    )


@router.get("/vehicles/{vehicle_id}")
async def vehicle_schedule(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("maintenance")),
):
    vehicle = await vehicle_access(db, vehicle_id, user)
    return success_response(await schedule(db, vehicle))


@router.put("/vehicles/{vehicle_id}")
async def save_care(
    vehicle_id: int,
    body: CareInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("maintenance")),
):
    vehicle = await vehicle_access(db, vehicle_id, user, write=True)
    await db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id).with_for_update())
    care = await db.get(VehicleCare, vehicle_id)
    if care and (body.odometer < care.odometer or body.observedOn < care.observedOn):
        raise HTTPException(409, "ODO và ngày ghi nhận phải tiến về trước")
    earliest = await db.scalar(
        select(MaintenanceRecord.performedOn)
        .where(MaintenanceRecord.vehicleId == vehicle_id)
        .order_by(MaintenanceRecord.performedOn)
        .limit(1)
    )
    if earliest and body.firstUseDate > earliest:
        raise HTTPException(409, "Ngày dùng xe không được sau lịch sử bảo dưỡng")
    if body.vin and await db.scalar(
        select(VehicleCare.vehicleId).where(
            VehicleCare.vin == body.vin, VehicleCare.vehicleId != vehicle_id
        )
    ):
        raise HTTPException(409, "VIN đã thuộc hồ sơ xe khác")
    candidate = VehicleCare(
        vehicleId=vehicle_id, updatedBy=user["id"], **body.model_dump()
    )
    if body.profileId:
        profile = await db.get(MaintenanceProfile, body.profileId)
        if (
            not profile
            or profile.status != "approved"
            or not matches(vehicle, candidate, profile.scope)
        ):
            raise HTTPException(
                409,
                "Lịch chưa được xác minh hoặc không khớp hãng, dòng, năm, động cơ, hộp số, thị trường, cách sử dụng",
            )
    if care:
        for key, value in body.model_dump().items():
            setattr(care, key, value)
        care.updatedBy = user["id"]
    else:
        db.add(candidate)
    await db.flush()
    await scan_reminders(db, [vehicle_id])
    await db.commit()
    return success_response(
        await schedule(db, vehicle), "Đã lưu hồ sơ và đối chiếu lịch"
    )


@router.post("/vehicles/{vehicle_id}/records", status_code=201)
async def record(
    vehicle_id: int,
    body: RecordInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("maintenance")),
):
    await vehicle_access(db, vehicle_id, user, write=True)
    await db.scalar(select(Vehicle).where(Vehicle.id == vehicle_id).with_for_update())
    care = await db.get(VehicleCare, vehicle_id)
    if not care or body.performedOn < care.firstUseDate:
        raise HTTPException(409, "Cần hồ sơ xe hợp lệ trước khi ghi lịch sử")
    codes = {
        c["code"] for c in json.loads(CATALOG.read_text(encoding="utf-8"))["components"]
    }
    if body.component not in codes:
        raise HTTPException(422, "Bộ phận không hợp lệ")
    if body.odometer > care.odometer or body.performedOn > care.observedOn:
        raise HTTPException(409, "Cập nhật ODO hiện tại trước khi ghi công việc")
    history = (
        await db.scalars(
            select(MaintenanceRecord).where(MaintenanceRecord.vehicleId == vehicle_id)
        )
    ).all()
    if any(
        (r.performedOn < body.performedOn and r.odometer > body.odometer)
        or (r.performedOn > body.performedOn and r.odometer < body.odometer)
        for r in history
    ):
        raise HTTPException(409, "ODO mâu thuẫn với lịch sử")
    if body.ticketId:
        ticket = await db.get(RepairTicket, body.ticketId)
        if (
            not ticket
            or ticket.vehicleId != vehicle_id
            or ticket.status not in ("completed", "paid")
        ):
            raise HTTPException(
                409, "Chỉ liên kết phiếu đã hoàn thành của chính xe này"
            )
    entry = MaintenanceRecord(
        vehicleId=vehicle_id, createdBy=user["id"], **body.model_dump()
    )
    db.add(entry)
    await db.flush()
    await scan_reminders(db)
    await db.commit()
    return success_response(row_dict(entry), "Đã ghi lịch sử bảo dưỡng", 201)


@router.post("/scan")
async def scan(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("maintenance"))
):
    if user["role"] not in ("admin", "advisor"):
        raise HTTPException(403, "Không có quyền quét nhắc hạn")
    count = await scan_reminders(db)
    await db.commit()
    return success_response({"evaluatedRules": count}, "Đã kiểm tra hạn bảo dưỡng")


@router.get("/reminders")
async def reminders(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("maintenance"))
):
    query = (
        select(MaintenanceReminder)
        .join(Vehicle, Vehicle.id == MaintenanceReminder.vehicleId)
        .where(MaintenanceReminder.status != "closed")
    )
    if user["role"] == "customer":
        query = query.where(
            Vehicle.customerId == user["id"], MaintenanceReminder.status == "published"
        )
    elif user["role"] == "mechanic":
        from models import Mechanic

        query = query.where(
            Vehicle.id.in_(
                select(RepairTicket.vehicleId)
                .join(Mechanic, Mechanic.id == RepairTicket.mechanicId)
                .where(Mechanic.userId == user["id"], Mechanic.status == "active")
            )
        )
    rows = await db.scalars(query.order_by(MaintenanceReminder.id.desc()).limit(200))
    return success_response([row_dict(r) for r in rows])


@router.post("/reminders/{reminder_id}/publish")
async def publish(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("maintenance")),
):
    if user["role"] not in ("admin", "advisor"):
        raise HTTPException(403, "Chỉ cố vấn / quản trị gửi nhắc hạn")
    # Re-evaluate this vehicle while holding the same lock as history updates.
    vehicle_id = await db.scalar(
        select(MaintenanceReminder.vehicleId).where(
            MaintenanceReminder.id == reminder_id
        )
    )
    if vehicle_id is None:
        raise HTTPException(404, "Không tìm thấy nhắc hạn")
    await scan_reminders(db, [vehicle_id])
    reminder = await db.scalar(
        select(MaintenanceReminder)
        .where(MaintenanceReminder.id == reminder_id)
        .with_for_update()
    )
    if not reminder:
        raise HTTPException(404, "Không tìm thấy nhắc hạn")
    if reminder.status != "pending":
        raise HTTPException(409, "Nhắc hạn đã gửi hoặc đã kết thúc")
    vehicle = await db.get(Vehicle, reminder.vehicleId)
    if not vehicle.customerId:
        raise HTTPException(409, "Liên kết tài khoản khách hàng trước khi gửi")
    reminder.status = "published"
    reminder.publishedBy = user["id"]
    reminder.publishedAt = utcnow()
    await db.commit()
    return success_response(
        row_dict(reminder), "Khách hàng có thể xem thông báo trong ứng dụng"
    )
