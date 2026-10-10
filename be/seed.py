"""Seed development data; --demo adds complete, isolated garage scenarios."""

import argparse
import asyncio
import sys

from sqlalchemy import select

from core.security import hash_password
from database.engine import engine
from database.session import AsyncSessionLocal
from models import Inventory, Mechanic, RepairTicket, User, Vehicle
from schemas.repair import RepairItemCreate
from services.repair_service import replace_items, sync_vehicle


async def seed_basic():
    async with AsyncSessionLocal() as db:
        if await db.scalar(select(User.id).limit(1)):
            print(
                "Database already contains users. Demo seed skipped; existing data is unchanged."
            )
            return
        admin = User(
            username="admin",
            email="admin@autopro.com",
            password=hash_password("123456"),
            fullName="Quản trị viên",
            role="admin",
        )
        worker = User(
            username="mechanic1",
            email="mechanic@autopro.com",
            password=hash_password("123456"),
            fullName="Trần Văn Thợ",
            role="mechanic",
        )
        customer = User(
            username="customer1",
            email="customer@autopro.com",
            password=hash_password("123456"),
            fullName="Lê Văn Khách",
            role="customer",
        )
        db.add_all([admin, worker, customer])
        await db.flush()
        mechanic = Mechanic(
            fullName=worker.fullName, userId=worker.id, specialty="Máy gầm"
        )
        vehicle = Vehicle(
            licensePlate="51A12345",
            customerId=customer.id,
            customerName=customer.fullName,
            phone="0901234567",
            carBrand="Toyota",
            carModel="Vios",
        )
        part = Inventory(name="Dầu động cơ 5W-30", quantity=50, unitPrice=85000)
        db.add_all([mechanic, vehicle, part])
        await db.flush()
        from models.inventory_movement import InventoryMovement

        db.add(
            InventoryMovement(
                inventoryId=part.id,
                quantityChange=50,
                balanceAfter=50,
                reason="opening",
            )
        )
        ticket = RepairTicket(
            vehicle=vehicle,
            mechanicId=mechanic.id,
            mechanicName=mechanic.fullName,
            status="draft",
            items=[],
        )
        db.add(ticket)
        await db.flush()
        await replace_items(
            db,
            ticket,
            [
                RepairItemCreate(
                    taskName="Thay nhớt",
                    inventoryId=part.id,
                    quantity=4,
                    laborPrice=50000,
                )
            ],
        )
        await sync_vehicle(db, vehicle)
        await db.commit()
        print(
            "Demo ready: admin@autopro.com, mechanic@autopro.com, customer@autopro.com / 123456"
        )


async def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="Seed development data without replacing existing records."
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Add complete demo scenarios without changing existing data",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Validate --demo inside a transaction, then roll it back",
    )
    args = parser.parse_args()
    if args.preview and not args.demo:
        parser.error("--preview requires --demo")
    try:
        if not args.demo:
            await seed_basic()
            return
        from services.demo_seed import DEMO_PASSWORD, DemoCollisionError, seed_demo

        async with AsyncSessionLocal() as db:
            try:
                manifest = await seed_demo(db)
                if args.preview:
                    await db.rollback()
                    print(
                        "Demo preview passed; transaction rolled back. No rows were changed."
                    )
                else:
                    await db.commit()
                    print(
                        "Demo dataset created."
                        if manifest["created"]
                        else "Demo dataset already exists; no records or passwords were changed."
                    )
            except DemoCollisionError as error:
                await db.rollback()
                raise SystemExit(str(error)) from error
        print(f"Demo anchor date: {manifest['anchorDate']}")
        print(
            "Demo records: "
            + ", ".join(
                f"{table}={count}" for table, count in manifest["counts"].items()
            )
        )
        if not args.preview:
            print(
                "New demo account password: "
                + DEMO_PASSWORD
                + " (existing passwords are never reset)"
            )
            for account in manifest["accounts"]:
                print(f"  {account['role']}: {account['email']}")
        print(manifest["warning"])
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
