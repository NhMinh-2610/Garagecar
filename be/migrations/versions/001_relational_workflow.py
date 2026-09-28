"""Add explicit ownership and assignment without guessing identities from names.

Existing text fields remain historical snapshots. Legacy inventory is never
deducted retroactively. The entire migration is transactional on PostgreSQL.
"""
from alembic import op
import sqlalchemy as sa
from database.engine import Base
import models  # noqa: F401

revision = "001_relational_workflow"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    Base.metadata.create_all(connection)
    links = [
        ("vehicles", "customerId", "users", False),
        ("mechanics", "userId", "users", True),
        ("repair_tickets", "mechanicId", "mechanics", False),
        ("repair_items", "inventoryId", "inventories", False),
    ]
    for table, column, target, unique in links:
        columns = {c["name"] for c in sa.inspect(connection).get_columns(table)}
        if column not in columns:
            op.add_column(table, sa.Column(column, sa.Integer(), nullable=True))
            op.create_foreign_key(f"fk_{table}_{column}", table, target, [column], ["id"], ondelete="RESTRICT")
            op.create_index(f"ix_{table}_{column}", table, [column], unique=unique)
    for table, columns in {
        "inventories": ["unitPrice"], "repair_items": ["partPrice", "laborPrice", "totalPrice"],
        "repair_tickets": ["totalAmount"], "wages": ["price"],
    }.items():
        for column in columns:
            op.alter_column(table, column, type_=sa.Numeric(14, 2))
    checks = {
        "inventories": 'quantity >= 0 AND "unitPrice" >= 0',
        "repair_items": 'quantity > 0 AND "partPrice" >= 0 AND "laborPrice" >= 0 AND "totalPrice" >= 0',
        "repair_tickets": '''"totalAmount" >= 0 AND status IN ('draft','working','completed','paid')''',
        "vehicles": "status IN ('waiting','repairing','completed','delivered')",
        "mechanics": "status IN ('active','inactive')",
        "wages": "price >= 0",
        "bookings": "status IN ('pending','confirmed','cancelled')",
        "inventory_movements": '"balanceAfter" >= 0',
    }
    for table, expression in checks.items():
        name = f"ck_{table}_valid"
        if name not in {c["name"] for c in sa.inspect(connection).get_check_constraints(table)}:
            op.create_check_constraint(name, table, expression)
    # Preserve totals of historical paid tickets. Recalculate unpaid quotes.
    tickets = sa.table("repair_tickets", sa.column("id"), sa.column("status"), sa.column("totalAmount"))
    items = sa.table("repair_items", sa.column("repairTicketId"), sa.column("totalPrice"))
    amount = sa.select(sa.func.coalesce(sa.func.sum(items.c.totalPrice), 0)).where(
        items.c.repairTicketId == tickets.c.id).scalar_subquery()
    connection.execute(tickets.update().where(tickets.c.status != "paid").values(totalAmount=amount))
    # Bootstrap the former frontend catalog, then separate known brand/model text.
    brands = sa.table("brands", sa.column("name"))
    vehicles = sa.table("vehicles", sa.column("id"), sa.column("carBrand"), sa.column("carModel"))
    defaults = ["Toyota", "Honda", "Mazda", "Ford", "Kia", "Hyundai", "Mercedes", "BMW"]
    known = set(connection.scalars(sa.select(brands.c.name)))
    for name in defaults:
        if name not in known:
            connection.execute(brands.insert().values(name=name))
            known.add(name)
    for row in connection.execute(sa.select(vehicles)):
        for name in sorted(known, key=len, reverse=True):
            if row.carBrand.startswith(name + " ") and not row.carModel:
                connection.execute(vehicles.update().where(vehicles.c.id == row.id).values(
                    carBrand=name, carModel=row.carBrand[len(name):].strip()))
                break
    params = sa.table("system_parameters", sa.column("key"), sa.column("value"))
    if not connection.scalar(sa.select(params.c.key).where(params.c.key == "max_cars_per_day")):
        connection.execute(params.insert().values(key="max_cars_per_day", value="30"))
    wages = sa.table("wages", sa.column("name"), sa.column("price"))
    existing = set(connection.scalars(sa.select(wages.c.name)))
    for name, price in [("Thay nhớt", 50000), ("Thay lọc gió", 30000), ("Vệ sinh khoang máy", 150000),
                        ("Thay bố thắng", 100000), ("Kiểm tra hệ thống điện", 200000),
                        ("Cân chỉnh thước lái", 300000), ("Rửa xe", 80000)]:
        if name not in existing:
            connection.execute(wages.insert().values(name=name, price=price))


def downgrade():
    raise RuntimeError("Restore the pre-migration backup to revert; automatic downgrade would lose account links.")
