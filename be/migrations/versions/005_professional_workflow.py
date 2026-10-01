"""Workshop evidence, part identity, receipts and staff operations."""

from alembic import op
import sqlalchemy as sa
from database.engine import Base
import models  # noqa: F401

revision = "005_professional_workflow"
down_revision = "004_garage_care"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for table, columns in {
        "inventories": [
            sa.Column("sku", sa.String(100)),
            sa.Column("barcode", sa.String(100)),
            sa.Column(
                "manufacturer", sa.String(200), nullable=False, server_default=""
            ),
            sa.Column(
                "fitments", sa.JSON(), nullable=False, server_default=sa.text("'[]'")
            ),
            sa.Column(
                "highVoltage", sa.Boolean(), nullable=False, server_default=sa.false()
            ),
        ],
        "repair_items": [
            sa.Column(
                "evidenceRound", sa.Integer(), nullable=False, server_default="1"
            ),
            sa.Column("partCode", sa.String(100)),
        ],
    }.items():
        existing = {c["name"] for c in sa.inspect(bind).get_columns(table)}
        for column in columns:
            if column.name not in existing:
                op.add_column(table, column)
    uniques = {
        tuple(c["column_names"])
        for c in sa.inspect(bind).get_unique_constraints("inventories")
    }
    for name in ("sku", "barcode"):
        constraint = "uq_inventory_" + name
        if (name,) not in uniques:
            op.create_unique_constraint(constraint, "inventories", [name])
    for name in (
        "repair_evidence",
        "payment_receipts",
        "expenses",
        "staff_shifts",
        "staff_certificates",
        "leave_requests",
        "service_followups",
    ):
        Base.metadata.tables[name].create(bind, checkfirst=True)


def downgrade():
    raise RuntimeError(
        "Restore a verified backup to remove audit records; downgrade is intentionally unavailable."
    )
