from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from core.constants import Role
from core.response import success_response
from database.session import get_db
from middleware.auth import require_role
from models import RepairTicket, Vehicle

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/revenue")
async def revenue(month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
                  db: AsyncSession = Depends(get_db), _: dict = Depends(require_role(Role.ADMIN))):
    year, number = map(int, month.split("-"))
    if not 1 <= year <= 9998:
        from fastapi import HTTPException
        raise HTTPException(422, "Năm không hợp lệ")
    start = datetime(year, number, 1) - timedelta(hours=7)
    end = datetime(year + (number == 12), 1 if number == 12 else number + 1, 1) - timedelta(hours=7)
    rows = await db.execute(select(Vehicle.carBrand, func.count(RepairTicket.id), func.sum(RepairTicket.totalAmount))
                            .join(Vehicle, RepairTicket.vehicleId == Vehicle.id)
                            .where(RepairTicket.status == "paid", RepairTicket.paidAt >= start, RepairTicket.paidAt < end)
                            .group_by(Vehicle.carBrand))
    return success_response([{"brand": brand, "count": count, "revenue": float(amount)} for brand, count, amount in rows])
