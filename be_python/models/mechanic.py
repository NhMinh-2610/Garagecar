from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from database.engine import Base


class Mechanic(Base):
    """
    Mechanic (technician) profile, separate from the User account.
    Stores skills and availability status for assignment logic.
    """

    __tablename__ = "mechanics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fullName = Column("fullName", String, nullable=False)
    phone = Column(String, nullable=True)
    specialty = Column(String, nullable=True, default="Chung")  # e.g. Máy gầm, Điện, Đồng sơn
    status = Column(String, nullable=False, default="active")   # active | inactive
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())
