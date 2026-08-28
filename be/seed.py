"""
GarageCar — Seed Script
=======================
Tạo dữ liệu mẫu để phát triển và demo.

Cách chạy:
    cd be
    python seed.py

Dữ liệu được tạo:
    - 3 tài khoản: admin / mechanic / customer (password: 123456)
    - 2 hồ sơ thợ (Mechanic profile)
    - 2 xe
    - 3 vật tư tồn kho
    - 1 phiếu sửa chữa mẫu với 3 hạng mục
"""

import asyncio
from sqlalchemy import select

from database.engine import engine, Base
from database.session import AsyncSessionLocal
from models.user import User
from models.mechanic import Mechanic
from models.vehicle import Vehicle
from models.inventory import Inventory
from models.repair_ticket import RepairTicket
from models.repair_item import RepairItem
from core.security import hash_password


# ── Dữ liệu mẫu ───────────────────────────────────────────────────────────────

USERS = [
    {
        "username": "admin",
        "email": "admin@autopro.com",
        "password": "123456",
        "fullName": "Nguyen Quan Tri",
        "role": "admin",
    },
    {
        "username": "mechanic1",
        "email": "mechanic@autopro.com",
        "password": "123456",
        "fullName": "Tran Van Tho",
        "role": "mechanic",
    },
    {
        "username": "customer1",
        "email": "customer@autopro.com",
        "password": "123456",
        "fullName": "Le Van Khach",
        "role": "customer",
    },
]

MECHANICS = [
    {"fullName": "Tran Van Tho", "phone": "0901234567", "specialty": "Dong co - May gam"},
    {"fullName": "Pham Thi Ky", "phone": "0912345678", "specialty": "Dien - Dien tu"},
]

VEHICLES = [
    {
        "licensePlate": "51A-12345",
        "customerName": "Le Van Khach",
        "phone": "0987654321",
        "address": "123 Nguyen Trai, Q.1, TP.HCM",
        "carBrand": "Toyota",
        "carModel": "Vios",
        "status": "repairing",
    },
    {
        "licensePlate": "30H-56789",
        "customerName": "Nguyen Thi Lan",
        "phone": "0976543210",
        "address": "456 Le Loi, Hoan Kiem, Ha Noi",
        "carBrand": "Honda",
        "carModel": "City",
        "status": "waiting",
    },
]

INVENTORY = [
    {"name": "Dau dong co 5W-30", "unit": "lit", "quantity": 50, "unitPrice": 85000},
    {"name": "Loc dau", "unit": "cai", "quantity": 30, "unitPrice": 65000},
    {"name": "Bugi NGK", "unit": "bo", "quantity": 20, "unitPrice": 180000},
]


# ── Helpers ────────────────────────────────────────────────────────────────────

async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("+ Bang database da san sang")


async def user_exists(db, email: str) -> bool:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none() is not None


# ── Seed functions ─────────────────────────────────────────────────────────────

async def seed_users(db) -> None:
    count = 0
    for u in USERS:
        if await user_exists(db, u["email"]):
            print(f"  Skip: User '{u['email']}' da ton tai")
            continue
        user = User(
            username=u["username"],
            email=u["email"],
            password=hash_password(u["password"]),
            fullName=u["fullName"],
            role=u["role"],
        )
        db.add(user)
        count += 1
    await db.commit()
    print(f"+ Da tao {count} user(s)")


async def seed_mechanics(db) -> None:
    count = 0
    for m in MECHANICS:
        result = await db.execute(
            select(Mechanic).where(Mechanic.fullName == m["fullName"])
        )
        if result.scalar_one_or_none():
            print(f"  Skip: Tho '{m['fullName']}' da ton tai")
            continue
        db.add(Mechanic(**m))
        count += 1
    await db.commit()
    print(f"+ Da tao {count} ho so tho")


async def seed_vehicles(db) -> None:
    count = 0
    for v in VEHICLES:
        result = await db.execute(
            select(Vehicle).where(Vehicle.licensePlate == v["licensePlate"])
        )
        if result.scalar_one_or_none():
            print(f"  Skip: Xe '{v['licensePlate']}' da ton tai")
            continue
        db.add(Vehicle(**v))
        count += 1
    await db.commit()
    print(f"+ Da tao {count} xe")


async def seed_inventory(db) -> None:
    count = 0
    for item in INVENTORY:
        result = await db.execute(
            select(Inventory).where(Inventory.name == item["name"])
        )
        if result.scalar_one_or_none():
            print(f"  Skip: Vat tu '{item['name']}' da ton tai")
            continue
        db.add(Inventory(**item))
        count += 1
    await db.commit()
    print(f"+ Da tao {count} vat tu")


async def seed_repairs(db) -> None:
    result = await db.execute(select(RepairTicket))
    if result.scalars().first():
        print("  Skip: Phieu sua chua da ton tai")
        return

    v_result = await db.execute(select(Vehicle).where(Vehicle.licensePlate == "51A-12345"))
    vehicle = v_result.scalar_one_or_none()
    if not vehicle:
        print("  WARNING: Khong tim thay xe 51A-12345, bo qua tao phieu")
        return

    ticket = RepairTicket(
        vehicleId=vehicle.id,
        mechanicName="Tran Van Tho",
        totalAmount=1_150_000,
        status="working",
    )
    db.add(ticket)
    await db.flush()

    items = [
        RepairItem(
            repairTicketId=ticket.id,
            taskName="Thay dau dong co",
            partName="Dau 5W-30",
            quantity=4,
            partPrice=85_000,
            laborPrice=50_000,
            totalPrice=390_000,
            isCompleted=True,
        ),
        RepairItem(
            repairTicketId=ticket.id,
            taskName="Thay loc dau",
            partName="Loc dau",
            quantity=1,
            partPrice=65_000,
            laborPrice=30_000,
            totalPrice=95_000,
            isCompleted=False,
        ),
        RepairItem(
            repairTicketId=ticket.id,
            taskName="Thay bugi",
            partName="Bugi NGK",
            quantity=4,
            partPrice=180_000,
            laborPrice=100_000,
            totalPrice=820_000,
            isCompleted=False,
        ),
    ]
    for item in items:
        db.add(item)

    await db.commit()
    print("+ Da tao 1 phieu sua chua mau voi 3 hang muc")


# ── Main ───────────────────────────────────────────────────────────────────────

async def main() -> None:
    print("\nGarageCar -- Seeding du lieu mau\n" + "=" * 40)

    await create_tables()

    async with AsyncSessionLocal() as db:
        await seed_users(db)
        await seed_mechanics(db)
        await seed_vehicles(db)
        await seed_inventory(db)
        await seed_repairs(db)

    print("\nSeed hoan tat! Tai khoan mau:")
    print("   Admin    : admin@autopro.com    / 123456")
    print("   Mechanic : mechanic@autopro.com / 123456")
    print("   Customer : customer@autopro.com / 123456\n")


if __name__ == "__main__":
    asyncio.run(main())
