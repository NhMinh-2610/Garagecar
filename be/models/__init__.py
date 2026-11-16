"""Dang ky day du ORM models cho SQLAlchemy va Alembic."""

from models.booking import Booking
from models.garage_care import (
    EmployeeProfile,
    MaintenanceProfile,
    MaintenanceRecord,
    MaintenanceReminder,
    ServiceQuote,
    ServiceVisit,
    VehicleCare,
)
from models.inventory import Inventory
from models.inventory_movement import InventoryMovement
from models.login_attempt import LoginAttempt
from models.mechanic import Mechanic
from models.messaging import SupportConversation, SupportMessage, SupportRead
from models.professional import (
    Expense,
    LeaveRequest,
    PaymentReceipt,
    RepairEvidence,
    ServiceFollowup,
    StaffCertificate,
    StaffShift,
)
from models.repair_item import RepairItem
from models.repair_ticket import RepairTicket
from models.settings import Brand, SystemParameter, Wage
from models.user import User
from models.vehicle import Vehicle

__all__ = [
    "Booking",
    "Brand",
    "EmployeeProfile",
    "Expense",
    "Inventory",
    "InventoryMovement",
    "LeaveRequest",
    "LoginAttempt",
    "MaintenanceProfile",
    "MaintenanceRecord",
    "MaintenanceReminder",
    "Mechanic",
    "PaymentReceipt",
    "RepairEvidence",
    "RepairItem",
    "RepairTicket",
    "ServiceFollowup",
    "ServiceQuote",
    "ServiceVisit",
    "StaffCertificate",
    "StaffShift",
    "SupportConversation",
    "SupportMessage",
    "SupportRead",
    "SystemParameter",
    "User",
    "Vehicle",
    "VehicleCare",
    "Wage",
]
