from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, text
from sqlalchemy.sql import func

from database.engine import Base


class User(Base):
    """
    User account — supports multiple roles: admin, advisor, accountant, hr, mechanic, customer.
    Column names use camelCase to match the existing database schema.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    fullName = Column("fullName", String, nullable=False)
    role = Column(String, nullable=False, default="customer")
    isActive = Column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    sessionVersion = Column(Integer, nullable=False, default=0, server_default="0")
    disabledPermissions = Column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    lastLoginAt = Column(DateTime, nullable=True)
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column(
        "updatedAt", DateTime, server_default=func.now(), onupdate=func.now()
    )
