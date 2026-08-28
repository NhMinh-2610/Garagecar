from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class MechanicCreate(BaseModel):
    fullName: str
    phone: Optional[str] = None
    specialty: Optional[str] = "Chung"


class MechanicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fullName: str
    phone: Optional[str]
    specialty: Optional[str]
    status: str
    createdAt: Optional[datetime]
