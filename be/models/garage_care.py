"""Auditable maintenance, intake/quotation and staff records."""

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from database.engine import Base


class MaintenanceProfile(Base):
    __tablename__ = "maintenance_profiles"
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    scope = Column(JSON, nullable=False)
    rules = Column(JSON, nullable=False)
    sourceUrl = Column(String(2000), nullable=False)
    sourcePage = Column(String(255), nullable=False)
    version = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    approvedBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    approvedAt = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())


class VehicleCare(Base):
    __tablename__ = "vehicle_care"
    vehicleId = Column(
        Integer, ForeignKey("vehicles.id", ondelete="RESTRICT"), primary_key=True
    )
    profileId = Column(
        Integer, ForeignKey("maintenance_profiles.id", ondelete="RESTRICT")
    )
    vin = Column(String(17), unique=True)
    modelYear = Column(Integer, nullable=False)
    engine = Column(String(100), nullable=False)
    gearbox = Column(String(100), nullable=False)
    market = Column(String(20), nullable=False, default="VN")
    usage = Column(String(20), nullable=False, default="normal")
    firstUseDate = Column(Date, nullable=False)
    odometer = Column(Integer, nullable=False)
    observedOn = Column(Date, nullable=False)
    updatedBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    __table_args__ = (
        CheckConstraint("odometer >= 0", name="care_odometer_nonnegative"),
    )


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    id = Column(Integer, primary_key=True)
    vehicleId = Column(
        Integer,
        ForeignKey("vehicles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    component = Column(String(80), nullable=False)
    action = Column(String(20), nullable=False)
    performedOn = Column(Date, nullable=False)
    odometer = Column(Integer, nullable=False)
    ticketId = Column(Integer, ForeignKey("repair_tickets.id", ondelete="RESTRICT"))
    note = Column(String(2000), nullable=False)
    createdBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    createdAt = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "vehicleId",
            "component",
            "action",
            "performedOn",
            "odometer",
            name="uq_maintenance_record",
        ),
    )


class MaintenanceReminder(Base):
    __tablename__ = "maintenance_reminders"
    id = Column(Integer, primary_key=True)
    vehicleId = Column(
        Integer,
        ForeignKey("vehicles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    profileId = Column(
        Integer,
        ForeignKey("maintenance_profiles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    ruleKey = Column(String(100), nullable=False)
    cycleKey = Column(String(100), nullable=False)
    summary = Column(JSON, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    publishedBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    publishedAt = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())
    __table_args__ = (
        UniqueConstraint(
            "vehicleId", "profileId", "ruleKey", "cycleKey", name="uq_maintenance_cycle"
        ),
    )


class ServiceVisit(Base):
    __tablename__ = "service_visits"
    id = Column(Integer, primary_key=True)
    vehicleId = Column(
        Integer,
        ForeignKey("vehicles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    advisorId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    mechanicId = Column(Integer, ForeignKey("mechanics.id", ondelete="RESTRICT"))
    concern = Column(String(2000), nullable=False)
    initialInspection = Column(String(4000), nullable=False)
    diagnosis = Column(String(4000))
    status = Column(String(30), nullable=False, default="intake")
    qc = Column(JSON)
    qcBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    qcAt = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())


class ServiceQuote(Base):
    __tablename__ = "service_quotes"
    id = Column(Integer, primary_key=True)
    visitId = Column(
        Integer,
        ForeignKey("service_visits.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    revision = Column(Integer, nullable=False)
    stage = Column(String(20), nullable=False)
    items = Column(JSON, nullable=False)
    totalAmount = Column(Numeric(14, 2), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    decidedBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    decisionNote = Column(String(2000))
    decidedAt = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())
    __table_args__ = (
        UniqueConstraint("visitId", "revision", name="uq_visit_revision"),
    )


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"
    userId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    phone = Column(String(30), nullable=False, default="")
    department = Column(String(100), nullable=False)
    jobTitle = Column(String(100), nullable=False)
    startDate = Column(Date, nullable=False)
    note = Column(String(2000), nullable=False, default="")
    updatedBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())
