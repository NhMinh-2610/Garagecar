"""Bounded inputs for each job's own actions."""

from datetime import date, datetime, timezone
from typing import Literal

from pydantic import Field, field_validator, model_validator

from schemas.common import Money, Name, PositiveId
from schemas.garage_care import Input, today


class EvidenceInput(Input):
    kind: Literal["completion", "package"]
    image: str = Field(min_length=20, max_length=4200000)
    productCode: str | None = Field(default=None, max_length=100)
    lotNumber: str | None = Field(default=None, max_length=100)
    note: str = Field(min_length=3, max_length=2000)


class PaymentInput(Input):
    method: Literal["cash", "bank", "card"] = "cash"
    reference: str = Field(default="", max_length=100)

    @model_validator(mode="after")
    def bank_reference(self):
        if self.method != "cash" and not self.reference.strip():
            raise ValueError("Cần mã giao dịch khi thu/chi qua ngân hàng hoặc thẻ")
        return self


class ExpenseInput(Input):
    category: Literal["parts", "tools", "rent", "utilities", "other"]
    payee: Name
    documentNumber: str = Field(min_length=3, max_length=100)
    amount: Money
    note: str = Field(min_length=3, max_length=2000)

    @field_validator("amount")
    @classmethod
    def positive(cls, value):
        if value <= 0:
            raise ValueError("Số tiền phải lớn hơn 0")
        return value


class DecisionInput(Input):
    approved: bool
    note: str = Field(min_length=3, max_length=2000)


class ShiftInput(Input):
    userId: PositiveId
    startsAt: datetime
    endsAt: datetime
    bay: str = Field(min_length=1, max_length=100)
    note: str = Field(default="", max_length=2000)

    @field_validator("startsAt", "endsAt")
    @classmethod
    def utc(cls, value):
        if value.tzinfo is None:
            raise ValueError("Lịch làm cần múi giờ, ví dụ +07:00")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    @model_validator(mode="after")
    def duration(self):
        hours = (self.endsAt - self.startsAt).total_seconds() / 3600
        if not 0 < hours <= 16:
            raise ValueError("Ca làm phải dài từ trên 0 đến 16 giờ")
        return self


class CertificateInput(Input):
    userId: PositiveId
    kind: Literal["ev_safety", "diagnostics", "air_conditioning", "bodywork", "other"]
    issuer: Name
    certificateNumber: str = Field(min_length=3, max_length=100)
    validFrom: date
    validUntil: date

    @model_validator(mode="after")
    def dates(self):
        if self.validFrom > self.validUntil:
            raise ValueError("Ngày hết hạn phải sau ngày cấp")
        return self


class LeaveInput(Input):
    fromDate: date
    toDate: date
    reason: str = Field(min_length=3, max_length=2000)

    @model_validator(mode="after")
    def dates(self):
        if self.fromDate > self.toDate or self.fromDate < today():
            raise ValueError("Khoảng nghỉ phải hợp lệ và từ hôm nay trở đi")
        return self


class FollowupInput(Input):
    outcome: Literal["satisfied", "no_answer", "needs_rework"]
    rating: int | None = Field(default=None, ge=1, le=5)
    note: str = Field(min_length=3, max_length=2000)
    nextContactOn: date | None = None

    @model_validator(mode="after")
    def followup(self):
        if self.nextContactOn and self.nextContactOn < today():
            raise ValueError("Ngày liên hệ tiếp theo không được trong quá khứ")
        if self.outcome == "no_answer" and not self.nextContactOn:
            raise ValueError("Chưa liên hệ được cần có ngày gọi lại")
        return self
