"""Advisor follow-through after vehicle handover."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.response import success_response
from database.session import get_db
from middleware.auth import require_permission
from models import RepairTicket, ServiceFollowup, ServiceVisit, Vehicle
from schemas.professional import FollowupInput
from services.maintenance_service import row_dict

router = APIRouter(prefix="/api/advisor", tags=["Advisor follow-up"])


@router.get("/followups")
async def followups(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("reception"))
):
    rows = (
        await db.scalars(
            select(ServiceFollowup).order_by(ServiceFollowup.id.desc()).limit(1000)
        )
    ).all()
    return success_response([row_dict(r) for r in rows])


@router.post("/visits/{visit_id}/followup")
async def create_followup(
    visit_id: int,
    body: FollowupInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("reception")),
):
    visit = await db.scalar(
        select(ServiceVisit).where(ServiceVisit.id == visit_id).with_for_update()
    )
    if not visit:
        raise HTTPException(404, "Không tìm thấy lượt dịch vụ")
    vehicle = await db.get(Vehicle, visit.vehicleId)
    ticket = await db.scalar(
        select(RepairTicket).where(RepairTicket.serviceVisitId == visit.id)
    )
    if (
        vehicle.status != "delivered"
        or not ticket
        or ticket.status != "paid"
        or not visit.qcAt
    ):
        raise HTTPException(409, "Chỉ chăm sóc sau sửa khi xe đã được giao")
    row = ServiceFollowup(visitId=visit.id, createdBy=user["id"], **body.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(row_dict(row), "Đã ghi nhận chăm sóc khách", 201)
