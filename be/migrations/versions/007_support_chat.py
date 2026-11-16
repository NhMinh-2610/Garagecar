"""Add private customer/garage messages without changing existing business records."""

from alembic import op
from database.engine import Base
import models  # noqa: F401

revision = "007_support_chat"
down_revision = "006_car_brands"
branch_labels = None
depends_on = None


def upgrade():
    for name in ("support_conversations", "support_messages", "support_reads"):
        Base.metadata.tables[name].create(op.get_bind(), checkfirst=True)


def downgrade():
    raise RuntimeError("Restore a verified backup to remove private chat history.")
