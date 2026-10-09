"""Job boundaries, photo proof, financial controls and scheduling conflicts."""

import base64
import io
from datetime import timedelta

import pytest
from PIL import Image
from sqlalchemy import select
from test_garage_care import staff_accounts
from test_workflow import api as api
from test_workflow import evidence, repair_body, vehicle

from models import Inventory, RepairTicket
from schemas.garage_care import today


def photo():
    output = io.BytesIO()
    Image.new("RGB", (20, 20), "green").save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode()


@pytest.mark.asyncio
async def test_evidence_identity_privacy_and_rework_round(api):
    client, auth, ids, _, _ = api
    vid = await vehicle(client, auth, ids)
    t = (
        await client.post(
            "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
        )
    ).json()["data"]
    tid, item_id = t["id"], t["items"][0]["id"]
    path = f"/api/repairs/{tid}"
    await client.put(path, headers=auth("mechanic"), json={"status": "working"})
    toggle = f"{path}/items/{item_id}/toggle"
    assert (
        await client.put(toggle, headers=auth("mechanic"), json={"isCompleted": True})
    ).status_code == 409
    upload = f"/api/workshop/tickets/{tid}/items/{item_id}/evidence"
    body = {
        "kind": "package",
        "image": photo(),
        "productCode": "WRONG",
        "note": "Read label on package",
    }
    assert (
        await client.post(upload, headers=auth("mechanic"), json=body)
    ).status_code == 409
    assert (
        await client.post(
            upload, headers=auth("customer"), json={**body, "productCode": "OIL-001"}
        )
    ).status_code == 403
    assert (
        await client.post(
            upload,
            headers=auth("mechanic"),
            json={
                **body,
                "productCode": "OIL-001",
                "image": base64.b64encode(b"not an image at all").decode(),
            },
        )
    ).status_code == 422
    await evidence(client, auth, t)
    assert (
        await client.put(toggle, headers=auth("mechanic"), json={"isCompleted": True})
    ).status_code == 200
    rows = (
        await client.get(
            f"/api/workshop/tickets/{tid}/evidence", headers=auth("customer")
        )
    ).json()["data"]
    assert len(rows) == 2 and all("image" not in r for r in rows)
    image_url = f"/api/workshop/evidence/{rows[0]['id']}/image"
    assert (await client.get(image_url, headers=auth("other"))).status_code == 403
    assert (await client.get(image_url)).status_code == 403
    image = await client.get(image_url, headers=auth("customer"))
    assert (
        image.status_code == 200
        and image.headers["cache-control"] == "private, no-store"
    )
    assert image.content.startswith(b"\xff\xd8")
    assert (
        await client.put(toggle, headers=auth("mechanic"), json={"isCompleted": False})
    ).status_code == 200
    assert (
        await client.put(toggle, headers=auth("mechanic"), json={"isCompleted": True})
    ).status_code == 409
    await evidence(client, auth, t)
    assert (
        await client.put(toggle, headers=auth("mechanic"), json={"isCompleted": True})
    ).status_code == 200
    assert (
        await client.put(
            f"/api/inventory/{ids['inventory_id']}",
            headers=auth("admin"),
            json={"sku": "DIFFERENT"},
        )
    ).status_code == 409


@pytest.mark.asyncio
async def test_receipts_expenses_and_cross_role_controls(api):
    client, auth, ids, _, _ = api
    s = await staff_accounts(client, auth)
    for role in ("advisor", "hr"):
        assert (
            await client.get("/api/finance/expenses", headers=s[role])
        ).status_code == 403
    assert (
        await client.get("/api/hr/operations", headers=auth("customer"))
    ).status_code == 403
    body = {
        "category": "parts",
        "payee": "Supplier",
        "documentNumber": "INV-2026-01",
        "amount": 1000,
        "note": "Parts purchase invoice verified",
    }
    create = await client.post(
        "/api/finance/expenses", headers=s["accountant"], json=body
    )
    assert create.status_code == 201, create.text
    eid = create.json()["data"]["id"]
    assert (
        await client.post(
            f"/api/finance/expenses/{eid}/pay", headers=s["accountant"], json={}
        )
    ).status_code == 409
    assert (
        await client.post(
            f"/api/finance/expenses/{eid}/approve", headers=s["accountant"]
        )
    ).status_code == 403
    assert (
        await client.post(f"/api/finance/expenses/{eid}/approve", headers=auth("admin"))
    ).status_code == 200
    assert (
        await client.post(
            f"/api/finance/expenses/{eid}/pay",
            headers=s["accountant"],
            json={"method": "bank"},
        )
    ).status_code == 422
    paid = await client.post(
        f"/api/finance/expenses/{eid}/pay",
        headers=s["accountant"],
        json={"method": "bank", "reference": "BANK-123"},
    )
    assert paid.status_code == 200 and paid.json()["data"]["paidBy"]
    assert (
        await client.post(
            f"/api/finance/expenses/{eid}/pay",
            headers=s["accountant"],
            json={"method": "cash"},
        )
    ).status_code == 409
    assert (
        await client.post("/api/finance/expenses", headers=s["accountant"], json=body)
    ).status_code == 409
    own = await client.post(
        "/api/finance/expenses",
        headers=auth("admin"),
        json={**body, "documentNumber": "SELF-01"},
    )
    assert (
        await client.post(
            f"/api/finance/expenses/{own.json()['data']['id']}/approve",
            headers=auth("admin"),
        )
    ).status_code == 409
    vid = await vehicle(client, auth, ids)
    t = (
        await client.post(
            "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
        )
    ).json()["data"]
    path = f"/api/repairs/{t['id']}"
    await client.put(path, headers=auth("mechanic"), json={"status": "working"})
    await evidence(client, auth, t)
    await client.put(
        f"{path}/items/{t['items'][0]['id']}/toggle",
        headers=auth("mechanic"),
        json={"isCompleted": True},
    )
    await client.put(path, headers=auth("mechanic"), json={"status": "completed"})
    assert (
        await client.put(
            path,
            headers=s["accountant"],
            json={
                "status": "paid",
                "paymentMethod": "bank",
                "paymentReference": "TRANSFER-01",
            },
        )
    ).status_code == 200
    assert (
        await client.put(
            path,
            headers=s["accountant"],
            json={
                "status": "paid",
                "paymentMethod": "bank",
                "paymentReference": "TRANSFER-01",
            },
        )
    ).status_code == 200
    receipts = (
        await client.get("/api/finance/receipts", headers=s["accountant"])
    ).json()["data"]
    assert (
        len(receipts) == 1
        and receipts[0]["reference"] == "TRANSFER-01"
        and receipts[0]["amount"] == 250
    )


@pytest.mark.asyncio
async def test_shifts_leave_and_ev_qualifications(api):
    client, auth, ids, factory, _ = api
    s = await staff_accounts(client, auth)
    on = today() + timedelta(days=5)
    shift = {
        "userId": ids["mechanic"],
        "startsAt": f"{on}T08:00:00+07:00",
        "endsAt": f"{on}T16:00:00+07:00",
        "bay": "Workshop 1",
        "note": "Morning workshop shift",
    }
    assert (
        await client.post("/api/hr/shifts", headers=s["advisor"], json=shift)
    ).status_code == 403
    created = await client.post("/api/hr/shifts", headers=s["hr"], json=shift)
    assert created.status_code == 201, created.text
    assert (
        await client.post("/api/hr/shifts", headers=s["hr"], json=shift)
    ).status_code == 409
    leave = await client.post(
        "/api/hr/leave",
        headers=auth("mechanic"),
        json={"fromDate": str(on), "toDate": str(on), "reason": "Personal appointment"},
    )
    lid = leave.json()["data"]["id"]
    decide = f"/api/hr/leave/{lid}/decide"
    assert (
        await client.post(
            decide, headers=s["hr"], json={"approved": True, "note": "Checked request"}
        )
    ).status_code == 409
    await client.post(
        f"/api/hr/shifts/{created.json()['data']['id']}/cancel", headers=s["hr"]
    )
    assert (
        await client.post(
            decide, headers=s["hr"], json={"approved": True, "note": "Shift reassigned"}
        )
    ).status_code == 200
    assert (
        await client.post("/api/hr/shifts", headers=s["hr"], json=shift)
    ).status_code == 409
    own = (await client.get("/api/hr/operations", headers=auth("mechanic"))).json()[
        "data"
    ]
    assert all(x["userId"] == ids["mechanic"] for rows in own.values() for x in rows)
    await client.put(
        f"/api/inventory/{ids['inventory_id']}",
        headers=auth("admin"),
        json={"highVoltage": True},
    )
    vid = await vehicle(client, auth, ids)
    t = (
        await client.post(
            "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
        )
    ).json()["data"]
    await client.put(
        f"/api/repairs/{t['id']}", headers=auth("mechanic"), json={"status": "working"}
    )
    upload = f"/api/workshop/tickets/{t['id']}/items/{t['items'][0]['id']}/evidence"
    assert (
        await client.post(
            upload,
            headers=auth("mechanic"),
            json={"kind": "completion", "image": photo(), "note": "Checked unit"},
        )
    ).status_code == 409
    cert = {
        "userId": ids["mechanic"],
        "kind": "ev_safety",
        "issuer": "Training centre",
        "certificateNumber": "CERT-001",
        "validFrom": str(today()),
        "validUntil": str(today() + timedelta(days=365)),
    }
    certificate = await client.post("/api/hr/certificates", headers=s["hr"], json=cert)
    assert certificate.status_code == 201
    assert (
        await client.post(
            upload,
            headers=auth("mechanic"),
            json={"kind": "completion", "image": photo(), "note": "Checked unit"},
        )
    ).status_code == 201
    assert (
        await client.post(
            f"/api/hr/certificates/{certificate.json()['data']['id']}/revoke",
            headers=s["hr"],
            json={"approved": False, "note": "Certificate withdrawn by issuer"},
        )
    ).status_code == 200
    assert (
        await client.post(
            upload,
            headers=auth("mechanic"),
            json={"kind": "completion", "image": photo(), "note": "Checked unit again"},
        )
    ).status_code == 409


@pytest.mark.asyncio
async def test_fitment_mismatch_preserves_stock_and_catalog_ev_filter(api):
    client, auth, ids, factory, _ = api
    fitment = {
        "brand": "Honda",
        "model": "City",
        "yearFrom": 2020,
        "yearTo": 2026,
        "engine": "1.5",
        "sourceUrl": "https://example.com/oem-reference",
    }
    assert (
        await client.put(
            f"/api/inventory/{ids['inventory_id']}",
            headers=auth("admin"),
            json={"fitments": [fitment]},
        )
    ).status_code == 200
    vid = await vehicle(client, auth, ids)
    assert (
        await client.post(
            "/api/repairs", headers=auth("admin"), json=repair_body(vid, ids)
        )
    ).status_code == 409
    async with factory() as db:
        assert (await db.get(Inventory, ids["inventory_id"])).quantity == 5
        assert await db.scalar(select(RepairTicket.id)) is None
    catalog = (
        await client.get("/api/maintenance/catalog", headers=auth("customer"))
    ).json()["data"]
    brands = (await client.get("/api/settings/brands", headers=auth("admin"))).json()[
        "data"
    ]
    assert {b["brand"] for b in catalog["brands"]}.issubset({b["name"] for b in brands})
    vf = next(b for b in catalog["brands"] if b["brand"] == "VinFast")
    ev = next(p for p in vf["modelProfiles"] if p["model"] == "VF 8")
    ice = next(p for p in vf["modelProfiles"] if p["model"] == "Fadil")
    assert (
        "engine_oil" not in catalog["powertrainComponents"][ev["powertrain"]]
        and "ev_battery_cooling" in catalog["powertrainComponents"][ev["powertrain"]]
    )
    assert (
        "engine_oil" in catalog["powertrainComponents"][ice["powertrain"]]
        and len(catalog["brands"]) == 15
    )
