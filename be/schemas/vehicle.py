from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from core.constants import VehicleStatus
from schemas.common import Name, PositiveId
from schemas.repair import RepairTicketResponse


class VehicleCreate(BaseModel):
    licensePlate: Name
    customerId: Optional[PositiveId] = None
    customerName: Name
    phone: Name
    address: Optional[str] = None
    carBrand: Name
    carModel: Optional[str] = None

    @field_validator("licensePlate")
    @classmethod
    def normalize_plate(cls, value):
        plate = "".join(c for c in value.upper() if c.isalnum())
        if not plate:
            raise ValueError("Biển số không hợp lệ")
        return plate


class VehicleUpdate(BaseModel):
    licensePlate: Optional[Name] = None
    customerId: Optional[PositiveId] = None
    customerName: Optional[Name] = None
    phone: Optional[Name] = None
    address: Optional[str] = None
    carBrand: Optional[Name] = None
    carModel: Optional[str] = None
    status: Optional[VehicleStatus] = None

    @field_validator("licensePlate")
    @classmethod
    def normalize_plate(cls, value):
        return VehicleCreate.normalize_plate(value) if value else value


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    licensePlate: str
    customerId: Optional[int] = None
    customerName: str
    phone: str
    address: Optional[str]
    carBrand: str
    carModel: Optional[str]
    status: str
    receivedDate: Optional[datetime]
    createdAt: Optional[datetime]
    repairTickets: list[RepairTicketResponse] = Field(default_factory=list)

