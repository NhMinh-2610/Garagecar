from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class InventoryCreate(BaseModel):
    name: str
    quantity: int = 0
    unitPrice: float = 0


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    unitPrice: Optional[float] = None


class InventoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    quantity: int
    unitPrice: float
    createdAt: Optional[datetime]
    updatedAt: Optional[datetime]
