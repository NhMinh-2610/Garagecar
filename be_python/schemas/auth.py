from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime


# ── Request schemas ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    fullName: str = ""


class StaffRegisterRequest(RegisterRequest):
    """Used by admin to create mechanic / admin accounts."""
    role: str  # validated against STAFF_ROLES in the router


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
    createdAt: Optional[datetime] = None


class TokenResponse(BaseModel):
    token: str
    user: UserResponse
