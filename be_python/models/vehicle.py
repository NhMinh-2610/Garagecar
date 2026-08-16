from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.engine import Base


class Vehicle(Base):
    """
    Vehicle registered at the garage.
    Linked to repair tickets via a one-to-many relationship.
    """

    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    licensePlate = Column("licensePlate", String, unique=True, nullable=False, index=True)
    customerName = Column("customerName", String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=True)
    carBrand = Column("carBrand", String, nullable=False)
    carModel = Column("carModel", String, nullable=True)
    status = Column(String, nullable=False, default="waiting")  # waiting|repairing|completed|delivered
    receivedDate = Column("receivedDate", DateTime, server_default=func.now())
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    repairTickets = relationship("RepairTicket", back_populates="vehicle", lazy="selectin")
