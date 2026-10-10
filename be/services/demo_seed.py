"""Atomic, additive workshop scenarios. Every entity belongs to a demo namespace.

Run explicitly with ``python seed.py --demo``. A committed manifest makes later
runs read-only, including when users have changed demo passwords or records.
The caller owns the transaction; this module never commits or resets data.
"""

import json
from collections import Counter
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import or_, select, text

from core.security import hash_password
from models import (
    Booking,
    Brand,
    EmployeeProfile,
    Expense,
    Inventory,
    InventoryMovement,
    LeaveRequest,
    MaintenanceProfile,
    MaintenanceRecord,
    MaintenanceReminder,
    Mechanic,
    PaymentReceipt,
    RepairEvidence,
    RepairTicket,
    ServiceFollowup,
    ServiceQuote,
    ServiceVisit,
    StaffCertificate,
    StaffShift,
    SupportConversation,
    SupportMessage,
    SupportRead,
    SystemParameter,
    User,
    Vehicle,
    VehicleCare,
    Wage,
)
from schemas.garage_care import today
from schemas.repair import RepairItemCreate
from services.maintenance_service import add_months, scan_reminders
from services.repair_service import replace_items, sync_vehicle

DEMO_PASSWORD = "Demo123456!"
DEMO_MANIFEST_KEY = "demo_dataset_v1"
DEMO_SOURCE_URL = "http://localhost:8000/static/demo/maintenance.html"
DEMO_NOTE = "[DEMO] Dữ liệu giả lập để trình diễn, không phải hồ sơ hay hướng dẫn hãng."
DEMO_ACCOUNTS = {
    "admin": "Quản trị mẫu",
    "advisor": "Nguyễn An · Cố vấn mẫu",
    "accountant": "Lê Thu · Kế toán mẫu",
    "hr": "Phạm Hà · Nhân sự mẫu",
    "mechanic": "Trần Minh · Kỹ thuật viên mẫu",
    "customer": "Hoàng Linh · Khách hàng mẫu",
}
VEHICLE_SCENARIOS = (
    ("vf8", "VinFast", "VF 8", "DEMO-EV", "DEMO-1AT", 2024, 29500),
    ("vios", "Toyota", "Vios", "DEMO-ICE", "DEMO-CVT", 2023, 39800),
    ("city", "Honda", "City", "DEMO-ICE", "DEMO-CVT", 2023, 45000),
    ("accent", "Hyundai", "Accent", "DEMO-ICE", "DEMO-6AT", 2022, 65000),
    ("seltos", "Kia", "Seltos", "DEMO-ICE", "DEMO-6AT", 2024, 18000),
    ("ranger", "Ford", "Ranger", "DEMO-DIESEL", "DEMO-6AT", 2022, 82000),
    ("c200", "Mercedes-Benz", "C-Class", "DEMO-ICE", "DEMO-9AT", 2023, 28000),
    ("vf5", "VinFast", "VF 5", "DEMO-EV", "DEMO-1AT", 2024, 14000),
)
PART_SCENARIOS = (
    ("OIL", "Dầu động cơ mô phỏng", 100, 130000, False),
    ("OIL-FILTER", "Lọc dầu mô phỏng", 30, 160000, False),
    ("CABIN-VF8", "Lọc cabin VinFast VF 8 mô phỏng", 16, 320000, False),
    ("CABIN-VF5", "Lọc cabin VinFast VF 5 mô phỏng", 12, 280000, False),
    ("BRAKE-PAD", "Bộ má phanh mô phỏng", 18, 950000, False),
    ("BRAKE-FLUID", "Dầu phanh mô phỏng", 25, 190000, False),
    ("WIPER", "Bộ gạt mưa mô phỏng", 3, 340000, False),
    ("AIR-FILTER", "Lọc gió động cơ mô phỏng", 20, 220000, False),
    ("SPARK-PLUG", "Bugi mô phỏng", 24, 240000, False),
    ("COOLANT", "Dung dịch làm mát mô phỏng", 30, 160000, False),
    ("BATTERY-12V", "Ắc quy 12 V mô phỏng", 5, 1750000, False),
    ("HV-HARNESS", "Dây dẫn cao áp EV mô phỏng", 2, 4200000, True),
)


def demo_email(role):
    return f"{role}.demo@autopro.com"


def stamp(day, hour=2):
    """UTC timestamp; 02:00 UTC is 09:00 in the garage's VN timezone."""
    return datetime.combine(day, time(hour))


class DemoCollisionError(ValueError):
    """A reserved identifier belongs to data not created by this seed."""


class Dataset:
    def __init__(self, db):
        self.db = db
        self.rows = []

    async def add(self, model, **values):
        row = model(**values)
        self.db.add(row)
        self.rows.append(row)
        await self.db.flush()
        return row

    def counts(self):
        return dict(sorted(Counter(row.__tablename__ for row in self.rows).items()))


async def reject_collisions(db):
    checks = (
        (
            User,
            or_(
                User.email.in_([demo_email(role) for role in DEMO_ACCOUNTS]),
                User.username.in_([f"demo_{role}" for role in DEMO_ACCOUNTS]),
            ),
        ),
        (
            Vehicle,
            Vehicle.licensePlate.in_(
                [f"DEMO{v[0].upper()}" for v in VEHICLE_SCENARIOS]
            ),
        ),
        (
            Inventory,
            or_(Inventory.sku.like("DEMO-%"), Inventory.barcode.like("DEMO-%")),
        ),
        (Expense, Expense.documentNumber.like("DEMO-%")),
        (MaintenanceProfile, MaintenanceProfile.version == "DEMO-V1"),
    )
    for model, condition in checks:
        if await db.scalar(select(model).where(condition).limit(1)):
            raise DemoCollisionError(
                f"Reserved demo identifier already exists in {model.__tablename__}. "
                "Nothing was changed. Rename that identifier before creating the demo dataset."
            )


async def seed_demo(db, on: date | None = None):
    """Create linked demo scenarios once, preserving every pre-existing row.

    PostgreSQL advisory lock serializes concurrent seed invocations. An existing
    manifest is returned as-is: there is no password reset, stock top-up or
    restoration of records a user has edited while trying the application.
    """
    await db.execute(text("SELECT pg_advisory_xact_lock(741920261009)"))
    previous = await db.scalar(
        select(SystemParameter).where(SystemParameter.key == DEMO_MANIFEST_KEY)
    )
    if previous:
        return {**json.loads(previous.value), "created": False}
    await reject_collisions(db)
    on = on or today()
    dataset = Dataset(db)
    users = {}
    for role, name in DEMO_ACCOUNTS.items():
        users[role] = await dataset.add(
            User,
            username=f"demo_{role}",
            email=demo_email(role),
            password=hash_password(DEMO_PASSWORD),
            fullName=name,
            role=role,
            isActive=True,
            disabledPermissions=[],
        )
    admin, advisor, accountant, hr, worker, customer = (
        users[role] for role in DEMO_ACCOUNTS
    )
    mechanic = await dataset.add(
        Mechanic,
        userId=worker.id,
        fullName=worker.fullName,
        phone="0900000105",
        specialty="Chẩn đoán, bảo dưỡng và an toàn EV · DEMO",
        status="active",
    )
    for role in ("admin", "advisor", "accountant", "hr", "mechanic"):
        await dataset.add(
            EmployeeProfile,
            userId=users[role].id,
            phone=f"090000010{list(DEMO_ACCOUNTS).index(role)}",
            department={
                "admin": "Điều hành",
                "advisor": "Dịch vụ",
                "accountant": "Kế toán",
                "hr": "Nhân sự",
                "mechanic": "Xưởng kỹ thuật",
            }[role],
            jobTitle=DEMO_ACCOUNTS[role],
            startDate=on - timedelta(days=365),
            note=DEMO_NOTE,
            updatedBy=hr.id,
        )
    for kind, offset in (
        ("ev_safety", 365),
        ("diagnostics", 120),
        ("air_conditioning", -10),
    ):
        await dataset.add(
            StaffCertificate,
            userId=worker.id,
            kind=kind,
            issuer="Trung tâm đào tạo giả lập · DEMO",
            certificateNumber=f"DEMO-{kind.upper()}",
            validFrom=on - timedelta(days=365),
            validUntil=on + timedelta(days=offset),
            verifiedBy=hr.id,
            status="verified",
        )
    for role in ("advisor", "accountant", "hr", "mechanic"):
        for day_offset in (0, 1):
            await dataset.add(
                StaffShift,
                userId=users[role].id,
                startsAt=stamp(on + timedelta(days=day_offset), 1),
                endsAt=stamp(on + timedelta(days=day_offset), 10),
                bay="Cầu nâng EV 01" if role == "mechanic" else "Văn phòng dịch vụ",
                note=DEMO_NOTE,
                createdBy=hr.id,
                status="scheduled",
            )
    for role, days, status in (
        ("mechanic", 5, "pending"),
        ("advisor", 7, "approved"),
        ("accountant", 9, "rejected"),
    ):
        await dataset.add(
            LeaveRequest,
            userId=users[role].id,
            fromDate=on + timedelta(days=days),
            toDate=on + timedelta(days=days),
            reason=f"{DEMO_NOTE} Xin nghỉ việc gia đình.",
            status=status,
            decidedBy=hr.id if status != "pending" else None,
            decidedAt=stamp(on) if status != "pending" else None,
            decisionNote="[DEMO] Đã kiểm tra lịch phân ca."
            if status != "pending"
            else None,
        )

    vehicles, profiles = {}, {}
    for key, brand, model, engine, gearbox, year, odometer in VEHICLE_SCENARIOS:
        if not await db.scalar(select(Brand.id).where(Brand.name == brand)):
            await dataset.add(Brand, name=brand)
        vehicle = await dataset.add(
            Vehicle,
            licensePlate=f"DEMO{key.upper()}",
            customerId=customer.id,
            customerName=customer.fullName,
            phone="0900000106",
            address="Địa chỉ khách hàng giả lập · DEMO",
            carBrand=brand,
            carModel=model,
            status="waiting",
            receivedDate=stamp(on - timedelta(days=2)),
        )
        vehicles[key] = vehicle
        component = "cabin_filter" if engine == "DEMO-EV" else "engine_oil"
        profile = await dataset.add(
            MaintenanceProfile,
            title=f"[DEMO · GIẢ LẬP] {brand} {model} · Không phải lịch hãng",
            scope={
                "brand": brand,
                "model": model,
                "yearFrom": year,
                "yearTo": year,
                "engine": engine,
                "gearbox": gearbox,
                "market": "VN",
                "usage": "normal",
            },
            rules=[
                {
                    "component": component,
                    "action": "replace",
                    "firstKm": 10000,
                    "firstMonths": 12,
                    "repeatKm": 10000,
                    "repeatMonths": 12,
                    "note": f"{DEMO_NOTE} Mốc 10.000 km/12 tháng chỉ dùng thử nhắc hạn.",
                },
                {
                    "component": "brake_pads",
                    "action": "inspect",
                    "firstKm": 20000,
                    "firstMonths": 24,
                    "repeatKm": 20000,
                    "repeatMonths": 24,
                    "note": f"{DEMO_NOTE} Mốc giả định, không áp dụng cho xe thực.",
                },
            ],
            sourceUrl=DEMO_SOURCE_URL,
            sourcePage="Kịch bản dữ liệu mẫu · KHÔNG PHẢI SÁCH HÃNG",
            version="DEMO-V1",
            status="approved",
            approvedBy=admin.id,
            approvedAt=stamp(on - timedelta(days=1)),
        )
        profiles[key] = profile
        await dataset.add(
            VehicleCare,
            vehicleId=vehicle.id,
            profileId=profile.id,
            vin=None,
            modelYear=year,
            engine=engine,
            gearbox=gearbox,
            market="VN",
            usage="normal",
            firstUseDate=date(year, 1, 1),
            odometer=odometer,
            observedOn=on,
            updatedBy=advisor.id,
        )
    await dataset.add(
        MaintenanceProfile,
        title="[DEMO · NHÁP] Lịch bổ sung VinFast VF 5 · chờ kiểm tra",
        scope=profiles["vf5"].scope,
        rules=profiles["vf5"].rules,
        sourceUrl=DEMO_SOURCE_URL,
        sourcePage="Kịch bản bản nháp, không phải lịch hãng",
        version="DEMO-V1",
        status="draft",
    )

    parts = {}
    for index, (code, name, quantity, price, high_voltage) in enumerate(PART_SCENARIOS):
        fitments = []
        if code.startswith("CABIN-VF"):
            scope = profiles["vf8" if code == "CABIN-VF8" else "vf5"].scope
            fitments = [
                {
                    k: scope[k]
                    for k in ("brand", "model", "yearFrom", "yearTo", "engine")
                }
            ]
            fitments[0]["sourceUrl"] = DEMO_SOURCE_URL
        part = await dataset.add(
            Inventory,
            name=f"[DEMO] {name}",
            sku=f"DEMO-{code}",
            barcode=f"DEMO-BAR-{index + 1:03d}",
            manufacturer="GarageCar Demo · mã giả lập",
            fitments=fitments,
            highVoltage=high_voltage,
            quantity=quantity,
            unitPrice=price,
            createdAt=stamp(add_months(on.replace(day=1), -6)),
        )
        parts[code] = part
        await dataset.add(
            InventoryMovement,
            inventoryId=part.id,
            quantityChange=quantity,
            balanceAfter=quantity,
            reason="opening",
            reference="DEMO-OPENING",
            createdAt=part.createdAt,
        )
    restocked = parts["CABIN-VF8"]
    restocked.quantity += 4
    await dataset.add(
        InventoryMovement,
        inventoryId=restocked.id,
        quantityChange=4,
        balanceAfter=restocked.quantity,
        reason="receipt",
        reference="DEMO-RECEIPT-001",
        createdAt=stamp(on - timedelta(days=1)),
    )
    for name, price in (
        ("Thay dầu và lọc dầu", 150000),
        ("Kiểm tra phanh", 180000),
        ("Thay lọc cabin", 100000),
        ("Chẩn đoán bằng máy", 300000),
    ):
        if not await db.scalar(select(Wage.id).where(Wage.name == name)):
            await dataset.add(Wage, name=name, price=price)

    image = (
        Path(__file__).resolve().parents[1] / "data" / "demo_evidence.jpg"
    ).read_bytes()
    image_hash = sha256(image).hexdigest()

    async def quote(
        visit, stage, specifications, state="approved", revision=1, at=None
    ):
        at = at or visit.createdAt
        rows, total = [], Decimal(0)
        for task, code, quantity, labor in specifications:
            part = parts[code] if code else None
            price = Decimal(part.unitPrice) if part else Decimal(0)
            value = price * quantity + Decimal(labor)
            total += value
            rows.append(
                {
                    "taskName": task,
                    "inventoryId": part.id if part else None,
                    "quantity": quantity,
                    "laborPrice": str(labor),
                    "partName": part.name if part else "---",
                    "partPrice": str(price),
                    "totalPrice": str(value),
                }
            )
        return await dataset.add(
            ServiceQuote,
            visitId=visit.id,
            revision=revision,
            stage=stage,
            items=rows,
            totalAmount=total,
            status=state,
            decidedBy=customer.id if state != "pending" else None,
            decidedAt=at + timedelta(minutes=30) if state != "pending" else None,
            decisionNote=f"{DEMO_NOTE} Khách mẫu xác nhận phiên bản báo giá."
            if state != "pending"
            else None,
            createdAt=at,
        )

    async def visit_for(key, status, day=None):
        at = stamp(day or on - timedelta(days=1))
        return await dataset.add(
            ServiceVisit,
            vehicleId=vehicles[key].id,
            advisorId=advisor.id,
            mechanicId=mechanic.id,
            concern=f"[DEMO] Khách yêu cầu kiểm tra và bảo dưỡng {vehicles[key].carModel}.",
            initialInspection=f"{DEMO_NOTE} Đã ghi nhận tình trạng ngoại thất, đèn cảnh báo và ODO.",
            diagnosis=None
            if status == "intake"
            else "[DEMO] Đã kiểm tra theo kịch bản, không có kết quả đo thực tế.",
            status=status,
            createdAt=at,
        )

    async def repair_for(key, status, specs, day=None):
        visit = await visit_for(key, "in_workshop", day)
        await quote(
            visit, "preliminary", [("[DEMO] Kiểm tra ban đầu", None, 1, 100000)]
        )
        final = await quote(
            visit, "final", specs, "converted", 2, visit.createdAt + timedelta(hours=1)
        )
        ticket = await dataset.add(
            RepairTicket,
            vehicle=vehicles[key],
            serviceVisitId=visit.id,
            mechanicId=mechanic.id,
            mechanicName=mechanic.fullName,
            status="draft",
            items=[],
            createdAt=visit.createdAt + timedelta(hours=2),
        )
        await replace_items(
            db,
            ticket,
            [
                RepairItemCreate(
                    taskName=row["taskName"],
                    inventoryId=row["inventoryId"],
                    quantity=row["quantity"],
                    laborPrice=row["laborPrice"],
                )
                for row in final.items
            ],
        )
        await db.flush()
        dataset.rows.extend(ticket.items)
        # The production helper owns stock ledger arithmetic; mark its new rows.
        movements = (
            await db.scalars(
                select(InventoryMovement).where(
                    InventoryMovement.reference == f"repair:{ticket.id}"
                )
            )
        ).all()
        for movement in movements:
            movement.createdAt = ticket.createdAt
            dataset.rows.append(movement)
        ticket.status = status
        ticket.startedAt = (
            ticket.createdAt + timedelta(minutes=15) if status != "draft" else None
        )
        if status in ("working", "completed", "paid"):
            for index, item in enumerate(ticket.items):
                completed = status in ("completed", "paid") or index == 0
                if not completed:
                    continue
                for kind in (
                    ("package", "completion") if item.inventoryId else ("completion",)
                ):
                    await dataset.add(
                        RepairEvidence,
                        itemId=item.id,
                        round=item.evidenceRound,
                        kind=kind,
                        productCode=item.partCode if kind == "package" else None,
                        expectedCode=item.partCode if kind == "package" else None,
                        lotNumber="DEMO-LOT-001" if kind == "package" else None,
                        note=f"{DEMO_NOTE} Ảnh minh họa tạo bằng máy, KHÔNG phải bằng chứng sửa xe thực.",
                        image=image,
                        sha256=image_hash,
                        createdBy=worker.id,
                        createdAt=ticket.createdAt + timedelta(hours=2),
                    )
                item.isCompleted = True
                item.completedAt = ticket.createdAt + timedelta(hours=3)
        if status in ("completed", "paid"):
            ticket.completedAt = ticket.createdAt + timedelta(hours=4)
            visit.qc = {
                "workVerified": True,
                "safetyChecked": True,
                "roadTestOrReason": "[DEMO] Tình huống nghiệm thu giả lập",
                "note": DEMO_NOTE,
            }
            visit.qcBy = advisor.id
            visit.qcAt = ticket.createdAt + timedelta(hours=5)
            visit.status = "qc_passed"
        if status == "paid":
            ticket.paidAt = ticket.createdAt + timedelta(hours=6)
            await dataset.add(
                PaymentReceipt,
                ticketId=ticket.id,
                amount=ticket.totalAmount,
                method="bank",
                reference=f"DEMO-PAY-{ticket.id}",
                receivedBy=accountant.id,
                createdAt=ticket.paidAt,
            )
            visit.status = "closed"
        await sync_vehicle(db, vehicles[key])
        return visit, ticket

    historical = []
    for month in range(-5, 1):
        day = add_months(on.replace(day=min(6, on.day)), month)
        historical.append(
            await repair_for(
                "ranger",
                "paid",
                [
                    ("[DEMO] Thay dầu động cơ", "OIL", 6, 120000 + (month + 5) * 20000),
                    ("[DEMO] Thay lọc dầu", "OIL-FILTER", 1, 60000),
                    ("[DEMO] Kiểm tra an toàn", None, 1, 150000),
                ],
                day,
            )
        )
    vehicles["ranger"].status = "delivered"
    working, _ = await repair_for(
        "vf8",
        "working",
        [
            ("[DEMO] Thay lọc cabin VF 8", "CABIN-VF8", 1, 100000),
            ("[DEMO] Kiểm tra cổng sạc và lốp", None, 1, 180000),
        ],
    )
    _, draft = await repair_for(
        "vios",
        "draft",
        [
            ("[DEMO] Thay dầu", "OIL", 4, 120000),
            ("[DEMO] Thay lọc dầu", "OIL-FILTER", 1, 60000),
        ],
    )
    _, completed = await repair_for(
        "accent",
        "completed",
        [
            ("[DEMO] Thay bộ má phanh", "BRAKE-PAD", 1, 250000),
            ("[DEMO] Kiểm tra hệ thống phanh", None, 1, 150000),
        ],
    )
    pending = await visit_for("city", "awaiting_approval")
    await quote(
        pending, "preliminary", [("[DEMO] Kiểm tra tiếng kêu", None, 1, 100000)]
    )
    await quote(
        pending, "final", [("[DEMO] Thay bộ gạt mưa", "WIPER", 1, 80000)], "pending", 2
    )
    intake = await visit_for("seltos", "intake", on)
    await quote(
        intake,
        "preliminary",
        [("[DEMO] Chẩn đoán điều hòa", None, 1, 200000)],
        "pending",
    )
    diagnosis = await visit_for("c200", "diagnosis")
    await quote(
        diagnosis, "preliminary", [("[DEMO] Kiểm tra bằng máy", None, 1, 300000)]
    )
    ready = await visit_for("vf5", "ready")
    await quote(ready, "preliminary", [("[DEMO] Kiểm tra ban đầu", None, 1, 100000)])
    await quote(
        ready,
        "final",
        [("[DEMO] Thay lọc cabin VF 5", "CABIN-VF5", 1, 100000)],
        "approved",
        2,
    )

    for index, status in enumerate(("pending", "confirmed", "cancelled")):
        await dataset.add(
            Booking,
            customerName=customer.fullName,
            phone="0900000106",
            service=(
                "Bảo dưỡng định kỳ",
                "Kiểm tra xe điện VinFast",
                "Kiểm tra điều hòa",
            )[index],
            note=f"{DEMO_NOTE} Lịch hẹn mẫu {index + 1}.",
            preferredDate=on + timedelta(days=index + 1),
            status=status,
            createdAt=stamp(on - timedelta(days=1)),
        )
    for index, status in enumerate(("submitted", "approved", "paid", "cancelled")):
        await dataset.add(
            Expense,
            category=("parts", "tools", "utilities", "other")[index],
            payee="Nhà cung cấp mẫu · DEMO",
            documentNumber=f"DEMO-EXP-{index + 1:03d}",
            amount=(2300000, 1750000, 850000, 420000)[index],
            note=DEMO_NOTE,
            status=status,
            createdBy=accountant.id,
            approvedBy=admin.id if status in ("approved", "paid") else None,
            approvedAt=stamp(on - timedelta(days=1))
            if status in ("approved", "paid")
            else None,
            paidBy=accountant.id if status == "paid" else None,
            paidAt=stamp(on) if status == "paid" else None,
            method="bank" if status == "paid" else None,
            reference="DEMO-EXP-BANK-001" if status == "paid" else None,
            createdAt=stamp(on - timedelta(days=2)),
        )
    for index, (visit, ticket) in enumerate(historical[-2:]):
        await dataset.add(
            ServiceFollowup,
            visitId=visit.id,
            outcome="satisfied" if index == 0 else "no_answer",
            rating=5 if index == 0 else None,
            note=f"{DEMO_NOTE} "
            + (
                "Khách mẫu hài lòng sau bàn giao."
                if index == 0
                else "Chưa liên hệ được, đã hẹn gọi lại."
            ),
            nextContactOn=None if index == 0 else on + timedelta(days=2),
            createdBy=advisor.id,
            createdAt=ticket.paidAt + timedelta(hours=1),
        )
    for key, component, days, odometer in (
        ("vf8", "cabin_filter", 300, 20000),
        ("vios", "engine_oil", 120, 30000),
        ("ranger", "engine_oil", 2, 80000),
    ):
        await dataset.add(
            MaintenanceRecord,
            vehicleId=vehicles[key].id,
            component=component,
            action="replace",
            performedOn=historical[-1][1].completedAt.date()
            if key == "ranger"
            else on - timedelta(days=days),
            odometer=odometer,
            ticketId=historical[-1][1].id if key == "ranger" else None,
            note=DEMO_NOTE,
            createdBy=advisor.id,
        )
    await scan_reminders(db, [v.id for v in vehicles.values()])
    reminders = (
        await db.scalars(
            select(MaintenanceReminder).where(
                MaintenanceReminder.vehicleId.in_([v.id for v in vehicles.values()])
            )
        )
    ).all()
    for index, reminder in enumerate(reminders):
        if index % 2 == 0:
            reminder.status = "published"
            reminder.publishedBy = advisor.id
            reminder.publishedAt = stamp(on)
        dataset.rows.append(reminder)
    for key, status, assigned in (
        ("vf8", "open", True),
        ("city", "open", False),
        ("ranger", "closed", True),
    ):
        conversation = await dataset.add(
            SupportConversation,
            customerId=customer.id,
            vehicleId=vehicles[key].id,
            advisorId=advisor.id if assigned else None,
            status=status,
            createdAt=stamp(on - timedelta(days=1)),
            updatedAt=stamp(on, 4),
        )
        messages = []
        lines = [
            (customer, "[DEMO] Tôi muốn hỏi tiến độ kiểm tra xe và chi phí dự kiến.")
        ]
        if assigned:
            lines.append(
                (
                    advisor,
                    "[DEMO] Garage đã tiếp nhận. Bạn có thể xem tiến độ và báo giá trong mục dịch vụ.",
                )
            )
        if key == "vf8":
            lines.append(
                (customer, "[DEMO] Cảm ơn cố vấn. Khi nào xe có thể bàn giao?")
            )
        for index, (sender, content) in enumerate(lines):
            messages.append(
                await dataset.add(
                    SupportMessage,
                    conversationId=conversation.id,
                    senderId=sender.id,
                    senderName=sender.fullName,
                    senderRole=sender.role,
                    content=content,
                    clientMessageId=str(
                        uuid5(NAMESPACE_URL, f"garagecar/demo/v1/{key}/{index}")
                    ),
                    createdAt=stamp(on, 3) + timedelta(minutes=index * 10),
                )
            )
        await dataset.add(
            SupportRead,
            conversationId=conversation.id,
            userId=customer.id,
            lastReadMessageId=messages[0].id,
        )
        if assigned:
            await dataset.add(
                SupportRead,
                conversationId=conversation.id,
                userId=advisor.id,
                lastReadMessageId=messages[0].id,
            )
    await db.flush()
    manifest = {
        "version": 1,
        "created": True,
        "anchorDate": on.isoformat(),
        "accounts": [
            {"role": role, "email": demo_email(role), "id": user.id}
            for role, user in users.items()
        ],
        "counts": dataset.counts(),
        "vehicles": {key: vehicle.id for key, vehicle in vehicles.items()},
        "scenarios": {
            "workingVisit": working.id,
            "draftTicket": draft.id,
            "paymentTicket": completed.id,
            "pendingQuoteVisit": pending.id,
            "intakeVisit": intake.id,
            "diagnosisVisit": diagnosis.id,
            "readyVisit": ready.id,
        },
        "warning": DEMO_NOTE,
    }
    db.add(
        SystemParameter(
            key=DEMO_MANIFEST_KEY, value=json.dumps(manifest, ensure_ascii=False)
        )
    )
    await db.flush()
    return manifest
