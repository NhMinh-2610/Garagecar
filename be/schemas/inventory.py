from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from schemas.common import Money, Name


class Fitment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    brand: Name
    model: Name
    yearFrom: int = Field(ge=1980, le=2100)
    yearTo: int = Field(ge=1980, le=2100)
    engine: Name
    sourceUrl: HttpUrl

    @model_validator(mode="after")
    def years(self):
        if self.yearFrom > self.yearTo:
            raise ValueError("Khoảng năm không hợp lệ")
        return self


class PartIdentity(BaseModel):
    sku: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=100)
    manufacturer: str = Field(default="", max_length=200)
    fitments: list[Fitment] = Field(default_factory=list, max_length=100)
    highVoltage: bool = False

    @field_validator("sku", "barcode")
    @classmethod
    def code(cls, value):
        return value.strip().upper() or None if value is not None else None


class InventoryCreate(PartIdentity):
    name: Name
    quantity: int = Field(default=0, ge=0)
    unitPrice: Money = 0


class InventoryUpdate(BaseModel):
    sku: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=100)
    manufacturer: str | None = Field(default=None, max_length=200)
    fitments: list[Fitment] | None = Field(default=None, max_length=100)
    highVoltage: bool | None = None
    normalize_code = field_validator("sku", "barcode")(PartIdentity.code.__func__)
    name: Optional[Name] = None
    quantity: Optional[int] = Field(default=None, ge=0)
    unitPrice: Optional[Money] = None


class StockReceipt(BaseModel):
    quantity: int = Field(gt=0)
    unitPrice: Optional[Money] = None


class InventoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str | None = None
    barcode: str | None = None
    manufacturer: str = ""
    fitments: list[dict] = Field(default_factory=list)
    highVoltage: bool = False
    name: str
    quantity: int
    unitPrice: float
    createdAt: Optional[datetime]
    updatedAt: Optional[datetime]
