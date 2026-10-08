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
    for filename in ["001_relational_workflow.py", "002_login_attempts.py", "003_account_management.py", "004_garage_care.py", "005_professional_workflow.py", "006_car_brands.py"]:
        spec = importlib.util.spec_from_file_location("migration", Path(__file__).parents[1] / "migrations/versions" / filename)
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
            stock = Inventory(name="Oil", quantity=5, unitPrice=100, sku="OIL-001")
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
async def test_admin_account_lifecycle_and_revoked_sessions(api):
    client, auth, ids, factory, _ = api
    body = {"username":"newcustomer", "email":"new@example.com", "fullName":"New Customer",
            "password":"initial123", "role":"customer"}
    assert (await client.post('/api/auth/users', headers=auth('customer'), json=body)).status_code == 403
    created = await client.post('/api/auth/users', headers=auth('admin'), json=body)
    assert created.status_code == 201, created.text
    uid = created.json()['data']['id']
    assert 'password' not in created.json()['data']
    login = await client.post('/api/auth/login', json={"email":body['email'], "password":body['password']})
    assert login.status_code == 200, login.text
    token = {'Authorization':'Bearer '+login.json()['data']['token']}
    assert (await client.get('/api/auth/me', headers=token)).status_code == 200
    edit = {key:body[key] for key in ['username','email','fullName']}
    edit['isActive'] = False
    assert (await client.put(f'/api/auth/users/{uid}', headers=auth('admin'), json=edit)).status_code == 200
    assert (await client.get('/api/auth/me', headers=token)).status_code == 401
    assert (await client.post('/api/auth/login', json={"email":body['email'], "password":body['password']})).status_code == 401
    edit['isActive'] = True
    assert (await client.put(f'/api/auth/users/{uid}', headers=auth('admin'), json=edit)).status_code == 200
    assert (await client.get('/api/auth/me', headers=token)).status_code == 401  # unlocking must not restore old sessions
    login = await client.post('/api/auth/login', json={"email":body['email'], "password":body['password']})
    token = {'Authorization':'Bearer '+login.json()['data']['token']}
    reset = await client.post(f'/api/auth/users/{uid}/password', headers=auth('admin'), json={'password':'reset12345'})
    assert reset.status_code == 200
    assert (await client.get('/api/auth/me', headers=token)).status_code == 401
    login = await client.post('/api/auth/login', json={"email":body['email'], "password":"reset12345"})
    assert login.status_code == 200
    token = {'Authorization':'Bearer '+login.json()['data']['token']}
    assert (await client.put('/api/auth/me/password', headers=token,json={'currentPassword':'wrong','password':'personal123'})).status_code == 400
    assert (await client.put('/api/auth/me/password', headers=token,json={'currentPassword':'reset12345','password':'personal123'})).status_code == 200
    assert (await client.get('/api/auth/me', headers=token)).status_code == 401
    assert (await client.post('/api/auth/login', json={'email':body['email'],'password':'personal123'})).status_code == 200
    self_edit = {'username':'admin','email':'admin@example.com','fullName':'Admin','isActive':False}
    assert (await client.put(f'/api/auth/users/{ids["admin"]}', headers=auth('admin'), json=self_edit)).status_code == 409
    assert (await client.put(f'/api/auth/users/{uid}', headers=auth('admin'), json={**edit,'role':'admin'})).status_code == 422


@pytest.mark.asyncio
async def test_account_creation_links_existing_profiles_atomically(api):
    client, auth, ids, factory, _ = api
    async with factory() as db:
        customer_vehicle = Vehicle(licensePlate='NEW-01',customerName='Owner',phone='0901234567',carBrand='Toyota')
        staff = Mechanic(fullName='New Mechanic')
        db.add_all([customer_vehicle,staff]); await db.commit()
        vid, mid = customer_vehicle.id, staff.id
    body = {'username':'owner','email':'owner@example.com','fullName':'Owner','password':'initial123','role':'customer','vehicleIds':[vid]}
    created = await client.post('/api/auth/users',headers=auth('admin'),json=body)
    assert created.status_code == 201, created.text
    owner_id = created.json()['data']['id']
    own = {'Authorization':'Bearer '+create_access_token({'id':owner_id})}
    assert (await client.get('/api/vehicles/my-vehicles',headers=own)).json()['data'][0]['id'] == vid
    duplicate = {**body,'username':'otherowner','email':'otherowner@example.com'}
    assert (await client.post('/api/auth/users',headers=auth('admin'),json=duplicate)).status_code == 409
    worker = {**body,'username':'newworker','email':'worker@example.com','role':'mechanic','mechanicId':mid,'vehicleIds':[]}
    created_worker = await client.post('/api/auth/users',headers=auth('admin'),json=worker)
    assert created_worker.status_code == 201, created_worker.text
    async with factory() as db:
        assert (await db.get(Mechanic,mid)).userId == created_worker.json()['data']['id']
        assert (await db.get(Vehicle,vid)).customerId == owner_id
        assert await db.scalar(select(User.id).where(User.username=='otherowner')) is None
    assert (await client.delete(f'/api/auth/users/{owner_id}',headers=auth('admin'))).status_code == 409
    assert (await client.post('/api/auth/register',json={**worker,'username':'public','email':'public@example.com'})).json()['data']['role'] == 'customer'


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
    await evidence(client, auth, ticket)
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


@pytest.mark.asyncio
async def test_staff_edit_preserves_account_and_can_reactivate(api):
    client, auth, ids, _, _ = api
    path = f"/api/mechanics/{ids['mechanic_id']}"
    response = await client.put(path,headers=auth('admin'),json={'fullName':'Updated Name','phone':'0912345678','status':'inactive'})
    assert response.status_code == 200, response.text
    assert response.json()['data']['userId'] == ids['mechanic']
    assert (await client.get('/api/mechanics',headers=auth('admin'))).json()['data'] == []
    rows = (await client.get('/api/mechanics?include_inactive=true',headers=auth('admin'))).json()['data']
    assert len(rows) == 1 and rows[0]['status'] == 'inactive'
    assert (await client.get('/api/mechanics?include_inactive=true',headers=auth('mechanic'))).status_code == 403
    assert (await client.put(path,headers=auth('admin'),json={'status':'active'})).status_code == 200
    vid = await vehicle(client,auth,ids)
    assert (await client.post('/api/repairs',headers=auth('admin'),json=repair_body(vid,ids))).status_code == 201
    assert (await client.put(path,headers=auth('admin'),json={'status':'inactive'})).status_code == 409


@pytest.mark.asyncio
async def test_catalog_edits_update_vehicle_brand(api):
    client, auth, ids, _, _ = api
    vid = await vehicle(client,auth,ids)
    brands = (await client.get('/api/settings/brands')).json()['data']
    bid = next(b['id'] for b in brands if b['name']=='Toyota')
    assert (await client.put(f'/api/settings/brands/{bid}',headers=auth('admin'),json={'name':'Toyota Updated'})).status_code == 200
    assert (await client.get(f'/api/vehicles/{vid}',headers=auth('admin'))).json()['data']['carBrand'] == 'Toyota Updated'
    wages = (await client.get('/api/settings/wages')).json()['data']
    wid = wages[0]['id']
    response = await client.put(f'/api/settings/wages/{wid}',headers=auth('admin'),json={'name':'Updated task','price':75000})
    assert response.status_code == 200 and float(response.json()['data']['price']) == 75000


async def evidence(client, auth, ticket):
    import base64
    import io
    from PIL import Image
    image = io.BytesIO()
    Image.new("RGB", (8, 8), "blue").save(image, format="PNG")
    encoded = base64.b64encode(image.getvalue()).decode()
    for item in ticket["items"]:
        for kind in (["package", "completion"] if item.get("inventoryId") else ["completion"]):
            result = await client.post(f"/api/workshop/tickets/{ticket['id']}/items/{item['id']}/evidence", headers=auth("mechanic"), json={"kind":kind,"image":encoded,"productCode":"OIL-001" if kind == "package" else None,"note":"Measured and verified"})
            assert result.status_code == 201, result.text
