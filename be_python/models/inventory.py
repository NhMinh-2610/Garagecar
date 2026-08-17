from sqlalchemy import Column, Integer, String, Numeric, DateTime
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
    quantity = Column(Integer, nullable=False, default=0)
    unitPrice = Column("unitPrice", Numeric(10, 2), nullable=False, default=0)
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())
