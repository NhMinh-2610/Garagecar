"""Build a small, authorised vehicle context without customer identity fields."""

import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models import RepairTicket
from services.maintenance_service import schedule, vehicle_access


@lru_cache(maxsize=1)
def catalog():
    return json.loads(
        (Path(__file__).parents[1] / "data" / "maintenance_catalog.json").read_text(
            encoding="utf-8"
        )
    )


async def build_chat_context(db, vehicle_id, user, question):
    vehicle = await vehicle_access(db, vehicle_id, user)
    maintenance = await schedule(db, vehicle)
    care = maintenance.get("care") or {}
    context = {
        "vehicle": {
            "brand": vehicle.carBrand,
            "model": vehicle.carModel,
            **{
                key: care.get(key)
                for key in ("modelYear", "engine", "gearbox", "odometer", "observedOn")
            },
        },
        "maintenanceState": maintenance["state"],
        "maintenanceRules": [
            {
                key: rule.get(key)
                for key in ("component", "action", "dueKm", "dueDate", "status")
            }
            for rule in maintenance["rules"][:30]
        ],
    }
    sources = []
    profile = maintenance.get("profile")
    if maintenance["state"] == "ready" and profile:
        sources.append(
            {
                "title": profile["title"],
                "url": profile["sourceUrl"],
                "type": "approved_schedule",
            }
        )
    # Query the selected vehicle only; never expose other customer repairs or staff identities.
    tickets = (
        await db.scalars(
            select(RepairTicket)
            .options(selectinload(RepairTicket.items))
            .where(RepairTicket.vehicleId == vehicle.id)
            .order_by(RepairTicket.createdAt.desc(), RepairTicket.id.desc())
            .limit(3)
        )
    ).all()
    context["recentRepairs"] = [
        {
            "status": ticket.status,
            "createdOn": ticket.createdAt.date().isoformat()
            if ticket.createdAt
            else None,
            "items": [
                {
                    "task": item.taskName[:150],
                    "part": (item.partName or "")[:150],
                    "completed": item.isCompleted,
                }
                for item in ticket.items[:8]
            ],
        }
        for ticket in tickets
    ]
    reference = catalog()
    brand = next(
        (
            b
            for b in reference["brands"]
            if b["brand"].casefold() == vehicle.carBrand.casefold()
        ),
        None,
    )
    if brand:
        model = next(
            (
                m
                for m in brand.get("modelProfiles", [])
                if m["model"].casefold() == (vehicle.carModel or "").casefold()
            ),
            None,
        )
        powertrain = model.get("powertrain") if model else None
        context["vehicle"]["catalogPowertrain"] = powertrain
        context["referencePolicy"] = reference["policy"]
        components = [
            c
            for c in reference["components"]
            if not powertrain or powertrain in c.get("powertrains", [])
        ]
        words = set(question.lower().split())
        components.sort(
            key=lambda c: len(
                words & set((c["name"] + " " + c["group"]).lower().split())
            ),
            reverse=True,
        )
        context["referenceComponents"] = [
            {key: c.get(key) for key in ("name", "inspection", "caution")}
            for c in components[:6]
        ]
        sources.append(
            {
                "title": f"Tài liệu tham khảo {brand['brand']}",
                "url": brand["sourceUrl"],
                "type": "manufacturer_reference",
            }
        )
    return context, sources
