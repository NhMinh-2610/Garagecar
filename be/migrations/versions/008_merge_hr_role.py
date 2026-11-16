"""Gộp vai trò nhân sự, giữ lịch sử và chờ quản trị viên duyệt quyền mới."""

import sqlalchemy as sa
from alembic import op

revision = "008_merge_hr_role"
down_revision = "007_support_chat"
branch_labels = None
depends_on = None

# Cố định theo phiên bản migration, không phụ thuộc quyền của phiên bản app sau.
ADMIN_PERMISSIONS = [
    "accounts",
    "catalog",
    "finance",
    "hr",
    "maintenance",
    "messages",
    "reception",
    "reports",
    "workshop",
]


def upgrade():
    connection = op.get_bind()
    columns = (
        sa.Column("userId", sa.Integer, sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("wasActive", sa.Boolean, nullable=False),
        sa.Column("disabledPermissions", sa.JSON, nullable=False),
        sa.Column(
            "migratedAt", sa.DateTime, server_default=sa.func.now(), nullable=False
        ),
    )
    if sa.inspect(connection).has_table("legacy_hr_role_migration"):
        audit = sa.Table(
            "legacy_hr_role_migration", sa.MetaData(), autoload_with=connection
        )
    else:
        audit = op.create_table("legacy_hr_role_migration", *columns)
    users = sa.table(
        "users",
        sa.column("id", sa.Integer),
        sa.column("role", sa.String),
        sa.column("isActive", sa.Boolean),
        sa.column("sessionVersion", sa.Integer),
        sa.column("disabledPermissions", sa.JSON),
    )
    # Giữ nguyên ID để phiếu, hồ sơ và lịch sử phê duyệt vẫn trỏ đúng người.
    for old in connection.execute(
        sa.select(users).where(users.c.role == "hr")
    ).mappings():
        connection.execute(
            audit.insert().values(
                userId=old["id"],
                wasActive=old["isActive"],
                disabledPermissions=old["disabledPermissions"] or [],
            )
        )
        connection.execute(
            users.update()
            .where(users.c.id == old["id"])
            .values(
                role="admin",
                isActive=False,
                sessionVersion=(old["sessionVersion"] or 0) + 1,
                disabledPermissions=ADMIN_PERMISSIONS,
            )
        )


def downgrade():
    raise RuntimeError("Restore a verified backup to revert the HR role migration.")
