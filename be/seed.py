"""Create a small coherent demo dataset on a migrated development database."""
import asyncio
from sqlalchemy import select
from database.engine import engine
from database.session import AsyncSessionLocal
from core.security import hash_password
from models import User, Mechanic, Vehicle, Inventory, RepairTicket
from schemas.repair import RepairItemCreate
from services.repair_service import replace_items, sync_vehicle


async def main():
    async with AsyncSessionLocal() as db:
        if await db.scalar(select(User.id).limit(1)):
            print('Database already contains users. Demo seed skipped; existing data is unchanged.')
            return
        admin = User(username='admin', email='admin@autopro.com', password=hash_password('123456'), fullName='Quản trị viên', role='admin')
        worker = User(username='mechanic1', email='mechanic@autopro.com', password=hash_password('123456'), fullName='Trần Văn Thợ', role='mechanic')
        customer = User(username='customer1', email='customer@autopro.com', password=hash_password('123456'), fullName='Lê Văn Khách', role='customer')
        db.add_all([admin, worker, customer])
        await db.flush()
        mechanic = Mechanic(fullName=worker.fullName, userId=worker.id, specialty='Máy gầm')
        vehicle = Vehicle(licensePlate='51A12345', customerId=customer.id, customerName=customer.fullName, phone='0901234567', carBrand='Toyota', carModel='Vios')
        part = Inventory(name='Dầu động cơ 5W-30', quantity=50, unitPrice=85000)
        db.add_all([mechanic, vehicle, part])
        await db.flush()
        from models.inventory_movement import InventoryMovement
        db.add(InventoryMovement(inventoryId=part.id, quantityChange=50, balanceAfter=50, reason='opening'))
        ticket = RepairTicket(vehicle=vehicle, mechanicId=mechanic.id, mechanicName=mechanic.fullName, status='draft', items=[])
        db.add(ticket)
        await db.flush()
        await replace_items(db, ticket, [RepairItemCreate(taskName='Thay nhớt', inventoryId=part.id, quantity=4, laborPrice=50000)])
        await sync_vehicle(db, vehicle)
        await db.commit()
        print('Demo ready: admin@autopro.com, mechanic@autopro.com, customer@autopro.com / 123456')
    await engine.dispose()


if __name__ == '__main__':
    asyncio.run(main())
