"""Persistent operation identities and atomic, shared request budgets."""

from database.engine import Base
from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.sql import func


class RequestReplay(Base):
    __tablename__ = "request_replays"
    id = Column(Integer, primary_key=True)
    userId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    scope = Column(String(200), nullable=False)
    key = Column(String(128), nullable=False)
    requestHash = Column(String(64), nullable=False)
    response = Column(JSON)
    statusCode = Column(Integer)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    __table_args__ = (
        UniqueConstraint("userId", "scope", "key", name="uq_request_identity"),
        CheckConstraint(
            '("response" IS NULL) = ("statusCode" IS NULL)', name="replay_complete_pair"
        ),
        CheckConstraint(
            '"statusCode" BETWEEN 200 AND 299', name="replay_success_status"
        ),
    )


class RequestBudget(Base):
    __tablename__ = "request_budgets"
    identifier = Column(String(100), primary_key=True)
    windowStart = Column(DateTime, primary_key=True)
    count = Column(Integer, nullable=False)
    __table_args__ = (CheckConstraint("count > 0", name="request_budget_positive"),)
