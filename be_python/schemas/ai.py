from pydantic import BaseModel
from typing import Optional, List


# ── Request schemas ────────────────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    symptoms: str
    carBrand: Optional[str] = None
    carModel: Optional[str] = None
    mileage: Optional[int] = None


class CostEstimateRequest(BaseModel):
    tasks: List[str]
    carBrand: Optional[str] = None


class SummarizeRepairRequest(BaseModel):
    ticketId: int
    vehiclePlate: str
    customerName: str
    mechanicName: Optional[str] = None
    status: str
    totalAmount: float
    items: List[dict]


class MaintenanceAdviceRequest(BaseModel):
    carBrand: str
    carModel: Optional[str] = None
    mileage: int
    lastServiceDate: Optional[str] = None


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


# ── Response schemas ───────────────────────────────────────────────────────────

class DiagnoseResponse(BaseModel):
    possibleCauses: List[str]
    recommendedActions: List[str]
    urgencyLevel: str   # low | medium | high | critical
    estimatedCost: Optional[str] = None
    disclaimer: str


class CostEstimateResponse(BaseModel):
    breakdown: List[dict]
    totalEstimate: str
    notes: str


class SummarizeResponse(BaseModel):
    summary: str


class MaintenanceAdviceResponse(BaseModel):
    recommendations: List[str]
    nextServiceMileage: Optional[int] = None
    notes: str


class ChatResponse(BaseModel):
    reply: str
