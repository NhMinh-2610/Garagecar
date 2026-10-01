from sqlalchemy import Column, Integer, String, Numeric, DateTime, JSON, Boolean
from sqlalchemy.sql import func

from database.engine import Base


class Inventory(Base):
    """
    Spare-parts and consumables inventory.
    Quantity is decremented when parts are used in a RepairItem.
    """

    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    sku = Column(String(100), unique=True)
    barcode = Column(String(100), unique=True)
    manufacturer = Column(String(200), nullable=False, default="", server_default="")
    fitments = Column(JSON, nullable=False, default=list, server_default="[]")
    highVoltage = Column(Boolean, nullable=False, default=False, server_default="false")
    quantity = Column(Integer, nullable=False, default=0)
    unitPrice = Column("unitPrice", Numeric(14, 2), nullable=False, default=0)
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column(
        "updatedAt", DateTime, server_default=func.now(), onupdate=func.now()
    )
