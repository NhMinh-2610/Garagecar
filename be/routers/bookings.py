from datetime import date, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.constants import Role
from core.response import success_response
from core.time import utcnow
from database.session import get_db
from middleware.auth import require_role
from models.booking import Booking
from schemas.common import Name

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


class BookingCreate(BaseModel):
    customerName: Name
    phone: Name
    service: Name
    note: str = Field(default="", max_length=2000)
    preferredDate: date

    @field_validator("preferredDate")
    @classmethod
    def future_date(cls, value):
        if value < (utcnow() + timedelta(hours=7)).date():
            raise ValueError("Ngày hẹn không được nằm trong quá khứ")
        return value


class BookingUpdate(BaseModel):
    status: Literal["pending", "confirmed", "cancelled"]


@router.post("")
async def create_booking(body: BookingCreate, db: AsyncSession = Depends(get_db)):
    booking = Booking(**body.model_dump())
    db.add(booking)
    await db.commit()
    return success_response({"id": booking.id}, "Đã nhận yêu cầu. Garage sẽ liên hệ xác nhận lịch hẹn.", 201)


@router.get("")
async def list_bookings(db: AsyncSession = Depends(get_db), _: dict = Depends(require_role(Role.ADMIN, Role.ADVISOR))):
    rows = await db.scalars(select(Booking).order_by(Booking.createdAt.desc()).limit(500))
    return success_response([{column.name: getattr(row, column.name) for column in Booking.__table__.columns} for row in rows])


@router.put("/{booking_id}")
async def update_booking(booking_id: int, body: BookingUpdate, db: AsyncSession = Depends(get_db),
                         _: dict = Depends(require_role(Role.ADMIN, Role.ADVISOR))):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(404, "Không tìm thấy lịch hẹn")
    booking.status = body.status
    await db.commit()
    return success_response(None, "Đã cập nhật lịch hẹn")
