from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# Request schemas
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
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def nonempty_content(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Nội dung không được để trống")
        return value


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=21)
    vehicleId: Optional[int] = Field(default=None, gt=0)

    @model_validator(mode="after")
    def conversation_limits(self):
        if sum(len(message.content) for message in self.messages) > 16000:
            raise ValueError("Cuộc trò chuyện quá dài; hãy bắt đầu cuộc trò chuyện mới")
        if self.messages[-1].role != "user":
            raise ValueError("Tin nhắn cuối phải là câu hỏi của người dùng")
        for index, message in enumerate(self.messages):
            if message.role != ("user" if index % 2 == 0 else "assistant"):
                raise ValueError(
                    "Lịch sử hội thoại phải luân phiên người dùng và trợ lý"
                )
        return self


# Response schemas
class DiagnoseResponse(BaseModel):
    possibleCauses: List[str]
    recommendedActions: List[str]
    urgencyLevel: str  # low | medium | high | critical
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
    provider: str = "mock"
    model: Optional[str] = None
    isDemo: bool = True
    sources: List[dict] = Field(default_factory=list)
