"""Account activation, session revocation and login history."""
from alembic import op
import sqlalchemy as sa

revision = "003_account_management"
down_revision = "002_login_attempts"
branch_labels = None
depends_on = None


def upgrade():
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}
    # The baseline also creates current metadata for an empty database.
    for column in [
        sa.Column("isActive", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sessionVersion", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lastLoginAt", sa.DateTime(), nullable=True),
    ]:
        if column.name not in columns:
            op.add_column("users", column)


def downgrade():
    for name in ["lastLoginAt", "sessionVersion", "isActive"]:
        op.drop_column("users", name)
