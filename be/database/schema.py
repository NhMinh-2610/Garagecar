"""Kiem tra schema khi khoi dong; thay doi schema chi qua Alembic."""

from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncEngine

REQUIRED_TABLES = {
    "vehicles",
    "users",
    "repair_tickets",
    "inventories",
    "repair_items",
    "maintenance_profiles",
    "vehicle_care",
    "maintenance_records",
    "maintenance_reminders",
    "service_visits",
    "service_quotes",
    "employee_profiles",
    "repair_evidence",
    "payment_receipts",
    "expenses",
    "staff_shifts",
    "staff_certificates",
    "leave_requests",
    "service_followups",
    "support_conversations",
    "support_messages",
    "support_reads",
}
REQUIRED_COLUMNS = {
    "vehicles": {"customerId"},
    "users": {"isActive", "sessionVersion", "lastLoginAt", "disabledPermissions"},
    "repair_tickets": {"serviceVisitId"},
    "inventories": {"sku", "barcode", "fitments", "highVoltage"},
    "repair_items": {"evidenceRound", "partCode"},
    "staff_certificates": {"status", "revokedBy", "revokedAt", "revokeReason"},
}


def _missing_schema(connection):
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    missing = sorted(REQUIRED_TABLES - tables)
    for table, required in REQUIRED_COLUMNS.items():
        if table in tables:
            existing = {column["name"] for column in inspector.get_columns(table)}
            missing.extend(f"{table}.{name}" for name in sorted(required - existing))
    return missing


async def ensure_schema(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        missing = await connection.run_sync(_missing_schema)
    if missing:
        raise RuntimeError(
            "Database needs migration (missing: " + ", ".join(missing) + "). "
            "Back up the database, then run: python be/manage.py upgrade"
        )
