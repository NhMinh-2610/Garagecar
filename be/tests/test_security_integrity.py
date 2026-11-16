"""Regression tests for retries, lock order, clean auth and complete pagination."""

import asyncio
import base64
import hashlib
import hmac
import json
import sys
import time
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import bcrypt
import httpx
import pytest
from config.settings import Settings
from core.security import async_hash_password, verify_password
from main import app
from models import (
    Inventory,
    InventoryMovement,
    RepairEvidence,
    RepairTicket,
    User,
    Vehicle,
    VehicleCare,
    ServiceVisit,
)
from models.professional import Expense, PaymentReceipt
from models.request_control import RequestReplay
from core.time import utcnow
from pydantic import ValidationError
from schemas.garage_care import today
from services.maintenance_service import scan_all_reminders
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from test_professional import photo
from test_workflow import api as api
from test_workflow import evidence, repair_body, vehicle


class LostResponse(httpx.AsyncBaseTransport):
    """Run the application through commit, then drop its response on the wire."""

    def __init__(self):
        self.inner = httpx.ASGITransport(app=app)
        self.drop = True
        self.committed = None

    async def handle_async_request(self, request):
        response = await self.inner.handle_async_request(request)
        if self.drop:
            self.drop = False
            self.committed = json.loads(await response.aread())
            await response.aclose()
            raise httpx.ReadTimeout("Response lost AFTER commit", request=request)
        return response


@pytest.mark.asyncio
async def test_network_timeout_retry_stock_and_photo_quota(api):
    client, auth, ids, factory, _ = api
    stock_path = f"/api/inventory/{ids['inventory_id']}/receive"
    headers = {**auth("admin"), "Idempotency-Key": str(uuid4())}
    transport = LostResponse()
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as network:
        with pytest.raises(httpx.ReadTimeout):
            await network.post(stock_path, headers=headers, json={"quantity": 2})
        replies = await asyncio.gather(
            *[
                network.post(stock_path, headers=headers, json={"quantity": 2})
                for _ in range(3)
            ]
        )
    assert all(
        r.status_code == 200 and r.json() == transport.committed for r in replies
    )
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 7
        assert await db.scalar(select(func.count()).select_from(InventoryMovement)) == 1
        assert await db.scalar(select(func.count()).select_from(RequestReplay)) == 1
    assert (
        await client.post(stock_path, headers=headers, json={"quantity": 3})
    ).status_code == 409
    # A distinct deliberate receipt with the same body has a different operation ID.
    assert (
        await client.post(stock_path, headers=auth("admin"), json={"quantity": 2})
    ).json()["data"]["quantity"] == 9

    vid = await vehicle(client, auth, ids)
    ticket = (
        await client.post(
            "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
        )
    ).json()["data"]
    assert (
        await client.put(
            f"/api/repairs/{ticket['id']}",
            headers=auth("mechanic"),
            json={"status": "working"},
        )
    ).status_code == 200
    path = f"/api/workshop/tickets/{ticket['id']}/items/{ticket['items'][0]['id']}/evidence"
    body = {"kind": "completion", "image": photo(), "note": "Checked after repair"}
    headers = {**auth("mechanic"), "Idempotency-Key": str(uuid4())}
    transport = LostResponse()
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as network:
        with pytest.raises(httpx.ReadTimeout):
            await network.post(path, headers=headers, json=body)
        retries = await asyncio.gather(
            *[network.post(path, headers=headers, json=body) for _ in range(3)]
        )
    assert all(
        r.status_code == 201 and r.json() == transport.committed for r in retries
    )
    for _ in range(11):
        assert (
            await client.post(path, headers=auth("mechanic"), json=body)
        ).status_code == 201
    assert (
        await client.post(path, headers=auth("mechanic"), json=body)
    ).status_code == 409
    # Replaying an old response still works at quota, rather than consuming slot 13.
    assert (
        await client.post(path, headers=headers, json=body)
    ).json() == transport.committed
    async with factory() as db:
        rows = list((await db.scalars(select(RepairEvidence))).all())
        assert len(rows) == 12 and {r.slot for r in rows} == set(range(1, 13))
        sample = rows[0]
        db.add(
            RepairEvidence(
                itemId=sample.itemId,
                round=1,
                slot=13,
                kind="completion",
                note="Bypass application quota",
                image=b"x",
                sha256="0" * 64,
                createdBy=ids["mechanic"],
            )
        )
        with pytest.raises(IntegrityError):
            await db.flush()
        await db.rollback()


@pytest.mark.asyncio
async def test_parallel_vehicle_updates_while_global_scan_runs(api, monkeypatch):
    from routers import maintenance as router

    client, auth, ids, factory, _ = api
    vids = [await vehicle(client, auth, ids, plate=f"30A-81{n:03}") for n in range(6)]
    async with factory() as db:
        for vid in vids:
            db.add(
                VehicleCare(
                    vehicleId=vid,
                    modelYear=2023,
                    engine="1.5",
                    gearbox="CVT",
                    firstUseDate=today() - timedelta(days=365),
                    odometer=1000,
                    observedOn=today(),
                    updatedBy=ids["admin"],
                )
            )
        await db.commit()
    held, release = asyncio.Event(), asyncio.Event()
    count = 0
    original = router.scan_reminders

    async def pause_after_vehicle_lock(db, vehicle_ids=None, **kwargs):
        nonlocal count
        assert vehicle_ids is not None and len(vehicle_ids) == 1
        count += 1
        if count == len(vids):
            held.set()
        await release.wait()
        return await original(db, vehicle_ids, **kwargs)

    monkeypatch.setattr(router, "scan_reminders", pause_after_vehicle_lock)
    body = {
        "component": "engine_oil",
        "action": "replace",
        "performedOn": str(today()),
        "odometer": 1000,
        "note": "Concurrent maintenance",
    }
    tasks = [
        asyncio.create_task(
            client.post(
                f"/api/maintenance/vehicles/{vid}/records",
                headers=auth("admin"),
                json=body,
            )
        )
        for vid in vids
    ]
    try:
        await asyncio.wait_for(held.wait(), 12)
        async with factory() as db:
            # The global scan runs while ALL six mutation transactions hold locks.
            await asyncio.wait_for(scan_all_reminders(db), 5)
        release.set()
        responses = await asyncio.wait_for(asyncio.gather(*tasks), 12)
        assert [r.status_code for r in responses] == [201] * 6
    finally:
        release.set()
        await asyncio.gather(*tasks, return_exceptions=True)
    async with factory() as db:
        assert await db.scalar(text("SELECT count(*) FROM maintenance_records")) == 6


@pytest.mark.asyncio
async def test_direct_api_and_database_reject_workshop_disabled_mechanic(api):
    client, auth, ids, factory, _ = api
    vid = await vehicle(client, auth, ids)
    async with factory() as db:
        user = await db.get(User, ids["mechanic"])
        user.disabledPermissions = ["workshop"]
        await db.commit()
    assert (
        await client.post(
            "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
        )
    ).status_code == 409
    visit_body = {
        "vehicleId": vid,
        "mechanicId": ids["mechanic_id"],
        "concern": "Engine noise",
        "initialInspection": "Check engine",
    }
    assert (
        await client.post("/api/service/visits", headers=auth("admin"), json=visit_body)
    ).status_code == 409
    created = await client.post(
        "/api/service/visits",
        headers=auth("admin"),
        json={**visit_body, "mechanicId": None},
    )
    assert created.status_code == 201
    visit_id = created.json()["data"]["id"]
    assert (
        await client.put(
            f"/api/service/visits/{visit_id}/assignment",
            headers=auth("admin"),
            json={"mechanicId": ids["mechanic_id"]},
        )
    ).status_code == 409
    assert (await client.get("/api/service/resources", headers=auth("admin"))).json()[
        "data"
    ]["mechanics"] == []
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(RepairTicket)) == 0
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 5
        db.add(
            RepairTicket(
                vehicleId=vid,
                mechanicId=ids["mechanic_id"],
                status="draft",
                totalAmount=0,
            )
        )
        with pytest.raises(IntegrityError):
            await db.flush()
        await db.rollback()


@pytest.mark.asyncio
@pytest.mark.parametrize("prefix", [b"2a", b"2b", b"2y"])
async def test_legacy_bcrypt_login_without_passlib_upgrades_hash(
    api, monkeypatch, prefix
):
    client, _, ids, factory, _ = api
    password = "legacy-password"
    stored = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4))
    stored = b"$" + prefix + stored[3:]
    monkeypatch.setitem(sys.modules, "passlib", None)
    async with factory() as db:
        user = await db.get(User, ids["customer"])
        user.password = stored.decode()
        await db.commit()
    response = await client.post(
        "/api/auth/login", json={"email": "customer@example.com", "password": password}
    )
    assert response.status_code == 200, response.text
    async with factory() as db:
        user = await db.get(User, ids["customer"])
        assert user.password.startswith("$argon2id$") and verify_password(
            password, user.password
        )
    assert (
        await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer " + response.json()["data"]["token"]},
        )
    ).status_code == 200


@pytest.mark.asyncio
async def test_more_than_1000_rows_are_reachable_through_keyset_pages(api):
    client, auth, ids, factory, _ = api
    async with factory() as db:
        db.add_all(
            [
                Inventory(
                    name=f"Bulk part {n}", sku=f"BULK-{n}", quantity=0, unitPrice=1
                )
                for n in range(1105)
            ]
        )
        db.add_all(
            [
                Expense(
                    category="parts",
                    payee="Supplier",
                    documentNumber=f"PAGE-{n}",
                    amount=1,
                    note="Pagination test",
                    createdBy=ids["admin"],
                )
                for n in range(1105)
            ]
        )
        await db.commit()
    for path, expected in (("/api/inventory", 1106), ("/api/finance/expenses", 1105)):
        seen, cursor = [], None
        while True:
            response = await client.get(
                path,
                headers=auth("admin"),
                params={"limit": 100, **({"cursor": cursor} if cursor else {})},
            )
            assert response.status_code == 200, response.text
            page = response.json()
            assert len(page["data"]) <= 100
            if path == "/api/inventory":
                assert page["summary"]["skuCount"] == 1106
            seen.extend(r["id"] for r in page["data"])
            if not page["hasMore"]:
                assert page["nextCursor"] is None
                break
            assert page["nextCursor"] is not None and page["nextCursor"] != cursor
            cursor = page["nextCursor"]
        assert len(seen) == len(set(seen)) == expected
    for query in ("limit=0", "limit=201", "cursor=-1"):
        assert (
            await client.get("/api/inventory?" + query, headers=auth("admin"))
        ).status_code == 422


@pytest.mark.asyncio
async def test_vehicle_ticket_visit_pages_are_complete_and_queries_are_batched(api):
    from sqlalchemy import event

    client, auth, ids, factory, engine = api
    async with factory() as db:
        fleet = [
            Vehicle(
                licensePlate=f"FLEET-{n}",
                customerName="Fleet",
                customerId=ids["customer"],
                phone="0901234567",
                carBrand="Toyota",
                status="delivered",
            )
            for n in range(1051)
        ]
        db.add_all(fleet)
        await db.flush()
        db.add_all(
            [
                RepairTicket(
                    vehicleId=v.id, status="paid", totalAmount=1, paidAt=utcnow()
                )
                for v in fleet
            ]
        )
        db.add_all(
            [
                ServiceVisit(
                    vehicleId=v.id,
                    advisorId=ids["admin"],
                    status="closed",
                    concern="Service",
                    initialInspection="Checked",
                )
                for v in fleet
            ]
        )
        await db.commit()
    queries = []

    def capture(*args):
        queries.append(1)

    event.listen(engine.sync_engine, "before_cursor_execute", capture)
    try:
        for path in (
            "/api/vehicles/my-vehicles",
            "/api/repairs/my-repairs",
            "/api/service/visits",
        ):
            seen, cursor = [], None
            while True:
                queries.clear()
                response = await client.get(
                    path,
                    headers=auth("customer"),
                    params={"limit": 200, **({"cursor": cursor} if cursor else {})},
                )
                assert response.status_code == 200, response.text
                data = response.json()
                assert (
                    len(queries) < 20
                )  # Catch N+1; the bound is independent of 200 rows.
                seen.extend(item["id"] for item in data["data"])
                if path == "/api/repairs/my-repairs":
                    assert data["summary"]["counts"]["paid"] == 1051
                if not data["hasMore"]:
                    break
                cursor = data["nextCursor"]
            assert len(seen) == len(set(seen)) == 1051
        assert (
            await client.get("/api/repairs/my-repairs", headers=auth("other"))
        ).json()["data"] == []
        filtered = (
            await client.get(
                "/api/repairs/my-repairs?q=NOT-A-MATCH", headers=auth("customer")
            )
        ).json()
        assert filtered["data"] == [] and filtered["summary"]["counts"]["paid"] == 1051
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", capture)


@pytest.mark.asyncio
async def test_migration_preserves_legacy_duplicate_documents_and_labels_snapshots(api):
    import importlib.util
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    client, auth, ids, factory, engine = api
    vid = await vehicle(client, auth, ids)
    async with engine.begin() as conn:
        # Reconstruct the pre-008 financial schema, only in the disposable fixture.
        await conn.execute(text("DROP TRIGGER expense_document_guard ON expenses"))
        await conn.execute(text("DROP TRIGGER immutable_document ON expenses"))
        await conn.execute(text("DROP TABLE expense_documents"))
        await conn.execute(text("DROP TRIGGER immutable_history ON payment_receipts"))
        await conn.execute(
            text("DROP TRIGGER receipt_snapshot_guard ON payment_receipts")
        )
        await conn.execute(text("ALTER TABLE payment_receipts DROP COLUMN snapshot"))
        await conn.execute(
            text("""INSERT INTO expenses(category,payee,"documentNumber",amount,note,status,"createdBy")
            VALUES ('parts','Supplier','OLD-001',10,'Legacy document','paid',:actor),
                   ('parts','Supplier',' old-001 ',20,'Duplicate legacy document','paid',:actor)"""),
            {"actor": ids["admin"]},
        )
        ticket_id = await conn.scalar(
            text("""INSERT INTO repair_tickets("vehicleId",status,"totalAmount","paidAt")
            VALUES (:vehicle,'paid',30,now()) RETURNING id"""),
            {"vehicle": vid},
        )
        await conn.execute(
            text("""INSERT INTO payment_receipts("ticketId",amount,method,reference,"receivedBy")
            VALUES (:ticket,30,'cash','legacy',:actor)"""),
            {"ticket": ticket_id, "actor": ids["admin"]},
        )

    def upgrade(connection):
        source = (
            Path(__file__).parents[1] / "migrations/versions/008_financial_audit.py"
        )
        spec = importlib.util.spec_from_file_location("financial_migration", source)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()

    async with engine.begin() as conn:
        await conn.run_sync(upgrade)
        await conn.run_sync(upgrade)
    async with factory() as db:
        expenses = list((await db.scalars(select(Expense).order_by(Expense.id))).all())
        assert [x.documentNumber for x in expenses] == ["OLD-001", " old-001 "]
        assert sum(x.amount for x in expenses) == 30
        receipt = await db.scalar(select(PaymentReceipt))
        assert receipt.amount == 30 and receipt.snapshot["legacy"] is True
        assert await db.scalar(text("SELECT count(*) FROM expense_documents")) == 1
    duplicate = {
        "category": "parts",
        "payee": "Supplier",
        "documentNumber": " OLD-001 ",
        "amount": 1,
        "note": "New duplicate",
    }
    assert (
        await client.post(
            "/api/finance/expenses", headers=auth("admin"), json=duplicate
        )
    ).status_code == 409


@pytest.mark.asyncio
async def test_normalized_document_identity_and_concurrent_insert_guard(api):
    client, auth, ids, factory, _ = api
    body = {
        "category": "parts",
        "payee": "Supplier",
        "documentNumber": "Invoice-001",
        "amount": 500,
        "note": "Verified receipt",
    }
    responses = await asyncio.gather(
        *[
            client.post(
                "/api/finance/expenses",
                headers=auth("admin"),
                json={**body, "documentNumber": value},
            )
            for value in (" Invoice-001 ", "invoice-001")
        ]
    )
    assert sorted(r.status_code for r in responses) == [201, 409]
    assert (
        await client.post(
            "/api/finance/expenses",
            headers=auth("admin"),
            json={**body, "documentNumber": "   "},
        )
    ).status_code == 422
    async with factory() as db:
        db.add(
            Expense(
                category="parts",
                payee="Supplier",
                documentNumber=" INVOICE-001 ",
                amount=1,
                note="SQL bypass",
                createdBy=ids["admin"],
            )
        )
        with pytest.raises(IntegrityError):
            await db.flush()
        await db.rollback()


@pytest.mark.asyncio
async def test_paid_snapshot_and_stock_audit_are_immutable(api):
    client, auth, ids, factory, _ = api
    vid = await vehicle(client, auth, ids)
    ticket = (
        await client.post(
            "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
        )
    ).json()["data"]
    path = f"/api/repairs/{ticket['id']}"
    await client.put(path, headers=auth("mechanic"), json={"status": "working"})
    await evidence(client, auth, ticket)
    await client.put(
        f"{path}/items/{ticket['items'][0]['id']}/toggle",
        headers=auth("mechanic"),
        json={"isCompleted": True},
    )
    await client.put(path, headers=auth("mechanic"), json={"status": "completed"})
    paid = await client.put(path, headers=auth("admin"), json={"status": "paid"})
    assert paid.status_code == 200
    snapshot = paid.json()["data"]["billingSnapshot"]
    assert snapshot["legacy"] is False and snapshot["vehicle"]["carBrand"] == "Toyota"
    assert (
        await client.put(
            f"/api/vehicles/{vid}",
            headers=auth("admin"),
            json={"carBrand": "Honda", "licensePlate": "30A-99999"},
        )
    ).status_code == 200
    assert (await client.get(path, headers=auth("admin"))).json()["data"][
        "billingSnapshot"
    ] == snapshot
    async with factory() as db:
        movement = await db.scalar(select(InventoryMovement))
        assert movement.actorId == ids["admin"]
        with pytest.raises(IntegrityError):
            await db.execute(
                text(
                    "UPDATE payment_receipts SET reference='tampered' WHERE \"ticketId\"=:id"
                ),
                {"id": ticket["id"]},
            )
        await db.rollback()
        with pytest.raises(IntegrityError):
            await db.execute(text("DELETE FROM inventory_movements"))
        await db.rollback()


def test_missing_and_sample_jwt_secret_fail_closed(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    for values in (
        {},
        {"jwt_secret": "short"},
        {"jwt_secret": "change_this_in_production_garagecar_2026"},
        {"jwt_secret": "replace-with-a-long-random-secret"},
    ):
        with pytest.raises(ValidationError):
            Settings(_env_file=None, **values)


@pytest.mark.asyncio
async def test_argon2_worker_does_not_block_event_loop(monkeypatch):
    from core import security

    def slow_hash(value):
        time.sleep(0.15)
        return value

    monkeypatch.setattr(security, "hash_password", slow_hash)
    task = asyncio.create_task(async_hash_password("worker"))
    await asyncio.sleep(0.03)
    assert not task.done()
    assert await task == "worker"


@pytest.mark.asyncio
async def test_atomic_public_budget_and_old_hs256_token_compatibility(api, monkeypatch):
    from config.settings import settings

    client, auth, ids, _, _ = api
    monkeypatch.setattr(settings, "booking_requests_per_minute", 2)
    body = {
        "customerName": "Budget test",
        "phone": "0901234567",
        "service": "Oil",
        "preferredDate": str(today()),
    }
    responses = await asyncio.gather(
        *[client.post("/api/bookings", json=body) for _ in range(6)]
    )
    assert sum(r.status_code == 201 for r in responses) == 2
    rejected = [r for r in responses if r.status_code == 429]
    assert len(rejected) == 4 and all(r.headers.get("retry-after") for r in rejected)

    # A token produced with the old python-jose HS256 wire format remains valid.
    def b64(value):
        return base64.urlsafe_b64encode(
            json.dumps(value, separators=(",", ":")).encode()
        ).rstrip(b"=")

    message = (
        b64({"alg": "HS256", "typ": "JWT"})
        + b"."
        + b64({"id": ids["customer"], "version": 0, "exp": int(time.time()) + 300})
    )
    signature = base64.urlsafe_b64encode(
        hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).digest()
    ).rstrip(b"=")
    assert (
        await client.get(
            "/api/auth/me",
            headers={
                "Authorization": "Bearer " + (message + b"." + signature).decode()
            },
        )
    ).status_code == 200


def test_proxy_and_build_configuration_do_not_trust_public_headers():
    root = Path(__file__).resolve().parents[2]
    nginx = (root / "be/nginx.conf").read_text()
    compose = (root / "docker-compose.yml").read_text()
    assert (
        "X-Forwarded-For $remote_addr" in nginx
        and "$proxy_add_x_forwarded_for" not in nginx
    )
    assert "forwarded-allow-ips='*'" not in compose and "TRUSTED_PROXY_CIDR" in compose
    assert "USER appuser" in (root / "be/Dockerfile").read_text()
    html = (root / "fe/admin/index.html").read_text(encoding="utf-8")
    assert "chart.js@4.5.1/" in html and 'integrity="sha384-' in html
    workflow = (root / ".github/workflows/quality.yml").read_text(encoding="utf-8")
    assert "pip_audit" in workflow and "clean_runtime_check.py" in workflow
    for name in (
        "001_relational_workflow.py",
        "004_garage_care.py",
        "005_professional_workflow.py",
    ):
        assert "Base.metadata" not in (
            root / "be/migrations/versions" / name
        ).read_text(encoding="utf-8")
