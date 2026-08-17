from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.engine import Base


class RepairTicket(Base):
    """
    Repair ticket (phiếu sửa chữa) linking a vehicle to a list of repair items.
    Tracks status transitions: draft → working → completed → paid.
    """

    __tablename__ = "repair_tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vehicleId = Column(
        "vehicleId", Integer, ForeignKey("vehicles.id"), nullable=False, index=True
    )
    totalAmount = Column("totalAmount", Numeric(10, 2), nullable=False, default=0)
    mechanicName = Column("mechanicName", String, nullable=True, default="Chưa phân công")
    status = Column(String, nullable=False, default="draft")  # draft|working|completed|paid
    startedAt = Column("startedAt", DateTime, nullable=True)
    completedAt = Column("completedAt", DateTime, nullable=True)
    paidAt = Column("paidAt", DateTime, nullable=True)
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    vehicle = relationship("Vehicle", back_populates="repairTickets", lazy="selectin")
    items = relationship(
        "RepairItem", back_populates="ticket", lazy="selectin", cascade="all, delete-orphan"
    )
