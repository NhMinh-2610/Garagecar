"""Private support chat, concurrent sends, unread markers and assignment boundaries."""

import asyncio
from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from test_garage_care import staff_accounts
from test_workflow import api as api
from test_workflow import vehicle

from core.security import create_access_token
from core.time import utcnow
from models import SupportConversation, SupportMessage


async def begin(client, headers, vehicle_id=None):
    response = await client.post(
        "/api/messaging/conversations", headers=headers, json={"vehicleId": vehicle_id}
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


def message(content="Xe có tiếng kêu khi phanh", retry_id=None):
    return {"content": content, "clientMessageId": str(retry_id or uuid4())}


@pytest.mark.asyncio
async def test_customer_chat_privacy_read_and_reopen(api):
    client, auth, ids, _, _ = api
    staff = await staff_accounts(client, auth)
    vid = await vehicle(client, auth, ids)
    assert (
        await client.post(
            "/api/messaging/conversations",
            headers=auth("other"),
            json={"vehicleId": vid},
        )
    ).status_code == 404
    cid = await begin(client, auth("customer"), vid)
    assert await begin(client, auth("customer"), vid) == cid
    path = f"/api/messaging/conversations/{cid}"
    for actor in [auth("other"), auth("mechanic"), staff["accountant"], staff["hr"]]:
        for endpoint, method, body in [
            ("/messages", "GET", None),
            ("/messages", "POST", message()),
            ("/read", "POST", {"throughMessageId": 1}),
        ]:
            response = await client.request(
                method, path + endpoint, headers=actor, json=body
            )
            assert response.status_code in (403, 404), response.text
    sent = await client.post(
        path + "/messages", headers=auth("customer"), json=message()
    )
    assert sent.status_code == 201, sent.text
    mid = sent.json()["data"]["id"]
    inbox = (
        await client.get("/api/messaging/conversations", headers=staff["advisor"])
    ).json()["data"]
    assert inbox["totalUnread"] == 1 and inbox["items"][0]["unreadCount"] == 1
    assert (
        await client.post(
            path + "/read", headers=staff["advisor"], json={"throughMessageId": mid}
        )
    ).status_code == 200
    assert (
        await client.get("/api/messaging/conversations", headers=staff["advisor"])
    ).json()["data"]["totalUnread"] == 0
    received = (await client.get(path + "/messages", headers=auth("customer"))).json()[
        "data"
    ]
    assert received["staffReadId"] == mid
    reply = await client.post(
        path + "/messages",
        headers=staff["advisor"],
        json=message("Mời bạn đặt lịch kiểm tra."),
    )
    assert reply.status_code == 201, reply.text
    assert reply.json()["data"]["senderId"] == staff["advisor_id"]
    assert (
        await client.get("/api/messaging/conversations", headers=auth("customer"))
    ).json()["data"]["totalUnread"] == 1
    assert (
        await client.put(
            path + "/status", headers=auth("customer"), json={"status": "closed"}
        )
    ).status_code == 403
    assert (
        await client.put(
            path + "/status", headers=staff["advisor"], json={"status": "closed"}
        )
    ).status_code == 200
    assert (
        await client.post(
            path + "/messages", headers=staff["advisor"], json=message("Closed reply")
        )
    ).status_code == 409
    assert (
        await client.post(
            path + "/messages",
            headers=auth("customer"),
            json=message("Tôi cần hỏi thêm."),
        )
    ).status_code == 201
    received = await client.get(path + "/messages", headers=auth("customer"))
    assert received.headers["cache-control"] == "private, no-store"
    assert received.json()["data"]["conversation"]["status"] == "open"
    assert received.json()["data"]["conversation"]["advisorId"] == staff["advisor_id"]
    assert (
        await client.post(
            path + "/messages", headers=auth("customer"), json=message(" ")
        )
    ).status_code == 422
    assert (
        await client.get("/api/messaging/conversations", headers=auth("other"))
    ).json()["data"]["items"] == []


@pytest.mark.asyncio
async def test_concurrent_retry_is_exactly_one_message_and_thread(api):
    client, auth, ids, factory, _ = api
    cids = await asyncio.gather(
        begin(client, auth("customer")), begin(client, auth("customer"))
    )
    assert cids[0] == cids[1]
    path = f"/api/messaging/conversations/{cids[0]}/messages"
    body = message("Tôi cần kiểm tra xe", uuid4())
    replies = await asyncio.gather(
        *[client.post(path, headers=auth("customer"), json=body) for _ in range(2)]
    )
    assert sorted(r.status_code for r in replies) == [200, 201]
    assert replies[0].json()["data"]["id"] == replies[1].json()["data"]["id"]
    assert (
        await client.post(
            path, headers=auth("customer"), json={**body, "content": "Different text"}
        )
    ).status_code == 409
    async with factory() as db:
        assert (
            await db.scalar(select(func.count()).select_from(SupportConversation)) == 1
        )
        assert await db.scalar(select(func.count()).select_from(SupportMessage)) == 1


@pytest.mark.asyncio
async def test_advisor_claim_is_private_and_feature_lock_enforced(api):
    client, auth, ids, factory, _ = api
    staff = await staff_accounts(client, auth)
    second = await client.post(
        "/api/auth/users",
        headers=auth("admin"),
        json={
            "username": "advisor2",
            "email": "advisor2@example.com",
            "fullName": "Advisor Two",
            "password": "initial123",
            "role": "advisor",
        },
    )
    uid = second.json()["data"]["id"]
    advisor2 = {"Authorization": "Bearer " + create_access_token({"id": uid})}
    cid = await begin(client, auth("customer"))
    path = f"/api/messaging/conversations/{cid}"
    # Two advisors cannot both claim the same previously unassigned thread by sending.
    replies = await asyncio.gather(
        client.post(
            path + "/messages", headers=staff["advisor"], json=message("Advisor One")
        ),
        client.post(path + "/messages", headers=advisor2, json=message("Advisor Two")),
    )
    assert sorted(r.status_code for r in replies) == [201, 404]
    winner = staff["advisor"] if replies[0].status_code == 201 else advisor2
    loser = advisor2 if winner == staff["advisor"] else staff["advisor"]
    assert (await client.get(path + "/messages", headers=loser)).status_code == 404
    assert (await client.get("/api/messaging/conversations", headers=loser)).json()[
        "data"
    ]["items"] == []
    assert (
        await client.put(path + "/assignment", headers=winner, json={"advisorId": None})
    ).status_code == 403
    assert (
        await client.put(
            path + "/assignment", headers=auth("admin"), json={"advisorId": uid}
        )
    ).status_code == 200
    assert (await client.get(path + "/messages", headers=advisor2)).status_code == 200
    locked = await client.put(
        f"/api/auth/users/{uid}/permissions",
        headers=auth("admin"),
        json={"disabledPermissions": ["messages"]},
    )
    assert locked.status_code == 200, locked.text
    assert (
        await client.get("/api/messaging/conversations", headers=advisor2)
    ).status_code == 403
    assert (
        await client.put(
            path + "/assignment", headers=auth("admin"), json={"advisorId": uid}
        )
    ).status_code == 400
    assert (
        await client.put(
            path + "/assignment", headers=auth("admin"), json={"advisorId": None}
        )
    ).status_code == 200
    advisors = (
        await client.get("/api/messaging/advisors", headers=auth("admin"))
    ).json()["data"]
    assert uid not in [person["id"] for person in advisors]


@pytest.mark.asyncio
async def test_pagination_and_read_cursor_cannot_skip_another_thread(api):
    client, auth, ids, factory, _ = api
    staff = await staff_accounts(client, auth)
    cid = await begin(client, auth("customer"))
    vid = await vehicle(client, auth, ids)
    second = await begin(client, auth("customer"), vid)
    async with factory() as db:
        rows = [
            SupportMessage(
                conversationId=cid,
                senderId=staff["advisor_id"],
                senderName="Advisor",
                senderRole="advisor",
                content=f"Message {index}",
                clientMessageId=str(uuid4()),
                createdAt=utcnow() - timedelta(minutes=2),
            )
            for index in range(55)
        ]
        foreign = SupportMessage(
            conversationId=second,
            senderId=staff["advisor_id"],
            senderName="Advisor",
            senderRole="advisor",
            content="Other thread",
            clientMessageId=str(uuid4()),
        )
        db.add_all([*rows, foreign])
        await db.commit()
        foreign_id = foreign.id
    path = f"/api/messaging/conversations/{cid}"
    page = (await client.get(path + "/messages", headers=auth("customer"))).json()[
        "data"
    ]
    assert len(page["items"]) == 50 and page["hasMore"] is True
    first, last = page["items"][0]["id"], page["items"][-1]["id"]
    older = (
        await client.get(path + f"/messages?before={first}", headers=auth("customer"))
    ).json()["data"]
    assert len(older["items"]) == 5 and older["hasMore"] is False
    assert (
        await client.post(
            path + "/read",
            headers=auth("customer"),
            json={"throughMessageId": foreign_id},
        )
    ).status_code == 404
    for cursor in (last, first):
        assert (
            await client.post(
                path + "/read",
                headers=auth("customer"),
                json={"throughMessageId": cursor},
            )
        ).status_code == 200
    async with factory() as db:
        from models import SupportRead

        marker = await db.get(SupportRead, (cid, ids["customer"]))
        assert marker.lastReadMessageId == last
    assert (
        await client.get(
            path + f"/messages?before={first}&after={last}", headers=auth("customer")
        )
    ).status_code == 422
