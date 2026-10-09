"""Explicit PostgreSQL backup, migration and post-migration audit commands."""

import argparse
import asyncio
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import func, select
from sqlalchemy.engine import make_url

from config.settings import settings

ROOT = Path(__file__).resolve().parents[1]


def backup():
    executable = shutil.which("pg_dump")
    if executable is None:
        raise SystemExit(
            "pg_dump not found. Add the PostgreSQL bin directory to PATH first."
        )
    url = make_url(settings.database_url)
    directory = ROOT / ".backups"
    directory.mkdir(exist_ok=True)
    target = directory / f"garagecar-{datetime.now():%Y%m%d-%H%M%S-%f}.dump"
    env = {**os.environ, "PGPASSWORD": url.password or ""}
    subprocess.run(
        [
            executable,
            "--host",
            url.host or "localhost",
            "--port",
            str(url.port or 5432),
            "--username",
            url.username or "postgres",
            "--dbname",
            url.database,
            "--format=custom",
            "--no-password",
            "--file",
            str(target),
        ],
        env=env,
        check=True,
    )
    print(f"Backup: {target}")
    return target


async def audit():
    from database.engine import engine
    from database.session import AsyncSessionLocal
    from models import Mechanic, RepairItem, RepairTicket, Vehicle

    async with AsyncSessionLocal() as db:
        for model, column, label in [
            (Vehicle, Vehicle.customerId, "Vehicles without customer account"),
            (Mechanic, Mechanic.userId, "Mechanics without login account"),
            (RepairTicket, RepairTicket.mechanicId, "Tickets without mechanic ID"),
        ]:
            count = await db.scalar(
                select(func.count()).select_from(model).where(column.is_(None))
            )
            print(f"{label}: {count}")
        total = (
            select(func.coalesce(func.sum(RepairItem.totalPrice), 0))
            .where(RepairItem.repairTicketId == RepairTicket.id)
            .scalar_subquery()
        )
        ids = (
            await db.scalars(
                select(RepairTicket.id).where(
                    RepairTicket.status == "paid", RepairTicket.totalAmount != total
                )
            )
        ).all()
        print(f"Historical paid totals needing manual review (unchanged): {ids}")
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["backup", "upgrade", "audit"])
    args = parser.parse_args()
    if args.action == "backup":
        backup()
    elif args.action == "upgrade":
        backup()  # fail closed: no schema changes when the backup fails
        command.upgrade(Config(str(Path(__file__).with_name("alembic.ini"))), "head")
        asyncio.run(audit())
    else:
        asyncio.run(audit())
