from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.constants import RepairStatus
from schemas.common import Money, Name, PositiveId


class RepairItemCreate(BaseModel):
    taskName: Name
    inventoryId: Optional[PositiveId] = None
    quantity: int = Field(default=1, gt=0, le=100000)
    laborPrice: Money = 0


class RepairItemToggle(BaseModel):
    isCompleted: bool


class RepairItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    repairTicketId: int
    inventoryId: Optional[int] = None
    taskName: str
    partName: Optional[str]
    quantity: int
    partPrice: float
    laborPrice: float
    totalPrice: float
    isCompleted: bool
    evidenceRound: int = 1
    partCode: Optional[str] = None
    completedAt: Optional[datetime]
    createdAt: Optional[datetime]


class VehicleInRepair(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    licensePlate: str
    carBrand: str
    carModel: Optional[str] = None
    customerName: str
    phone: str
    status: str


class RepairTicketCreate(BaseModel):
    vehicleId: PositiveId
    mechanicId: Optional[PositiveId] = None
    items: list[RepairItemCreate] = Field(min_length=1, max_length=100)


class RepairTicketUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mechanicId: Optional[PositiveId] = None
    status: Optional[RepairStatus] = None
    paymentMethod: Literal["cash", "bank", "card"] = "cash"
    paymentReference: str = Field(default="", max_length=100)
    items: Optional[list[RepairItemCreate]] = Field(
        default=None, min_length=1, max_length=100
    )


class RepairTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    serviceVisitId: Optional[int] = None
    qcAt: Optional[datetime] = None
    vehicleId: int
    mechanicId: Optional[int] = None
    totalAmount: float
    mechanicName: Optional[str]
    status: str
    startedAt: Optional[datetime]
    completedAt: Optional[datetime]
    paidAt: Optional[datetime]
    createdAt: Optional[datetime]
    items: list[RepairItemResponse] = Field(default_factory=list)
    vehicle: Optional[VehicleInRepair] = None
