from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from database.engine import Base


class User(Base):
    """
    User account — supports multiple roles: admin, mechanic, accountant, customer.
    Column names intentionally mirror the existing Sequelize schema (camelCase)
    so the Python and Node.js backends share the same SQLite database.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    fullName = Column("fullName", String, nullable=False)
    role = Column(String, nullable=False, default="customer")
    createdAt = Column("createdAt", DateTime, server_default=func.now())
    updatedAt = Column("updatedAt", DateTime, server_default=func.now(), onupdate=func.now())
