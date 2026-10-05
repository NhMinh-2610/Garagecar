"""Add researched brands without renaming custom or historical entries."""

from alembic import op
import sqlalchemy as sa

revision = "006_car_brands"
down_revision = "005_professional_workflow"
branch_labels = None
depends_on = None

BRANDS = (
    "Honda",
    "Toyota",
    "Hyundai",
    "Kia",
    "Mazda",
    "Ford",
    "Mitsubishi",
    "VinFast",
    "Nissan",
    "Suzuki",
    "Isuzu",
    "Subaru",
    "Mercedes-Benz",
    "BMW",
    "MG",
)


def upgrade():
    bind = op.get_bind()
    brands = sa.table("brands", sa.column("name", sa.String()))
    existing = {
        name.strip().casefold()
        for name in bind.execute(sa.select(brands.c.name)).scalars()
    }
    for name in BRANDS:
        if name.casefold() not in existing:
            bind.execute(brands.insert().values(name=name))
            existing.add(name.casefold())


def downgrade():
    raise RuntimeError(
        "Keep brand entries used by historical vehicles; restore a verified backup if required."
    )
