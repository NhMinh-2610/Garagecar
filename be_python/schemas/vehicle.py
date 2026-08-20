from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class VehicleCreate(BaseModel):
    licensePlate: str
    customerName: str
    phone: str
    address: Optional[str] = None
    carBrand: str
    carModel: Optional[str] = None


class VehicleUpdate(BaseModel):
    licensePlate: Optional[str] = None
    customerName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    carBrand: Optional[str] = None
    carModel: Optional[str] = None
    status: Optional[str] = None  # waiting|repairing|completed|delivered


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    licensePlate: str
    customerName: str
    phone: str
    address: Optional[str]
    carBrand: str
    carModel: Optional[str]
    status: str
    receivedDate: Optional[datetime]
    createdAt: Optional[datetime]
