from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

from schemas.common import Name, PositiveId


class MechanicCreate(BaseModel):
    fullName: Name
    userId: Optional[PositiveId] = None
    phone: Optional[str] = None
    specialty: Optional[str] = "Chung"
    status: Literal["active", "inactive"] = "active"


class MechanicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    userId: Optional[int] = None
    fullName: str
    phone: Optional[str]
    specialty: Optional[str]
    status: str
    createdAt: Optional[datetime]


class MechanicUpdate(BaseModel):
    userId: Optional[PositiveId] = None
    fullName: Optional[Name] = None
    phone: Optional[str] = None
    specialty: Optional[Name] = None
    status: Optional[Literal["active", "inactive"]] = None
