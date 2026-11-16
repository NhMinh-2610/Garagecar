"""Separate job records and immutable workshop evidence."""

from sqlalchemy import (
    JSON,
    text,
    Column,
    Integer,
    String,
    Date,
    DateTime,
    Numeric,
    LargeBinary,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.sql import func
from database.engine import Base


class RepairEvidence(Base):
    __tablename__ = "repair_evidence"
    id = Column(Integer, primary_key=True)
    itemId = Column(
        Integer,
        ForeignKey("repair_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    round = Column(Integer, nullable=False)
    slot = Column(Integer, nullable=True)
    kind = Column(String(20), nullable=False)
    productCode = Column(String(100))
    expectedCode = Column(String(100))
    lotNumber = Column(String(100))
    note = Column(String(2000), nullable=False)
    image = Column(LargeBinary, nullable=False)
    sha256 = Column(String(64), nullable=False)
    createdBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    createdAt = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("itemId", "round", "slot", name="uq_evidence_slot"),
        CheckConstraint("slot BETWEEN 1 AND 12", name="evidence_slot_range"),
    )


class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"
    id = Column(Integer, primary_key=True)
    ticketId = Column(
        Integer,
        ForeignKey("repair_tickets.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
    )
    amount = Column(Numeric(14, 2), nullable=False)
    method = Column(String(20), nullable=False)
    reference = Column(String(100), nullable=False)
    snapshot = Column(JSON, nullable=False, server_default=text("'{}'"))
    receivedBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    createdAt = Column(DateTime, server_default=func.now())


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    category = Column(String(40), nullable=False)
    payee = Column(String(200), nullable=False)
    documentNumber = Column(String(100), nullable=False, unique=True)
    amount = Column(Numeric(14, 2), nullable=False)
    note = Column(String(2000), nullable=False)
    status = Column(String(20), nullable=False, default="submitted")
    createdBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    approvedBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    approvedAt = Column(DateTime)
    paidBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    paidAt = Column(DateTime)
    method = Column(String(20))
    reference = Column(String(100))
    createdAt = Column(DateTime, server_default=func.now())
    __table_args__ = (CheckConstraint("amount > 0", name="expense_positive"),)


class ExpenseDocument(Base):
    """One canonical document identity; legacy duplicate rows remain untouched."""
    __tablename__ = "expense_documents"
    normalized = Column(String(100), primary_key=True)
    expenseId = Column(Integer, ForeignKey("expenses.id", ondelete="RESTRICT"), nullable=False, unique=True)


class StaffShift(Base):
    __tablename__ = "staff_shifts"
    id = Column(Integer, primary_key=True)
    userId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    startsAt = Column(DateTime, nullable=False)
    endsAt = Column(DateTime, nullable=False)
    bay = Column(String(100), nullable=False)
    note = Column(String(2000), nullable=False)
    createdBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status = Column(String(20), nullable=False, default="scheduled")
    createdAt = Column(DateTime, server_default=func.now())
    __table_args__ = (CheckConstraint('"endsAt" > "startsAt"', name="shift_order"),)


class StaffCertificate(Base):
    __tablename__ = "staff_certificates"
    id = Column(Integer, primary_key=True)
    userId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    kind = Column(String(30), nullable=False)
    issuer = Column(String(200), nullable=False)
    certificateNumber = Column(String(100), nullable=False)
    validFrom = Column(Date, nullable=False)
    validUntil = Column(Date, nullable=False)
    verifiedBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status = Column(
        String(20), nullable=False, default="verified", server_default="verified"
    )
    revokedBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    revokedAt = Column(DateTime)
    revokeReason = Column(String(2000))
    createdAt = Column(DateTime, server_default=func.now())
    __table_args__ = (
        UniqueConstraint(
            "userId", "issuer", "certificateNumber", name="uq_staff_certificate"
        ),
    )


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(Integer, primary_key=True)
    userId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    fromDate = Column(Date, nullable=False)
    toDate = Column(Date, nullable=False)
    reason = Column(String(2000), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    decidedBy = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"))
    decisionNote = Column(String(2000))
    decidedAt = Column(DateTime)
    createdAt = Column(DateTime, server_default=func.now())


class ServiceFollowup(Base):
    __tablename__ = "service_followups"
    id = Column(Integer, primary_key=True)
    visitId = Column(
        Integer,
        ForeignKey("service_visits.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    outcome = Column(String(30), nullable=False)
    rating = Column(Integer)
    note = Column(String(2000), nullable=False)
    nextContactOn = Column(Date)
    createdBy = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    createdAt = Column(DateTime, server_default=func.now())
