from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime
from pydantic import Field, field_validator
from schemas.common import Name, PositiveId
from typing import Literal


# ── Request schemas ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: Name
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    fullName: Name

    @field_validator("password")
    @classmethod
    def password_byte_limit(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu vượt giới hạn 72 byte")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()


class StaffRegisterRequest(RegisterRequest):
    """Used by admin to create mechanic / admin accounts."""
    role: str  # validated against STAFF_ROLES in the router
    mechanicId: Optional[PositiveId] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Response schemas ───────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    fullName: str
    role: str
    isActive: bool = True
    lastLoginAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None


class TokenResponse(BaseModel):
    token: str
    user: UserResponse


class AccountCreate(RegisterRequest):
    model_config = ConfigDict(extra="forbid")
    role: Literal["admin", "mechanic", "customer"]
    mechanicId: Optional[PositiveId] = None
    vehicleIds: list[PositiveId] = Field(default_factory=list, max_length=100)


class AccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: Name
    fullName: Name
    email: EmailStr
    isActive: bool

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()


class PasswordReset(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=6, max_length=72)

    @field_validator("password")
    @classmethod
    def byte_limit(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu vượt giới hạn 72 byte")
        return value


class PasswordChange(PasswordReset):
    currentPassword: str
