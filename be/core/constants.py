from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    MECHANIC = "mechanic"
    ADVISOR = "advisor"
    ACCOUNTANT = "accountant"
    CUSTOMER = "customer"


# Roles that can be created by admin via /auth/register-staff
STAFF_ROLES = [Role.ADMIN, Role.MECHANIC, Role.ADVISOR, Role.ACCOUNTANT]


class VehicleStatus(str, Enum):
    WAITING = "waiting"
    REPAIRING = "repairing"
    COMPLETED = "completed"
    DELIVERED = "delivered"


class RepairStatus(str, Enum):
    DRAFT = "draft"
    WORKING = "working"
    COMPLETED = "completed"
    PAID = "paid"
