"""PostgreSQL integration tests in a unique disposable schema, never public."""
import asyncio
import importlib.util
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from config.settings import settings
from core.security import create_access_token, hash_password
from database.engine import Base
from database.session import get_db
from main import app
from models import User, Mechanic, Vehicle, Inventory


def migrate(connection):
    spec = importlib.util.spec_from_file_location("migration", Path(__file__).parents[1] / "migrations/versions/001_relational_workflow.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with Operations.context(MigrationContext.configure(connection)):
        module.upgrade()


@pytest_asyncio.fixture
async def api():
    schema = "garage_test_" + uuid4().hex
    admin_engine = create_async_engine(settings.database_url)
    async with admin_engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_async_engine(settings.database_url, connect_args={"server_settings": {"search_path": schema}})
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(migrate)
        async with factory() as db:
            users = [User(username=role, email=f"{role}@example.com", fullName="Same Name",
                          role="customer" if role == "other" else role,
                          password=hash_password("123456")) for role in ["admin", "mechanic", "customer", "other"]]
            db.add_all(users)
            await db.flush()
            mechanic = Mechanic(fullName="Same Name", userId=users[1].id)
            stock = Inventory(name="Oil", quantity=5, unitPrice=100)
            db.add_all([mechanic, stock])
            await db.commit()
            ids = {u.username: u.id for u in users}
            ids.update(mechanic_id=mechanic.id, inventory_id=stock.id)
        async def session():
            async with factory() as db:
                yield db
        app.dependency_overrides[get_db] = session
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            def auth(role):
                return {"Authorization": "Bearer " + create_access_token({"id": ids[role]})}
            yield client, auth, ids, factory, engine
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
        async with admin_engine.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await admin_engine.dispose()


async def vehicle(client, auth, ids, plate="30A-12345"):
    response = await client.post("/api/vehicles", headers=auth("admin"), json={
        "licensePlate": plate, "customerId": ids["customer"], "customerName": "Same Name",
        "phone": "0901234567", "carBrand": "Toyota", "carModel": "Vios",
    })
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


def repair_body(vehicle_id, ids, quantity=2):
    return {"vehicleId": vehicle_id, "mechanicId": ids["mechanic_id"], "items": [{
        "taskName": "Change oil", "inventoryId": ids["inventory_id"], "quantity": quantity,
        "laborPrice": 50, "partPrice": 1, "totalPrice": 1,
    }]}


@pytest.mark.asyncio
async def test_complete_workflow_and_permissions(api):
    client, auth, ids, factory, _ = api
    vid = await vehicle(client, auth, ids)
    response = await client.post("/api/repairs", headers=auth("admin"), json=repair_body(vid, ids))
    assert response.status_code == 201, response.text
    ticket = response.json()["data"]
    assert ticket["totalAmount"] == 250  # ignore forged client totals/prices
    tid = ticket["id"]
    path = f"/api/repairs/{tid}"
    assert (await client.get("/api/vehicles/my-vehicles", headers=auth("other"))).json()["data"] == []
    assert (await client.get(path, headers=auth("other"))).status_code == 403
    assert len((await client.get("/api/vehicles/my-vehicles", headers=auth("customer"))).json()["data"]) == 1
    assert len((await client.get("/api/repairs/my-tasks", headers=auth("mechanic"))).json()["data"]) == 1
    assert (await client.put(path, headers=auth("admin"), json={"status":"paid"})).status_code == 409
    assert (await client.put(path, headers=auth("mechanic"), json={"mechanicId":None})).status_code == 403
    assert (await client.put(path, headers=auth("mechanic"), json={"status":"working"})).status_code == 200
    assert (await client.put(path, headers=auth("mechanic"), json={"status":"completed"})).status_code == 400
    item_path = f"{path}/items/{ticket['items'][0]['id']}/toggle"
    assert (await client.put(item_path, headers=auth("mechanic"), json={"isCompleted":True})).status_code == 200
    assert (await client.put(path, headers=auth("mechanic"), json={"status":"completed"})).status_code == 200
    assert (await client.put(f"/api/vehicles/{vid}", headers=auth("admin"), json={"status":"delivered"})).status_code == 409
    assert (await client.put(path, headers=auth("mechanic"), json={"status":"paid"})).status_code == 403
    paid = await client.put(path, headers=auth("admin"), json={"status":"paid"})
    assert paid.status_code == 200 and paid.json()["data"]["paidAt"]
    assert (await client.put(item_path, headers=auth("mechanic"), json={"isCompleted":False})).status_code == 409
    assert (await client.delete(path, headers=auth("admin"))).status_code == 409
    assert (await client.delete(f"/api/vehicles/{vid}", headers=auth("admin"))).status_code == 409
    assert (await client.put(f"/api/vehicles/{vid}", headers=auth("admin"), json={"status":"delivered"})).status_code == 200
    assert (await client.put(f"/api/vehicles/{vid}", headers=auth("admin"), json={"status":"waiting"})).status_code == 200
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 3


@pytest.mark.asyncio
async def test_stock_rollback_edit_and_cancel(api):
    client, auth, ids, factory, _ = api
    vid = await vehicle(client, auth, ids)
    assert (await client.post("/api/repairs", headers=auth("admin"), json=repair_body(vid, ids, 6))).status_code == 409
    response = await client.post("/api/repairs", headers=auth("admin"), json=repair_body(vid, ids, 3))
    assert response.status_code == 201, response.text
    path = "/api/repairs/" + str(response.json()["data"]["id"])
    assert (await client.post("/api/repairs", headers=auth("admin"), json=repair_body(vid, ids))).status_code == 409
    edited = await client.put(path, headers=auth("admin"), json={"items":repair_body(vid, ids, 4)["items"]})
    assert edited.status_code == 200, edited.text
    assert edited.json()["data"]["totalAmount"] == 450
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 1
    assert (await client.delete(path, headers=auth("admin"))).status_code == 200
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 5
        assert (await db.get(Vehicle, vid)).status == "waiting"


@pytest.mark.asyncio
async def test_concurrent_stock_reservation(api):
    client, auth, ids, factory, _ = api
    v1 = await vehicle(client, auth, ids)
    v2 = await vehicle(client, auth, ids, "30A99999")
    async with factory() as db:
        second = Mechanic(fullName="Second mechanic")
        db.add(second)
        await db.commit()
    bodies = [repair_body(v1, ids, 4), repair_body(v2, {**ids, "mechanic_id":second.id}, 4)]
    results = await asyncio.gather(*[client.post("/api/repairs", headers=auth("admin"), json=body) for body in bodies])
    assert sorted(r.status_code for r in results) == [201,409]
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 1


@pytest.mark.asyncio
async def test_validation_and_staff_link(api):
    client, auth, ids, factory, _ = api
    bad = await client.post("/api/inventory", headers=auth("admin"), json={"name":"Bad","quantity":-1,"unitPrice":-2})
    assert bad.status_code == 422 and bad.json()["success"] is False
    response = await client.post("/api/auth/register-staff", headers=auth("admin"), json={
        "username":"newmechanic", "email":"new@example.com", "password":"123456", "fullName":"New", "role":"mechanic",
    })
    assert response.status_code == 201, response.text
    async with factory() as db:
        assert await db.scalar(select(Mechanic.id).where(Mechanic.userId == response.json()["data"]["id"]))


@pytest.mark.asyncio
async def test_migration_repeat_is_safe(api):
    _, _, _, _, engine = api
    async with engine.begin() as connection:
        await connection.run_sync(migrate)


@pytest.mark.asyncio
async def test_legacy_migration_keeps_rows_without_guessing_accounts(api):
    client, auth, ids, _, engine = api
    vid = await vehicle(client, auth, ids)
    async with engine.begin() as conn:
        for table, column in [("vehicles", "customerId"), ("mechanics", "userId"), ("repair_tickets", "mechanicId"), ("repair_items", "inventoryId")]:
            await conn.execute(text(f'ALTER TABLE "{table}" DROP COLUMN "{column}"'))
        await conn.run_sync(migrate)
        row = (await conn.execute(text('SELECT id, "customerId", "customerName" FROM vehicles'))).one()
        assert row.id == vid and row.customerId is None and row.customerName == "Same Name"


@pytest.mark.asyncio
async def test_stock_receipt_ledger_and_revenue_date(api):
    from datetime import datetime
    from models import RepairTicket
    from models.inventory_movement import InventoryMovement
    client, auth, ids, factory, _ = api
    response = await client.post(f"/api/inventory/{ids['inventory_id']}/receive", headers=auth("admin"), json={"quantity":3,"unitPrice":200})
    assert response.status_code == 200 and response.json()["data"]["quantity"] == 8
    vid = await vehicle(client, auth, ids)
    response = await client.post("/api/repairs", headers=auth("admin"), json=repair_body(vid, ids))
    ticket = response.json()["data"]
    assert ticket["totalAmount"] == 450
    response = await client.get('/api/reports/revenue?month=2026-09', headers=auth('admin'))
    assert response.status_code == 200 and response.json()['data'] == []
    async with factory() as db:
        rows = (await db.scalars(select(InventoryMovement).order_by(InventoryMovement.id))).all()
        assert [row.quantityChange for row in rows] == [3,-2]
        assert rows[-1].balanceAfter == 6
        db.add(RepairTicket(vehicleId=vid, status="paid", totalAmount=123,
                            paidAt=datetime(2026, 8, 31, 18), mechanicId=ids['mechanic_id']))
        await db.commit()
    september = (await client.get('/api/reports/revenue?month=2026-09', headers=auth('admin'))).json()['data']
    august = (await client.get('/api/reports/revenue?month=2026-08', headers=auth('admin'))).json()['data']
    assert september == [{'brand':'Toyota','count':1,'revenue':123}]
    assert august == []


@pytest.mark.asyncio
async def test_booking_persists_and_admin_controls_status(api):
    from datetime import date, timedelta
    client, auth, _, _, _ = api
    response = await client.post('/api/bookings', json={
        'customerName':'Customer','phone':'0901234567','service':'Maintenance',
        'preferredDate':str(date.today() + timedelta(days=1)),
    })
    assert response.status_code == 201
    bid = response.json()['data']['id']
    assert (await client.get('/api/bookings',headers=auth('customer'))).status_code == 403
    assert (await client.put(f'/api/bookings/{bid}',headers=auth('admin'),json={'status':'confirmed'})).status_code == 200
    rows = (await client.get('/api/bookings',headers=auth('admin'))).json()['data']
    assert rows[0]['status'] == 'confirmed'
