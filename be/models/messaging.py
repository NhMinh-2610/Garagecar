"""Private customer support threads, immutable messages and per-user read cursors."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.sql import func

from database.engine import Base


class SupportConversation(Base):
    __tablename__ = "support_conversations"
    id = Column(Integer, primary_key=True)
    customerId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    vehicleId = Column(
        Integer, ForeignKey("vehicles.id", ondelete="RESTRICT"), index=True
    )
    advisorId = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    status = Column(String(20), nullable=False, server_default="open", default="open")
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    __table_args__ = (
        Index(
            "uq_support_general",
            "customerId",
            unique=True,
            postgresql_where=text('"vehicleId" IS NULL'),
        ),
        Index(
            "uq_support_vehicle",
            "customerId",
            "vehicleId",
            unique=True,
            postgresql_where=text('"vehicleId" IS NOT NULL'),
        ),
        CheckConstraint("status IN ('open', 'closed')", name="support_status_valid"),
    )


class SupportMessage(Base):
    __tablename__ = "support_messages"
    id = Column(Integer, primary_key=True)
    conversationId = Column(
        Integer,
        ForeignKey("support_conversations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    senderId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    senderName = Column(String(255), nullable=False)
    senderRole = Column(String(20), nullable=False)
    content = Column(String(4000), nullable=False)
    clientMessageId = Column(String(36), nullable=False)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    __table_args__ = (
        UniqueConstraint(
            "conversationId",
            "senderId",
            "clientMessageId",
            name="uq_support_message_retry",
        ),
        CheckConstraint("length(trim(content)) > 0", name="support_content_not_blank"),
        Index("ix_support_message_cursor", "conversationId", "id"),
    )


class SupportRead(Base):
    __tablename__ = "support_reads"
    conversationId = Column(
        Integer,
        ForeignKey("support_conversations.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    userId = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    lastReadMessageId = Column(Integer, nullable=False, default=0, server_default="0")
    updatedAt = Column(DateTime, nullable=False, server_default=func.now())
