"""Maintenance correctness and cross-role workflow in isolated PostgreSQL schemas."""

import asyncio
from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from test_workflow import api as api
from test_workflow import evidence, repair_body, vehicle

from core.security import create_access_token
from models import (
    Inventory,
    Mechanic,
    RepairTicket,
    User,
    Wage,
)
from services.maintenance_service import add_months, calculate_due, matches


def test_calendar_or_threshold_and_actions():
    care = SimpleNamespace(
        firstUseDate=date(2024, 8, 31), odometer=12000, observedOn=date(2025, 2, 28)
    )
    rule = {
        "component": "engine_oil",
        "action": "replace",
        "firstKm": 10000,
        "firstMonths": 6,
        "repeatKm": 5000,
        "repeatMonths": 6,
    }
    inspection = SimpleNamespace(
        id=1,
        component="engine_oil",
        action="inspect",
        performedOn=date(2025, 2, 1),
        odometer=11000,
    )
    due = calculate_due(care, [rule], [inspection], on=date(2025, 2, 28))[0]
    assert (
        due["dueKm"] == 10000
        and due["dueDate"] == "2025-02-28"
        and due["status"] == "due"
    )
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    replacement = SimpleNamespace(
        id=2,
        component="engine_oil",
        action="replace",
        performedOn=date(2025, 2, 28),
        odometer=12000,
    )
    next_due = calculate_due(
        care, [rule], [inspection, replacement], on=date(2025, 3, 1)
    )[0]
    assert next_due["dueKm"] == 17000 and next_due["status"] == "ok"
    assert next_due["cycleKey"] != due["cycleKey"]
    assert (
        calculate_due(
            care,
            [{**rule, "repeatKm": None, "repeatMonths": None}],
            [replacement],
            on=date(2025, 3, 1),
        )[0]["status"]
        == "needs_review"
    )


def test_exact_scope_and_stale_odometer():
    v = SimpleNamespace(carBrand="Honda", carModel="City")
    care = SimpleNamespace(
        modelYear=2023,
        engine="1.5",
        gearbox="CVT",
        market="VN",
        usage="normal",
        firstUseDate=date(2023, 1, 1),
        odometer=1000,
        observedOn=date(2023, 2, 1),
    )
    scope = {
        "brand": "Honda",
        "model": "City",
        "yearFrom": 2023,
        "yearTo": 2026,
        "engine": "1.5",
        "gearbox": "CVT",
        "market": "MY",
        "usage": "normal",
    }
    assert not matches(v, care, scope)
    assert matches(v, care, {**scope, "market": "VN"})
    rule = {
        "component": "coolant",
        "action": "replace",
        "firstKm": 100000,
        "firstMonths": None,
    }
    assert (
        calculate_due(care, [rule], [], on=date(2025, 1, 1))[0]["status"]
        == "needs_odometer"
    )


async def staff_accounts(client, auth):
    headers = {}
    for role in ["advisor", "accountant", "hr"]:
        result = await client.post(
            "/api/auth/users",
            headers=auth("admin"),
            json={
                "username": role,
                "email": role + "@example.com",
                "fullName": role,
                "password": "initial123",
                "role": role,
            },
        )
        assert result.status_code == 201, result.text
        uid = result.json()["data"]["id"]
        headers[role] = {"Authorization": "Bearer " + create_access_token({"id": uid})}
        headers[role + "_id"] = uid
    return headers


def profile_body():
    return {
        "title": "Toyota Vios approved test schedule",
        "scope": {
            "brand": "Toyota",
            "model": "Vios",
            "yearFrom": 2020,
            "yearTo": 2024,
            "engine": "1.5",
            "gearbox": "CVT",
            "market": "VN",
            "usage": "normal",
        },
        "sourceUrl": "https://www.toyota.com.vn/hdsd/vios/2024",
        "sourcePage": "TEST: manual review required",
        "version": "test-version",
        "rules": [
            {
                "component": "engine_oil",
                "action": "replace",
                "firstKm": 10000,
                "firstMonths": 6,
                "repeatKm": 5000,
                "repeatMonths": 6,
            }
        ],
    }


@pytest.mark.asyncio
async def test_maintenance_review_ownership_and_dedup(api):
    client, auth, ids, factory, _ = api
    vid = await vehicle(client, auth, ids)
    s = await staff_accounts(client, auth)
    created = await client.post(
        "/api/maintenance/profiles", headers=s["advisor"], json=profile_body()
    )
    assert created.status_code == 201, created.text
    pid = created.json()["data"]["id"]
    assert (
        await client.post(
            f"/api/maintenance/profiles/{pid}/approve", headers=s["advisor"]
        )
    ).status_code == 403
    care = {
        "profileId": pid,
        "modelYear": 2023,
        "engine": "1.5",
        "gearbox": "CVT",
        "market": "VN",
        "usage": "normal",
        "firstUseDate": "2020-01-31",
        "odometer": 15000,
        "observedOn": str(date.today()),
    }
    assert (
        await client.put(
            f"/api/maintenance/vehicles/{vid}", headers=s["advisor"], json=care
        )
    ).status_code == 409
    assert (
        await client.post(
            f"/api/maintenance/profiles/{pid}/approve", headers=auth("admin")
        )
    ).status_code == 200
    assert (
        await client.put(
            f"/api/maintenance/vehicles/{vid}",
            headers=s["advisor"],
            json={**care, "market": "MY"},
        )
    ).status_code == 409
    assert (
        await client.put(
            f"/api/maintenance/vehicles/{vid}", headers=s["advisor"], json=care
        )
    ).status_code == 200
    assert (
        await client.get(f"/api/maintenance/vehicles/{vid}", headers=auth("other"))
    ).status_code == 403
    assert (
        await client.get(f"/api/maintenance/vehicles/{vid}", headers=auth("customer"))
    ).json()["data"]["rules"][0]["status"] == "due"
    assert (
        await client.get("/api/maintenance/reminders", headers=auth("customer"))
    ).json()["data"] == []
    await asyncio.gather(
        *[client.post("/api/maintenance/scan", headers=auth("admin")) for _ in range(2)]
    )
    reminders = (
        await client.get("/api/maintenance/reminders", headers=s["advisor"])
    ).json()["data"]
    assert len(reminders) == 1
    rid = reminders[0]["id"]
    assert (
        await client.post(
            f"/api/maintenance/reminders/{rid}/publish", headers=s["advisor"]
        )
    ).status_code == 200
    assert (
        len(
            (
                await client.get("/api/maintenance/reminders", headers=auth("customer"))
            ).json()["data"]
        )
        == 1
    )
    record = {
        "component": "engine_oil",
        "action": "inspect",
        "performedOn": str(date.today()),
        "odometer": 15000,
        "note": "Confirmed external inspection",
    }
    assert (
        await client.post(
            f"/api/maintenance/vehicles/{vid}/records",
            headers=s["advisor"],
            json=record,
        )
    ).status_code == 201
    assert (
        await client.get(f"/api/maintenance/vehicles/{vid}", headers=auth("customer"))
    ).json()["data"]["rules"][0]["status"] == "due"
    assert (
        await client.post(
            f"/api/maintenance/vehicles/{vid}/records",
            headers=s["advisor"],
            json={**record, "action": "replace"},
        )
    ).status_code == 201
    assert (
        await client.get("/api/maintenance/reminders", headers=auth("customer"))
    ).json()["data"] == []
    assert (
        await client.put(
            f"/api/maintenance/vehicles/{vid}",
            headers=s["advisor"],
            json={**care, "odometer": 10000},
        )
    ).status_code == 409


@pytest.mark.asyncio
async def test_service_resources_offer_eligible_cars_accounts_and_current_prices(api):
    client, auth, ids, factory, _ = api
    open_car = await vehicle(client, auth, ids)
    ticket_car = await vehicle(client, auth, ids, "30A-22222")
    free_car = await vehicle(client, auth, ids, "30A-33333")
    visit = await client.post(
        "/api/service/visits",
        headers=auth("admin"),
        json={
            "vehicleId": open_car,
            "concern": "Oil service",
            "initialInspection": "No warning lights",
        },
    )
    assert visit.status_code == 201, visit.text
    ticket = await client.post(
        "/api/repairs", headers=auth("admin"), json=repair_body(ticket_car, ids)
    )
    assert ticket.status_code == 201, ticket.text
    async with factory() as db:
        locked = User(
            username="lockedtech",
            email="locked@example.com",
            fullName="Locked",
            role="mechanic",
            password="unused",
            isActive=False,
        )
        restricted = User(
            username="restrictedtech",
            email="restricted@example.com",
            fullName="Restricted",
            role="mechanic",
            password="unused",
            disabledPermissions=["workshop"],
        )
        db.add_all([locked, restricted])
        await db.flush()
        db.add_all(
            [
                Mechanic(fullName="No account"),
                Mechanic(fullName="Locked account", userId=locked.id),
                Mechanic(fullName="Restricted account", userId=restricted.id),
                Wage(name="Change oil", price=75),
            ]
        )
        await db.commit()
    result = await client.get("/api/service/resources", headers=auth("admin"))
    assert result.status_code == 200, result.text
    data = result.json()["data"]
    cars = {v["id"]: v for v in data["vehicles"]}
    assert cars[open_car]["activeVisitId"] == visit.json()["data"]["id"]
    assert cars[open_car]["availableForIntake"] is False
    assert cars[ticket_car]["ticketId"] == ticket.json()["data"]["id"]
    assert cars[ticket_car]["availableForIntake"] is False
    assert cars[free_car]["availableForIntake"] is True
    assert cars[free_car]["carModel"] == "Vios"
    assert data["mechanics"] == [
        {"id": ids["mechanic_id"], "fullName": "Same Name", "openTickets": 1}
    ]
    assert next(w for w in data["wages"] if w["name"] == "Change oil")["price"] == 75
    assert data["inventory"][0]["quantity"] == 3
    for role in ("customer", "mechanic"):
        assert (
            await client.get("/api/service/resources", headers=auth(role))
        ).status_code == 403


@pytest.mark.asyncio
async def test_quotation_consent_stock_qc_and_cashier_permissions(api):
    client, auth, ids, factory, _ = api
    s = await staff_accounts(client, auth)
    vid = await vehicle(client, auth, ids)
    visit = await client.post(
        "/api/service/visits",
        headers=s["advisor"],
        json={
            "vehicleId": vid,
            "mechanicId": ids["mechanic_id"],
            "concern": "Oil maintenance",
            "initialInspection": "No visible leaks",
        },
    )
    assert visit.status_code == 201, visit.text
    visit_id = visit.json()["data"]["id"]
    path = f"/api/service/visits/{visit_id}"
    line = {
        "taskName": "Oil change",
        "inventoryId": ids["inventory_id"],
        "quantity": 2,
        "laborPrice": 50,
        "partPrice": 1,
    }
    prelim = await client.post(
        path + "/quotes",
        headers=s["advisor"],
        json={"stage": "preliminary", "items": [line]},
    )
    assert prelim.status_code == 201, prelim.text
    qid = prelim.json()["data"]["id"]
    assert float(prelim.json()["data"]["totalAmount"]) == 250
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 5
    assert (
        await client.post(
            f"/api/service/quotes/{qid}/decision",
            headers=auth("other"),
            json={"approved": True},
        )
    ).status_code == 403
    assert (
        await client.put(
            path + "/diagnosis",
            headers=auth("mechanic"),
            json={"diagnosis": "Ready for oil service"},
        )
    ).status_code == 409
    assert (
        await client.post(
            f"/api/service/quotes/{qid}/decision",
            headers=auth("customer"),
            json={"approved": True},
        )
    ).status_code == 200
    assert (
        await client.put(
            path + "/diagnosis",
            headers=auth("mechanic"),
            json={"diagnosis": "Ready for oil service"},
        )
    ).status_code == 200
    final = await client.post(
        path + "/quotes", headers=s["advisor"], json={"stage": "final", "items": [line]}
    )
    qid = final.json()["data"]["id"]
    assert (
        await client.post(
            f"/api/service/quotes/{qid}/convert",
            headers=s["advisor"],
            json={"mechanicId": ids["mechanic_id"]},
        )
    ).status_code == 409
    assert (
        await client.post(
            f"/api/service/quotes/{qid}/decision",
            headers=auth("customer"),
            json={"approved": True},
        )
    ).status_code == 200
    responses = await asyncio.gather(
        *[
            client.post(
                f"/api/service/quotes/{qid}/convert",
                headers=s["advisor"],
                json={"mechanicId": ids["mechanic_id"]},
            )
            for _ in range(2)
        ]
    )
    assert sorted(r.status_code for r in responses) == [201, 409]
    tid = next(r.json()["data"]["ticketId"] for r in responses if r.status_code == 201)
    tpath = f"/api/repairs/{tid}"
    assert (
        await client.put(tpath, headers=auth("admin"), json={"items": [line]})
    ).status_code == 409
    assert (
        await client.put(
            tpath, headers=s["accountant"], json={"mechanicId": ids["mechanic_id"]}
        )
    ).status_code == 403
    assert (
        await client.put(tpath, headers=auth("mechanic"), json={"status": "working"})
    ).status_code == 200
    ticket = (await client.get(tpath, headers=auth("mechanic"))).json()["data"]
    await evidence(client, auth, ticket)
    assert (
        await client.put(
            tpath + f"/items/{ticket['items'][0]['id']}/toggle",
            headers=auth("mechanic"),
            json={"isCompleted": True},
        )
    ).status_code == 200
    assert (
        await client.put(tpath, headers=auth("mechanic"), json={"status": "completed"})
    ).status_code == 200
    assert (
        await client.put(tpath, headers=s["accountant"], json={"status": "paid"})
    ).status_code == 409
    assert (
        await client.post(
            path + "/qc",
            headers=auth("mechanic"),
            json={
                "workVerified": True,
                "safetyChecked": True,
                "roadTestOrReason": "Successful test",
            },
        )
    ).status_code == 403
    assert (
        await client.post(
            path + "/qc",
            headers=s["advisor"],
            json={
                "workVerified": True,
                "safetyChecked": True,
                "roadTestOrReason": "Successful test",
            },
        )
    ).status_code == 200
    assert (
        await client.put(tpath, headers=s["accountant"], json={"status": "paid"})
    ).status_code == 200
    billing = (await client.get("/api/service/visits", headers=s["accountant"])).json()[
        "data"
    ]
    assert (
        billing[0]["qcAt"]
        and "diagnosis" not in billing[0]
        and "quotes" not in billing[0]
    )
    paid_ticket = (await client.get(tpath, headers=s["accountant"])).json()["data"]
    assert paid_ticket["qcAt"]
    followup_path = f"/api/advisor/visits/{visit_id}/followup"
    followup_body = {
        "outcome": "satisfied",
        "rating": 5,
        "note": "Customer confirmed good operation",
    }
    assert (
        await client.post(followup_path, headers=s["advisor"], json=followup_body)
    ).status_code == 409
    assert (
        await client.put(
            f"/api/vehicles/{vid}", headers=s["advisor"], json={"status": "delivered"}
        )
    ).status_code == 200
    assert (
        await client.post(followup_path, headers=s["hr"], json=followup_body)
    ).status_code == 403
    assert (
        await client.post(followup_path, headers=s["advisor"], json=followup_body)
    ).status_code == 201
    assert (
        len(
            (await client.get("/api/advisor/followups", headers=s["advisor"])).json()[
                "data"
            ]
        )
        == 1
    )
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 3


@pytest.mark.asyncio
async def test_feature_lock_and_hr_cannot_grant_accounts(api):
    client, auth, ids, factory, _ = api
    s = await staff_accounts(client, auth)
    assert (
        await client.get("/api/service/employees", headers=s["hr"])
    ).status_code == 200
    uid = s["advisor_id"]
    assert (
        await client.put(
            f"/api/service/employees/{uid}",
            headers=s["hr"],
            json={
                "department": "Service",
                "jobTitle": "Advisor",
                "startDate": "2024-01-01",
            },
        )
    ).status_code == 200
    assert (
        await client.post(
            "/api/auth/users",
            headers=s["hr"],
            json={
                "username": "hack",
                "fullName": "Hack",
                "email": "hack@example.com",
                "role": "admin",
                "password": "secret123",
            },
        )
    ).status_code == 403
    assert (
        await client.put(
            f"/api/auth/users/{uid}/permissions",
            headers=auth("admin"),
            json={"disabledPermissions": ["accounts"]},
        )
    ).status_code == 422
    assert (
        await client.put(
            f"/api/auth/users/{uid}/permissions",
            headers=auth("admin"),
            json={"disabledPermissions": ["maintenance", "workshop"]},
        )
    ).status_code == 200
    assert (
        await client.get("/api/maintenance/profiles", headers=s["advisor"])
    ).status_code == 403
    assert (
        await client.get("/api/service/visits", headers=s["advisor"])
    ).status_code == 403
    assert (await client.get("/api/vehicles", headers=s["advisor"])).status_code == 200
    assert (
        await client.get("/api/repairs", headers=s["accountant"])
    ).status_code == 200
    assert (
        await client.get("/api/vehicles", headers=s["accountant"])
    ).status_code == 403


@pytest.mark.asyncio
async def test_stale_quote_and_price_change_never_reserve_stock(api):
    client, auth, ids, factory, _ = api
    s = await staff_accounts(client, auth)
    vid = await vehicle(client, auth, ids)
    created = await client.post(
        "/api/service/visits",
        headers=s["advisor"],
        json={
            "vehicleId": vid,
            "mechanicId": ids["mechanic_id"],
            "concern": "Maintenance",
            "initialInspection": "Check vehicle",
        },
    )
    path = "/api/service/visits/" + str(created.json()["data"]["id"])
    item = {
        "taskName": "Oil change",
        "inventoryId": ids["inventory_id"],
        "quantity": 2,
        "laborPrice": 50,
    }

    async def make(stage):
        response = await client.post(
            path + "/quotes",
            headers=s["advisor"],
            json={"stage": stage, "items": [item]},
        )
        assert response.status_code == 201, response.text
        return response.json()["data"]["id"]

    p1 = await make("preliminary")
    p2 = await make("preliminary")
    assert (
        await client.post(
            f"/api/service/quotes/{p1}/decision",
            headers=auth("customer"),
            json={"approved": True},
        )
    ).status_code == 409
    assert (
        await client.post(
            f"/api/service/quotes/{p2}/decision",
            headers=auth("customer"),
            json={"approved": True},
        )
    ).status_code == 200
    assert (
        await client.put(
            path + "/diagnosis",
            headers=s["advisor"],
            json={"diagnosis": "Oil service required"},
        )
    ).status_code == 200
    final = await make("final")
    assert (
        await client.post(
            f"/api/service/quotes/{final}/decision",
            headers=auth("customer"),
            json={"approved": True},
        )
    ).status_code == 200
    async with factory() as db:
        (await db.get(Inventory, ids["inventory_id"])).unitPrice = 200
        await db.commit()
    conversion = await client.post(
        f"/api/service/quotes/{final}/convert",
        headers=s["advisor"],
        json={"mechanicId": ids["mechanic_id"]},
    )
    assert conversion.status_code == 409, conversion.text
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 5
        assert (
            await db.scalar(
                select(RepairTicket.id).where(RepairTicket.vehicleId == vid)
            )
            is None
        )
    assert (
        await client.put(
            path + "/diagnosis",
            headers=auth("mechanic"),
            json={"diagnosis": "Revised diagnosis"},
        )
    ).status_code == 200
    assert (
        await client.post(
            f"/api/service/quotes/{final}/convert",
            headers=s["advisor"],
            json={"mechanicId": ids["mechanic_id"]},
        )
    ).status_code == 409


@pytest.mark.asyncio
async def test_new_staff_actions_cannot_bypass_legacy_or_feature_locks(api):
    client, auth, ids, factory, _ = api
    s = await staff_accounts(client, auth)
    vid = await vehicle(client, auth, ids)
    assert (await client.get("/api/inventory", headers=s["advisor"])).status_code == 200
    assert (await client.get("/api/mechanics", headers=s["advisor"])).status_code == 200
    assert (
        await client.post(
            "/api/service/visits",
            headers=s["accountant"],
            json={"vehicleId": vid, "concern": "Check", "initialInspection": "Check"},
        )
    ).status_code == 403
    result = await client.post(
        "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
    )
    assert result.status_code == 201, result.text
    assert (
        await client.post(
            "/api/service/visits",
            headers=s["advisor"],
            json={"vehicleId": vid, "concern": "Check", "initialInspection": "Check"},
        )
    ).status_code == 409
    assert (
        await client.put(
            f"/api/auth/users/{s['accountant_id']}/permissions",
            headers=auth("admin"),
            json={"disabledPermissions": ["finance"]},
        )
    ).status_code == 200
    assert (
        await client.get("/api/repairs", headers=s["accountant"])
    ).status_code == 403
