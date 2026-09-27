from sqlalchemy import Column, Integer, String, Date, DateTime
from sqlalchemy.sql import func
from database.engine import Base


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True)
    customerName = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    service = Column(String, nullable=False)
    note = Column(String, nullable=False, default="")
    preferredDate = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="pending")
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
