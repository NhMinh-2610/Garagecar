"""HR scheduling, verified qualifications and leave decisions."""

from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.response import success_response
from core.time import utcnow
from database.session import get_db
from middleware.auth import get_current_user, require_permission
from models import LeaveRequest, StaffCertificate, StaffShift, User
from schemas.professional import CertificateInput, DecisionInput, LeaveInput, ShiftInput
from services.maintenance_service import row_dict

router = APIRouter(prefix="/api/hr", tags=["HR operations"])


def staff(user):
    if user["role"] == "customer":
        raise HTTPException(403, "Chỉ dành cho nhân viên garage")
    if user["role"] == "hr" and "hr" not in user["permissions"]:
        raise HTTPException(403, "Chức năng nhân sự đã bị khóa")


async def employee(db, user_id):
    row = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not row or row.role == "customer" or not row.isActive:
        raise HTTPException(404, "Không tìm thấy nhân viên đang hoạt động")
    return row


@router.get("/operations")
async def operations(
    db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    staff(user)
    result = {}
    for key, model in (
        ("shifts", StaffShift),
        ("certificates", StaffCertificate),
        ("leave", LeaveRequest),
    ):
        query = select(model).order_by(model.id.desc()).limit(1000)
        if "hr" not in user["permissions"]:
            query = query.where(model.userId == user["id"])
        result[key] = [row_dict(r) for r in (await db.scalars(query)).all()]
    return success_response(result)


@router.post("/shifts")
async def create_shift(
    body: ShiftInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("hr")),
):
    await employee(db, body.userId)  # Serializes overlapping inserts per employee.
    if await db.scalar(
        select(StaffShift.id).where(
            StaffShift.userId == body.userId,
            StaffShift.status == "scheduled",
            StaffShift.startsAt < body.endsAt,
            StaffShift.endsAt > body.startsAt,
        )
    ):
        raise HTTPException(409, "Ca làm bị trùng với lịch đã phân công")
    start_day = (body.startsAt + timedelta(hours=7)).date()
    end_day = (body.endsAt + timedelta(hours=7) - timedelta(microseconds=1)).date()
    if await db.scalar(
        select(LeaveRequest.id).where(
            LeaveRequest.userId == body.userId,
            LeaveRequest.status == "approved",
            LeaveRequest.fromDate <= end_day,
            LeaveRequest.toDate >= start_day,
        )
    ):
        raise HTTPException(409, "Nhân viên đã được duyệt nghỉ trong khoảng này")
    row = StaffShift(**body.model_dump(), createdBy=user["id"])
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(row_dict(row), "Đã phân ca", 201)


@router.post("/shifts/{shift_id}/cancel")
async def cancel_shift(
    shift_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("hr")),
):
    row = await db.scalar(
        select(StaffShift).where(StaffShift.id == shift_id).with_for_update()
    )
    if not row or row.status != "scheduled":
        raise HTTPException(409, "Ca làm không còn hoạt động")
    row.status = "cancelled"
    await db.commit()
    return success_response(None, "Đã hủy phân ca, giữ lịch sử")


@router.post("/certificates")
async def create_certificate(
    body: CertificateInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("hr")),
):
    await employee(db, body.userId)
    if body.userId == user["id"]:
        raise HTTPException(409, "Không tự xác minh chứng chỉ của mình")
    row = StaffCertificate(**body.model_dump(), verifiedBy=user["id"])
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(row_dict(row), "Đã lưu hồ sơ chứng chỉ được xác minh", 201)


@router.post("/leave")
async def request_leave(
    body: LeaveInput, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    staff(user)
    await employee(db, user["id"])
    if await db.scalar(
        select(LeaveRequest.id).where(
            LeaveRequest.userId == user["id"],
            LeaveRequest.status.in_(["pending", "approved"]),
            LeaveRequest.fromDate <= body.toDate,
            LeaveRequest.toDate >= body.fromDate,
        )
    ):
        raise HTTPException(409, "Khoảng nghỉ bị trùng với yêu cầu trước")
    row = LeaveRequest(**body.model_dump(), userId=user["id"])
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(row_dict(row), "Đã gửi yêu cầu nghỉ", 201)


@router.post("/certificates/{certificate_id}/revoke")
async def revoke_certificate(
    certificate_id: int,
    body: DecisionInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("hr")),
):
    row = await db.scalar(
        select(StaffCertificate)
        .where(StaffCertificate.id == certificate_id)
        .with_for_update()
    )
    if not row or row.status != "verified":
        raise HTTPException(409, "Chứng chỉ không còn hiệu lực để thu hồi")
    if row.userId == user["id"]:
        raise HTTPException(409, "Hồ sơ của mình cần người khác xử lý")
    row.status, row.revokedBy, row.revokedAt, row.revokeReason = (
        "revoked",
        user["id"],
        utcnow(),
        body.note,
    )
    await db.commit()
    return success_response(None, "Đã thu hồi chứng chỉ, giữ lịch sử xác minh")


@router.post("/leave/{leave_id}/decide")
async def decide_leave(
    leave_id: int,
    body: DecisionInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("hr")),
):
    row = await db.scalar(
        select(LeaveRequest).where(LeaveRequest.id == leave_id).with_for_update()
    )
    if not row or row.status != "pending":
        raise HTTPException(409, "Yêu cầu không còn chờ duyệt")
    if row.userId == user["id"]:
        raise HTTPException(409, "Không tự duyệt nghỉ của mình")
    await employee(db, row.userId)
    start = datetime.combine(row.fromDate, time.min) - timedelta(hours=7)
    end = datetime.combine(row.toDate + timedelta(days=1), time.min) - timedelta(
        hours=7
    )
    if body.approved and await db.scalar(
        select(StaffShift.id).where(
            StaffShift.userId == row.userId,
            StaffShift.status == "scheduled",
            StaffShift.startsAt < end,
            StaffShift.endsAt > start,
        )
    ):
        raise HTTPException(409, "Cần hủy hoặc phân lại ca trước khi duyệt nghỉ")
    row.status = "approved" if body.approved else "rejected"
    row.decidedBy, row.decidedAt, row.decisionNote = user["id"], utcnow(), body.note
    await db.commit()
    return success_response(row_dict(row), "Đã xử lý yêu cầu nghỉ")
