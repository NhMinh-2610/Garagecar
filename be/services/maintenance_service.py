"""Deterministic due calculation. Inspection never resets replacement history."""

import calendar
from datetime import date, timedelta
from hashlib import sha256

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from models import (
    MaintenanceProfile,
    MaintenanceRecord,
    MaintenanceReminder,
    Mechanic,
    RepairTicket,
    Vehicle,
    VehicleCare,
)
from schemas.garage_care import today


def row_dict(row):
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


def add_months(day, months):
    year, index = divmod(day.year * 12 + day.month - 1 + months, 12)
    return date(year, index + 1, min(day.day, calendar.monthrange(year, index + 1)[1]))


def matches(vehicle, care, scope):
    def equal(a, b):
        return str(a or "").strip().casefold() == str(b or "").strip().casefold()

    return (
        equal(vehicle.carBrand, scope["brand"])
        and equal(vehicle.carModel, scope["model"])
        and scope["yearFrom"] <= care.modelYear <= scope["yearTo"]
        and all(
            equal(getattr(care, key), scope[key])
            for key in ("engine", "gearbox", "market", "usage")
        )
    )


def calculate_due(care, rules, records, on=None):
    on = on or today()
    result = []
    for rule in rules:
        history = sorted(
            (
                r
                for r in records
                if r.component == rule["component"] and r.action == rule["action"]
            ),
            key=lambda r: (r.performedOn, r.odometer, r.id or 0),
        )
        last = history[-1] if history else None
        prefix = "repeat" if last else "first"
        km, months = rule.get(prefix + "Km"), rule.get(prefix + "Months")
        due_km = (last.odometer if last else 0) + km if km is not None else None
        due_date = (
            add_months(last.performedOn if last else care.firstUseDate, months)
            if months is not None
            else None
        )
        stale = (on - care.observedOn).days > 90
        past_km = due_km is not None and care.odometer >= due_km
        past_date = due_date is not None and on >= due_date
        soon_km = due_km is not None and not stale and care.odometer >= due_km - 1000
        soon_date = due_date is not None and on >= due_date - timedelta(days=30)
        status = (
            "due" if past_km or past_date else "soon" if soon_km or soon_date else "ok"
        )
        if km is None and months is None:
            status = "needs_review"
        if stale and due_date is None and not past_km:
            status = "needs_odometer"
        # Cycle identifies the service event/initial baseline, never severity or today's date.
        anchor = (
            f"{last.id}:{last.performedOn}:{last.odometer}"
            if last
            else f"initial:{care.firstUseDate}"
        )
        cycle = sha256(anchor.encode()).hexdigest()[:32]
        result.append(
            {
                **rule,
                "ruleKey": rule["component"] + ":" + rule["action"],
                "cycleKey": cycle,
                "dueKm": due_km,
                "dueDate": due_date.isoformat() if due_date else None,
                "status": status,
                "odometerStale": stale,
                "lastRecordId": last.id if last else None,
            }
        )
    return result


async def vehicle_access(db, vehicle_id, user, write=False):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(404, "Không tìm thấy xe")
    if user["role"] in ("admin", "advisor"):
        return vehicle
    if not write and user["role"] == "customer" and vehicle.customerId == user["id"]:
        return vehicle
    if not write and user["role"] == "mechanic":
        found = await db.scalar(
            select(RepairTicket.id)
            .join(Mechanic, RepairTicket.mechanicId == Mechanic.id)
            .where(
                RepairTicket.vehicleId == vehicle_id,
                Mechanic.userId == user["id"],
                Mechanic.status == "active",
            )
        )
        if found:
            return vehicle
    raise HTTPException(403, "Bạn không có quyền truy cập hồ sơ xe này")


async def schedule(db, vehicle):
    care = await db.get(VehicleCare, vehicle.id)
    if not care:
        return {
            "state": "missing_vehicle_details",
            "rules": [],
            "care": None,
            "profile": None,
        }
    profile = (
        await db.get(MaintenanceProfile, care.profileId) if care.profileId else None
    )
    state = (
        "ready"
        if profile
        and profile.status == "approved"
        and matches(vehicle, care, profile.scope)
        else "unverified_profile"
    )
    records = list(
        (
            await db.scalars(
                select(MaintenanceRecord).where(
                    MaintenanceRecord.vehicleId == vehicle.id
                )
            )
        ).all()
    )
    return {
        "state": state,
        "care": row_dict(care),
        "profile": row_dict(profile) if profile else None,
        "rules": calculate_due(care, profile.rules, records)
        if state == "ready"
        else [],
        "records": [
            row_dict(r)
            for r in sorted(records, key=lambda r: (r.performedOn, r.id), reverse=True)
        ],
    }


async def scan_reminders(db, vehicle_ids=None):
    query = (
        select(Vehicle)
        .join(VehicleCare, VehicleCare.vehicleId == Vehicle.id)
        .order_by(Vehicle.id)
        .with_for_update(of=Vehicle)
    )
    if vehicle_ids is not None:
        query = query.where(Vehicle.id.in_(vehicle_ids))
    vehicles = (await db.scalars(query)).all()
    generated = 0
    for vehicle in vehicles:
        data = await schedule(db, vehicle)
        current = set()
        if data["state"] == "ready":
            for rule in data["rules"]:
                if rule["status"] not in ("due", "soon"):
                    continue
                current.add((data["profile"]["id"], rule["ruleKey"], rule["cycleKey"]))
                summary = {
                    **rule,
                    "licensePlate": vehicle.licensePlate,
                    "sourceUrl": data["profile"]["sourceUrl"],
                    "sourcePage": data["profile"]["sourcePage"],
                    "profileTitle": data["profile"]["title"],
                }
                stmt = insert(MaintenanceReminder).values(
                    vehicleId=vehicle.id,
                    profileId=data["profile"]["id"],
                    ruleKey=rule["ruleKey"],
                    cycleKey=rule["cycleKey"],
                    summary=summary,
                    status="pending",
                )
                stmt = stmt.on_conflict_do_nothing(constraint="uq_maintenance_cycle")
                await db.execute(stmt)
                generated += 1
        old = (
            await db.scalars(
                select(MaintenanceReminder).where(
                    MaintenanceReminder.vehicleId == vehicle.id
                )
            )
        ).all()
        for reminder in old:
            if (reminder.profileId, reminder.ruleKey, reminder.cycleKey) not in current:
                reminder.status = "closed"
            else:
                if reminder.status == "closed":
                    reminder.status = "published" if reminder.publishedAt else "pending"
                rule = next(
                    r for r in data["rules"] if r["ruleKey"] == reminder.ruleKey
                )
                reminder.summary = {**reminder.summary, **rule}
    return generated
