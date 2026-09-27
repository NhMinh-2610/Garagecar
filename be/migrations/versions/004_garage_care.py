"""Maintenance history, reviewed reminders, quotations and staff positions."""

from alembic import op
import sqlalchemy as sa
from database.engine import Base
import models

revision = "004_garage_care"
down_revision = "003_account_management"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {c["name"] for c in sa.inspect(bind).get_columns("users")}
    if "disabledPermissions" not in columns:
        op.add_column(
            "users",
            sa.Column(
                "disabledPermissions",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            ),
        )
    for name in [
        "maintenance_profiles",
        "vehicle_care",
        "maintenance_records",
        "maintenance_reminders",
        "service_visits",
        "service_quotes",
        "employee_profiles",
    ]:
        Base.metadata.tables[name].create(bind, checkfirst=True)
    columns = {c["name"] for c in sa.inspect(bind).get_columns("repair_tickets")}
    if "serviceVisitId" not in columns:
        op.add_column(
            "repair_tickets", sa.Column("serviceVisitId", sa.Integer(), nullable=True)
        )
        op.create_foreign_key(
            "fk_ticket_visit",
            "repair_tickets",
            "service_visits",
            ["serviceVisitId"],
            ["id"],
            ondelete="RESTRICT",
        )
        op.create_unique_constraint(
            "uq_ticket_visit", "repair_tickets", ["serviceVisitId"]
        )


def downgrade():
    # History cannot be discarded by an accidental downgrade.
    raise RuntimeError(
        "Restore a reviewed backup to revert this data-preserving migration."
    )
