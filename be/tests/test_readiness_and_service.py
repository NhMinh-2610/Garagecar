"""Readiness, bounded service queries and consistent workshop assignments."""

import pytest
from main import app
from sqlalchemy import event, select
from sqlalchemy.exc import OperationalError
from test_workflow import api as api
from test_workflow import vehicle

from core.security import create_access_token
from database.session import get_db
from models import Mechanic, RepairTicket, ServiceVisit


@pytest.mark.asyncio
async def test_missing_wrong_scheme_and_invalid_tokens_return_authentication_errors(
    api,
):
    client, *_ = api
    for headers in [
        {},
        {"Authorization": "Basic invalid"},
        {"Authorization": "Bearer invalid"},
    ]:
        response = await client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
        assert response.json()["success"] is False


@pytest.mark.asyncio
async def test_readiness_checks_database_without_exposing_errors(api):
    client, *_ = api
    assert (await client.get("/api/ready")).status_code == 200
    original = app.dependency_overrides[get_db]

    class UnavailableDatabase:
        async def execute(self, statement):
            raise OperationalError("private connection string", {}, Exception("secret"))

    async def unavailable():
        yield UnavailableDatabase()

    app.dependency_overrides[get_db] = unavailable
    try:
        response = await client.get("/api/ready")
        assert response.status_code == 503
        assert "secret" not in response.text and "private" not in response.text
        assert (await client.get("/api/health")).status_code == 200
    finally:
        app.dependency_overrides[get_db] = original


@pytest.mark.asyncio
async def test_visit_queries_are_batched_and_find_active_work_beyond_recent_history(
    api,
):
    client, auth, ids, factory, engine = api
    vid = await vehicle(client, auth, ids)
    async with factory() as db:
        current = ServiceVisit(
            vehicleId=vid,
            advisorId=ids["admin"],
            concern="Current",
            initialInspection="Check",
            status="intake",
        )
        db.add(current)
        await db.flush()
        current_id = current.id
        db.add_all(
            [
                ServiceVisit(
                    vehicleId=vid,
                    advisorId=ids["admin"],
                    concern="History",
                    initialInspection="Check",
                    status="closed",
                )
                for _ in range(105)
            ]
        )
        await db.commit()

    statements = []

    def record(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", record)
    try:
        response = await client.get("/api/service/visits", headers=auth("admin"))
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", record)
    assert response.status_code == 200
    assert len(response.json()["data"]) == 100
    assert response.json()["data"][0]["id"] == current_id
    assert len(statements) <= 6, len(statements)
    filtered = await client.get(
        f"/api/service/visits?active=true&vehicleId={vid}", headers=auth("admin")
    )
    assert [v["id"] for v in filtered.json()["data"]] == [current_id]
    hidden = await client.get(
        f"/api/service/visits?active=true&vehicleId={vid}", headers=auth("other")
    )
    assert hidden.json()["data"] == []


@pytest.mark.asyncio
async def test_reassigning_quote_ticket_updates_mechanic_access_for_both_workspaces(
    api,
):
    client, auth, ids, factory, _ = api
    vid = await vehicle(client, auth, ids)
    visit_response = await client.post(
        "/api/service/visits",
        headers=auth("admin"),
        json={
            "vehicleId": vid,
            "mechanicId": ids["mechanic_id"],
            "concern": "Maintenance",
            "initialInspection": "No visible leaks",
        },
    )
    assert visit_response.status_code == 201, visit_response.text
    visit_id = visit_response.json()["data"]["id"]
    path = f"/api/service/visits/{visit_id}"
    for stage in ["preliminary", "final"]:
        quote = await client.post(
            path + "/quotes",
            headers=auth("admin"),
            json={
                "stage": stage,
                "items": [
                    {"taskName": "Check brakes", "quantity": 1, "laborPrice": 50}
                ],
            },
        )
        assert quote.status_code == 201, quote.text
        qid = quote.json()["data"]["id"]
        decision = await client.post(
            f"/api/service/quotes/{qid}/decision",
            headers=auth("customer"),
            json={"approved": True},
        )
        assert decision.status_code == 200, decision.text
        if stage == "preliminary":
            diagnosis = await client.put(
                path + "/diagnosis",
                headers=auth("mechanic"),
                json={"diagnosis": "Brake inspection required"},
            )
            assert diagnosis.status_code == 200, diagnosis.text
    converted = await client.post(
        f"/api/service/quotes/{qid}/convert",
        headers=auth("admin"),
        json={"mechanicId": ids["mechanic_id"]},
    )
    assert converted.status_code == 201, converted.text
    ticket_id = converted.json()["data"]["ticketId"]
    account = await client.post(
        "/api/auth/users",
        headers=auth("admin"),
        json={
            "username": "secondmechanic",
            "email": "second@example.com",
            "fullName": "Second Mechanic",
            "password": "initial123",
            "role": "mechanic",
        },
    )
    assert account.status_code == 201, account.text
    uid = account.json()["data"]["id"]
    async with factory() as db:
        new_mechanic = await db.scalar(select(Mechanic).where(Mechanic.userId == uid))
        mid = new_mechanic.id
        unlinked = Mechanic(fullName="No account")
        db.add(unlinked)
        await db.commit()
        unlinked_id = unlinked.id
    ticket_path = f"/api/repairs/{ticket_id}"
    for invalid in [None, unlinked_id]:
        assert (
            await client.put(
                ticket_path, headers=auth("admin"), json={"mechanicId": invalid}
            )
        ).status_code == 409
    updated = await client.put(
        ticket_path, headers=auth("admin"), json={"mechanicId": mid}
    )
    assert updated.status_code == 200, updated.text
    async with factory() as db:
        assert (await db.get(ServiceVisit, visit_id)).mechanicId == mid
        assert (await db.get(RepairTicket, ticket_id)).mechanicId == mid
    new_auth = {"Authorization": "Bearer " + create_access_token({"id": uid})}
    for endpoint in ["/api/service/visits", "/api/repairs/my-tasks"]:
        assert (await client.get(endpoint, headers=auth("mechanic"))).json()[
            "data"
        ] == []
        assert len((await client.get(endpoint, headers=new_auth)).json()["data"]) == 1
    assert (await client.get(ticket_path, headers=auth("mechanic"))).status_code == 403
    assert (await client.get(ticket_path, headers=new_auth)).status_code == 200
