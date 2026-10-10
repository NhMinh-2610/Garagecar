from sqlalchemy import Column, Integer, Numeric, String

from database.engine import Base


class Brand(Base):
    __tablename__ = "brands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)


class Wage(Base):
    __tablename__ = "wages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    price = Column(Numeric(14, 2), nullable=False, default=0)


class SystemParameter(Base):
    __tablename__ = "system_parameters"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(
        String, unique=True, index=True, nullable=False
    )  # e.g. "max_cars_per_day"
    value = Column(String, nullable=False)  # Store as string, parse as needed
