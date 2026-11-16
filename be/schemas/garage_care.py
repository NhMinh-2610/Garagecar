"""Validated inputs; source schedules are scoped to an exact vehicle variant."""

from datetime import date, timedelta
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from core.time import utcnow
from schemas.common import Name, PositiveId
from schemas.repair import RepairItemCreate


def today():
    return (utcnow() + timedelta(hours=7)).date()


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Scope(Input):
    brand: Name
    model: Name
    yearFrom: int = Field(ge=1980, le=2100)
    yearTo: int = Field(ge=1980, le=2100)
    engine: Name
    gearbox: Name
    market: Name = "VN"
    usage: Literal["normal", "severe"] = "normal"

    @model_validator(mode="after")
    def ordered(self):
        if self.yearFrom > self.yearTo:
            raise ValueError("Khoảng năm không hợp lệ")
        return self


class Rule(Input):
    component: str = Field(pattern=r"^[a-z][a-z0-9_]{1,79}$")
    action: Literal["inspect", "replace", "clean", "rotate", "lubricate"]
    firstKm: int | None = Field(default=None, gt=0, le=2000000)
    firstMonths: int | None = Field(default=None, gt=0, le=600)
    repeatKm: int | None = Field(default=None, gt=0, le=2000000)
    repeatMonths: int | None = Field(default=None, gt=0, le=600)
    note: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def interval(self):
        if self.firstKm is None and self.firstMonths is None:
            raise ValueError("Cần mốc km hoặc tháng lần đầu")
        return self


class ProfileInput(Input):
    title: Name
    scope: Scope
    rules: list[Rule] = Field(min_length=1, max_length=100)
    sourceUrl: HttpUrl
    sourcePage: Name
    version: Name

    @model_validator(mode="after")
    def unique_rules(self):
        if len({(r.component, r.action) for r in self.rules}) != len(self.rules):
            raise ValueError("Trùng bộ phận và thao tác")
        return self


class CareInput(Input):
    profileId: PositiveId | None = None
    vin: str | None = Field(default=None, pattern=r"^[A-HJ-NPR-Z0-9]{17}$")
    modelYear: int = Field(ge=1980, le=2100)
    engine: Name
    gearbox: Name
    market: Name = "VN"
    usage: Literal["normal", "severe"] = "normal"
    firstUseDate: date
    odometer: int = Field(ge=0, le=2000000)
    observedOn: date

    @model_validator(mode="after")
    def dates(self):
        if self.firstUseDate > self.observedOn or self.observedOn > today():
            raise ValueError("Ngày dùng xe / ghi nhận ODO không hợp lệ")
        return self


class RecordInput(Input):
    component: str = Field(pattern=r"^[a-z][a-z0-9_]{1,79}$")
    action: Literal["inspect", "replace", "clean", "rotate", "lubricate"]
    performedOn: date
    odometer: int = Field(ge=0, le=2000000)
    ticketId: PositiveId | None = None
    note: str = Field(min_length=3, max_length=2000)

    @field_validator("performedOn")
    @classmethod
    def past(cls, v):
        if v > today():
            raise ValueError("Không ghi nhận công việc trong tương lai")
        return v


class VisitInput(Input):
    vehicleId: PositiveId
    mechanicId: PositiveId | None = None
    concern: str = Field(min_length=3, max_length=2000)
    initialInspection: str = Field(min_length=3, max_length=4000)


class DiagnosisInput(Input):
    diagnosis: str = Field(min_length=3, max_length=4000)


class QuoteInput(Input):
    stage: Literal["preliminary", "final"]
    items: list[RepairItemCreate] = Field(min_length=1, max_length=100)


class QuoteDecision(Input):
    approved: bool
    note: str = Field(default="", max_length=2000)


class ConvertInput(Input):
    mechanicId: PositiveId


class QCInput(Input):
    workVerified: bool
    safetyChecked: bool
    roadTestOrReason: str = Field(min_length=3, max_length=2000)
    note: str = Field(default="", max_length=2000)


class EmployeeInput(Input):
    phone: str = Field(default="", max_length=30)
    department: Name
    jobTitle: Name
    startDate: date
    note: str = Field(default="", max_length=2000)


class PermissionInput(Input):
    disabledPermissions: list[str] = Field(max_length=9)
