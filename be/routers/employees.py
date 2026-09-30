"""Staff records without account-granting or payroll permissions."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.session import get_db
from middleware.auth import require_permission
from core.response import success_response
from models import EmployeeProfile, User
from schemas.garage_care import EmployeeInput
from services.maintenance_service import row_dict

router = APIRouter(prefix="/api/service", tags=["Staff records"])


@router.get("/employees")
async def employees(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("hr"))
):
    users = (
        await db.scalars(select(User).where(User.role != "customer").order_by(User.id))
    ).all()
    profiles = {p.userId: p for p in (await db.scalars(select(EmployeeProfile))).all()}
    return success_response(
        [
            {
                "id": u.id,
                "fullName": u.fullName,
                "email": u.email,
                "role": u.role,
                "isActive": u.isActive,
                "profile": row_dict(profiles[u.id]) if u.id in profiles else None,
            }
            for u in users
        ]
    )


@router.put("/employees/{user_id}")
async def employee(
    user_id: int,
    body: EmployeeInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("hr")),
):
    target = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not target or target.role == "customer":
        raise HTTPException(404, "Không tìm thấy nhân viên")
    profile = await db.get(EmployeeProfile, user_id)
    if profile:
        for k, v in body.model_dump().items():
            setattr(profile, k, v)
        profile.updatedBy = user["id"]
    else:
        db.add(
            EmployeeProfile(userId=user_id, updatedBy=user["id"], **body.model_dump())
        )
    await db.commit()
    return success_response(None, "Đã lưu hồ sơ nhân sự")
