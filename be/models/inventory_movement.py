from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database.engine import Base


class InventoryMovement(Base):
    """Append-only stock ledger; repair reference is retained even after draft deletion."""
    __tablename__ = "inventory_movements"
    id = Column(Integer, primary_key=True)
    inventoryId = Column(Integer, ForeignKey("inventories.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantityChange = Column(Integer, nullable=False)
    balanceAfter = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    reference = Column(String, nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
