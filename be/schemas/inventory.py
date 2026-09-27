from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from schemas.common import Money, Name


class InventoryCreate(BaseModel):
    name: Name
    quantity: int = Field(default=0, ge=0)
    unitPrice: Money = 0


class InventoryUpdate(BaseModel):
    name: Optional[Name] = None
    quantity: Optional[int] = Field(default=None, ge=0)
    unitPrice: Optional[Money] = None


class StockReceipt(BaseModel):
    quantity: int = Field(gt=0)
    unitPrice: Optional[Money] = None


class InventoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    quantity: int
    unitPrice: float
    createdAt: Optional[datetime]
    updatedAt: Optional[datetime]

