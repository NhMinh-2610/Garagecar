"""
ORM model registry — import all models here so that SQLAlchemy's
metadata is fully populated before create_all() or alembic migrations run.
"""

from models.user import User
from models.vehicle import Vehicle
from models.mechanic import Mechanic
from models.repair_ticket import RepairTicket
from models.repair_item import RepairItem
from models.inventory import Inventory
from models.settings import Brand, Wage, SystemParameter

__all__ = ["User", "Vehicle", "Mechanic", "RepairTicket", "RepairItem", "Inventory", "Brand", "Wage", "SystemParameter"]
