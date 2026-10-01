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
from models.inventory_movement import InventoryMovement
from models.booking import Booking
from models.login_attempt import LoginAttempt

__all__ = ["User", "Vehicle", "Mechanic", "RepairTicket", "RepairItem", "Inventory", "Brand", "Wage", "SystemParameter", "LoginAttempt"]

from models.garage_care import MaintenanceProfile, VehicleCare, MaintenanceRecord, MaintenanceReminder, ServiceVisit, ServiceQuote, EmployeeProfile
from models.professional import RepairEvidence, PaymentReceipt, Expense, StaffShift, StaffCertificate, LeaveRequest, ServiceFollowup
