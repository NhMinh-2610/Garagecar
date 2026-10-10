"""Complete demo workflows remain additive, consistent and repeatable."""

from collections import defaultdict
from hashlib import sha256

import pytest
from sqlalchemy import select
from test_workflow import api as api

from core.security import hash_password
from database.engine import Base
from models import (
    Inventory,
    InventoryMovement,
    LeaveRequest,
    MaintenanceReminder,
    Mechanic,
    PaymentReceipt,
    RepairEvidence,
    RepairTicket,
    ServiceQuote,
    ServiceVisit,
    SupportConversation,
    User,
)
from services.demo_seed import DEMO_PASSWORD, DemoCollisionError, demo_email, seed_demo
from services.evidence_service import require_item_evidence


async def snapshot(factory):
    async with factory() as db:
        result = {}
        for table in Base.metadata.sorted_tables:
            rows = (
                (await db.execute(select(table).order_by(*table.primary_key.columns)))
                .mappings()
                .all()
            )
            result[table.name] = {
                tuple(row[column.name] for column in table.primary_key.columns): dict(
                    row
                )
                for row in rows
            }
        return result


@pytest.mark.asyncio
async def test_complete_demo_is_additive_repeatable_and_has_valid_business_links(api):
    client, _, _, factory, _ = api
    before = await snapshot(factory)
    async with factory() as db:
        manifest = await seed_demo(db)
        await db.commit()
    assert manifest["created"] is True
    assert len(manifest["accounts"]) == 6
    assert len(manifest["vehicles"]) == 8
    after = await snapshot(factory)
    for table, rows in before.items():
        for key, row in rows.items():
            assert after[table][key] == row, f"Existing {table} row changed"
    for table in (
        "employee_profiles",
        "staff_shifts",
        "staff_certificates",
        "leave_requests",
        "bookings",
        "service_visits",
        "service_quotes",
        "repair_tickets",
        "repair_items",
        "inventories",
        "inventory_movements",
        "repair_evidence",
        "payment_receipts",
        "expenses",
        "maintenance_profiles",
        "vehicle_care",
        "maintenance_records",
        "maintenance_reminders",
        "service_followups",
        "support_conversations",
        "support_messages",
        "support_reads",
    ):
        assert manifest["counts"][table] > 0, table
    async with factory() as db:
        stock = (
            await db.scalars(select(Inventory).where(Inventory.sku.like("DEMO-%")))
        ).all()
        for part in stock:
            running = 0
            ledger = (
                await db.scalars(
                    select(InventoryMovement)
                    .where(InventoryMovement.inventoryId == part.id)
                    .order_by(InventoryMovement.id)
                )
            ).all()
            for movement in ledger:
                running += movement.quantityChange
                assert movement.balanceAfter == running
                assert running >= 0
            assert running == part.quantity
        tickets = (
            await db.scalars(
                select(RepairTicket).where(
                    RepairTicket.vehicleId.in_(list(manifest["vehicles"].values()))
                )
            )
        ).all()
        assert {ticket.status for ticket in tickets} == {
            "draft",
            "working",
            "completed",
            "paid",
        }
        for ticket in tickets:
            assert ticket.totalAmount == sum(item.totalPrice for item in ticket.items)
            quote = await db.scalar(
                select(ServiceQuote).where(
                    ServiceQuote.visitId == ticket.serviceVisitId,
                    ServiceQuote.stage == "final",
                )
            )
            assert quote.status == "converted"
            assert quote.totalAmount == ticket.totalAmount
            for item in ticket.items:
                assert (
                    item.totalPrice == item.partPrice * item.quantity + item.laborPrice
                )
                if item.isCompleted:
                    await require_item_evidence(db, item)
            if ticket.status in ("completed", "paid"):
                visit = await db.get(ServiceVisit, ticket.serviceVisitId)
                assert ticket.startedAt <= ticket.completedAt <= visit.qcAt
            if ticket.status == "paid":
                receipt = await db.scalar(
                    select(PaymentReceipt).where(PaymentReceipt.ticketId == ticket.id)
                )
                assert receipt.amount == ticket.totalAmount
                assert receipt.createdAt == ticket.paidAt
        revenue = defaultdict(int)
        for ticket in tickets:
            if ticket.paidAt:
                revenue[ticket.paidAt.strftime("%Y-%m")] += ticket.totalAmount
        assert len(revenue) == 6
        assert len(set(revenue.values())) > 1
        for evidence in (await db.scalars(select(RepairEvidence))).all():
            assert sha256(evidence.image).hexdigest() == evidence.sha256
            assert evidence.note.startswith("[DEMO]")
        reminders = (await db.scalars(select(MaintenanceReminder))).all()
        assert {reminder.status for reminder in reminders} == {"pending", "published"}
        assert all("DEMO" in reminder.summary["profileTitle"] for reminder in reminders)
        assert await db.scalar(
            select(SupportConversation.id).where(
                SupportConversation.advisorId.is_(None)
            )
        )

    # Exercise actual portal APIs as all six seeded roles, including credentials.
    tokens = {}
    for account in manifest["accounts"]:
        response = await client.post(
            "/api/auth/login",
            json={"email": account["email"], "password": DEMO_PASSWORD},
        )
        assert response.status_code == 200, response.text
        tokens[account["role"]] = {
            "Authorization": "Bearer " + response.json()["data"]["token"]
        }
    for role, url in (
        ("admin", "/api/bookings"),
        ("advisor", "/api/service/visits"),
        ("accountant", "/api/finance/receipts"),
        ("hr", "/api/hr/operations"),
        ("mechanic", "/api/repairs/my-tasks"),
        ("customer", "/api/repairs/my-repairs"),
        ("customer", "/api/maintenance/reminders"),
        ("customer", "/api/messaging/conversations"),
    ):
        response = await client.get(url, headers=tokens[role])
        assert response.status_code == 200, response.text
        assert response.json()["data"], url
    async with factory() as db:
        pending_quote = await db.scalar(
            select(ServiceQuote).where(
                ServiceQuote.visitId == manifest["scenarios"]["pendingQuoteVisit"],
                ServiceQuote.stage == "final",
            )
        )
        ready_quote = await db.scalar(
            select(ServiceQuote).where(
                ServiceQuote.visitId == manifest["scenarios"]["readyVisit"],
                ServiceQuote.stage == "final",
            )
        )
        mechanic = await db.scalar(
            select(Mechanic)
            .join(User, Mechanic.userId == User.id)
            .where(User.username == "demo_mechanic")
        )
        leave = await db.scalar(
            select(LeaveRequest).where(
                LeaveRequest.userId == mechanic.userId, LeaveRequest.status == "pending"
            )
        )
        pending_quote_id, ready_quote_id, mechanic_id, leave_id = (
            pending_quote.id,
            ready_quote.id,
            mechanic.id,
            leave.id,
        )
    for method, path, role, body, expected in (
        (
            "POST",
            f"/api/service/quotes/{pending_quote_id}/decision",
            "customer",
            {"approved": True, "note": "Approve demo quote"},
            200,
        ),
        (
            "POST",
            f"/api/service/quotes/{ready_quote_id}/convert",
            "advisor",
            {"mechanicId": mechanic_id},
            201,
        ),
        (
            "PUT",
            f"/api/repairs/{manifest['scenarios']['paymentTicket']}",
            "accountant",
            {
                "status": "paid",
                "paymentMethod": "bank",
                "paymentReference": "DEMO-TEST-COLLECTION",
            },
            200,
        ),
        (
            "POST",
            f"/api/hr/leave/{leave_id}/decide",
            "hr",
            {"approved": True, "note": "Demo leave approved"},
            200,
        ),
    ):
        response = await client.request(method, path, headers=tokens[role], json=body)
        assert response.status_code == expected, response.text
    # A user's subsequent edits are preserved on every rerun.
    async with factory() as db:
        demo = await db.scalar(select(User).where(User.email == demo_email("customer")))
        demo.password = hash_password("ChangedAfterTryingDemo123!")
        part = await db.scalar(select(Inventory).where(Inventory.sku == "DEMO-OIL"))
        part.name = "Changed demo part name"
        await db.commit()
    edited = await snapshot(factory)
    async with factory() as db:
        repeated = await seed_demo(db)
        await db.commit()
    assert repeated["created"] is False
    assert await snapshot(factory) == edited


@pytest.mark.asyncio
async def test_demo_seed_rejects_existing_identifiers_without_hijacking_account(api):
    _, _, _, factory, _ = api
    async with factory() as db:
        db.add(
            User(
                username="demo_advisor",
                email="existing@example.com",
                fullName="Existing customer",
                role="customer",
                password=hash_password("OriginalPassword123!"),
            )
        )
        await db.commit()
    before = await snapshot(factory)
    async with factory() as db:
        with pytest.raises(DemoCollisionError):
            await seed_demo(db)
        await db.rollback()
    assert await snapshot(factory) == before


@pytest.mark.asyncio
async def test_demo_seed_failure_rolls_back_whole_dataset(api, monkeypatch):
    _, _, _, factory, _ = api
    before = await snapshot(factory)

    async def fail_after_accounts_and_care(*args):
        raise RuntimeError("Simulated failure midway through seed")

    monkeypatch.setattr(
        "services.demo_seed.replace_items", fail_after_accounts_and_care
    )
    async with factory() as db:
        with pytest.raises(RuntimeError, match="midway"):
            await seed_demo(db)
        await db.rollback()
    assert await snapshot(factory) == before
