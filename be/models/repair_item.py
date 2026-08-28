from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.engine import Base


class RepairItem(Base):
    """
    Individual line item within a RepairTicket.
    Tracks part cost, labour cost, completion status, and timestamps.
    """

    __tablename__ = "repair_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repairTicketId = Column(
        "repairTicketId", Integer, ForeignKey("repair_tickets.id"), nullable=False, index=True
    )
    taskName = Column("taskName", String, nullable=False)
    partName = Column("partName", String, nullable=True, default="---")
    quantity = Column(Integer, nullable=False, default=1)
    partPrice = Column("partPrice", Numeric(10, 2), nullable=False, default=0)
    laborPrice = Column("laborPrice", Numeric(10, 2), nullable=False, default=0)
    totalPrice = Column("totalPrice", Numeric(10, 2), nullable=False, default=0)
    isCompleted = Column("isCompleted", Boolean, nullable=False, default=False)
    completedAt = Column("completedAt", DateTime, nullable=True)
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    ticket = relationship("RepairTicket", back_populates="items")
