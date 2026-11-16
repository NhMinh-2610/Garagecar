from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ConversationInput(BaseModel):
    vehicleId: int | None = Field(default=None, gt=0)


class MessageInput(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    clientMessageId: UUID

    @field_validator("content")
    @classmethod
    def strip_content(cls, content):
        if not content.strip():
            raise ValueError("Nội dung tin nhắn không được để trống")
        return content.strip()


class ReadInput(BaseModel):
    throughMessageId: int = Field(gt=0)


class AssignInput(BaseModel):
    advisorId: int | None = Field(default=None, gt=0)


class StatusInput(BaseModel):
    status: Literal["open", "closed"]
