"""add login_attempts table

Revision ID: 002_login_attempts
Revises: 001_relational_workflow
Create Date: 2026-09-28
"""
from alembic import op
import sqlalchemy as sa

revision = "002_login_attempts"
down_revision = "001_relational_workflow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("login_attempts"):
        return
    op.create_table(
        "login_attempts",
        sa.Column("id",           sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column("identifier",   sa.String(255),   nullable=False),
        sa.Column("success",      sa.Boolean(),     nullable=False, server_default="false"),
        sa.Column("attempted_at", sa.DateTime(),    nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_login_attempts_identifier", "login_attempts", ["identifier"])


def downgrade() -> None:
    op.drop_index("ix_login_attempts_identifier", "login_attempts")
    op.drop_table("login_attempts")
