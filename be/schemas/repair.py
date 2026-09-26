from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# ── Repair Item schemas ────────────────────────────────────────────────────────

class RepairItemCreate(BaseModel):
    taskName: str
    partName: Optional[str] = "---"
    quantity: int = 1
    partPrice: float = 0
    laborPrice: float = 0
    totalPrice: float = 0


class RepairItemToggle(BaseModel):
    isCompleted: bool


class RepairItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    repairTicketId: int
    taskName: str
    partName: Optional[str]
    quantity: int
    partPrice: float
    laborPrice: float
    totalPrice: float
    isCompleted: bool
    completedAt: Optional[datetime]
    createdAt: Optional[datetime]


# ── Nested vehicle info embedded in repair response ───────────────────────────

class VehicleInRepair(BaseModel):
    """Minimal vehicle info embedded inside a repair ticket response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    licensePlate: str
    carBrand: str
    customerName: str
    phone: str


# ── Repair Ticket schemas ──────────────────────────────────────────────────────

class RepairTicketCreate(BaseModel):
    vehicleId: int
    mechanicName: Optional[str] = "Chưa phân công"
    items: Optional[List[RepairItemCreate]] = []


class RepairTicketUpdate(BaseModel):
    mechanicName: Optional[str] = None
    status: Optional[str] = None          # draft|working|completed|paid
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    paidAt: Optional[datetime] = None


class RepairTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicleId: int
    totalAmount: float
    mechanicName: Optional[str]
    status: str
    startedAt: Optional[datetime]
    completedAt: Optional[datetime]
    paidAt: Optional[datetime]
    createdAt: Optional[datetime]
    items: List[RepairItemResponse] = []
    vehicle: Optional[VehicleInRepair] = None  # nested vehicle info for frontend
