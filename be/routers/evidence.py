"""Private photos: no static URL, client filename or token in URL."""

import hashlib

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer
from starlette.concurrency import run_in_threadpool

from core.response import success_response
from database.session import get_db
from middleware.auth import get_current_user
from models import Inventory, RepairEvidence, RepairTicket
from schemas.professional import EvidenceInput
from services.evidence_service import (
    check_ev_certificate,
    evidence_metadata,
    sanitize_image,
)
from services.repair_service import authorize_ticket, lock_ticket

router = APIRouter(prefix="/api/workshop", tags=["Workshop evidence"])


async def access(db, ticket, user, write=False):
    if not ticket:
        raise HTTPException(404, "Không tìm thấy phiếu")
    if write:
        if (
            user["role"] not in ("admin", "mechanic")
            or "workshop" not in user["permissions"]
        ):
            raise HTTPException(
                403, "Chỉ thợ phụ trách hoặc quản trị có quyền xưởng được gửi ảnh"
            )
        await authorize_ticket(db, ticket, user)
        if ticket.status != "working":
            raise HTTPException(409, "Chỉ gửi ảnh khi phiếu đang sửa")
    elif user["role"] == "customer":
        if ticket.vehicle.customerId != user["id"]:
            raise HTTPException(403, "Ảnh không thuộc xe của bạn")
    elif user["role"] == "advisor" and "workshop" in user["permissions"]:
        return
    elif user["role"] in ("admin", "mechanic") and "workshop" in user["permissions"]:
        await authorize_ticket(db, ticket, user)
    else:
        raise HTTPException(403, "Không có quyền xem bằng chứng sửa chữa")


@router.get("/tickets/{ticket_id}/evidence")
async def list_evidence(
    ticket_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    ticket = await db.get(RepairTicket, ticket_id)
    await access(db, ticket, user)
    ids = [item.id for item in ticket.items]
    rows = (
        await db.scalars(
            select(RepairEvidence)
            .options(defer(RepairEvidence.image))
            .where(RepairEvidence.itemId.in_(ids))
            .order_by(RepairEvidence.id.desc())
        )
    ).all()
    return success_response([evidence_metadata(r) for r in rows])


@router.post("/tickets/{ticket_id}/items/{item_id}/evidence")
async def upload(
    ticket_id: int,
    item_id: int,
    body: EvidenceInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    ticket = await lock_ticket(db, ticket_id)
    await access(db, ticket, user, write=True)
    item = next((i for i in ticket.items if i.id == item_id), None)
    if not item:
        raise HTTPException(404, "Không tìm thấy hạng mục")
    if item.isCompleted:
        raise HTTPException(409, "Mở lại hạng mục trước khi gửi bằng chứng mới")
    count = len(
        (
            await db.scalars(
                select(RepairEvidence.id).where(
                    RepairEvidence.itemId == item_id,
                    RepairEvidence.round == item.evidenceRound,
                )
            )
        ).all()
    )
    if count >= 12:
        raise HTTPException(409, "Mỗi lần thực hiện lưu tối đa 12 ảnh")
    stock = (
        await db.scalar(
            select(Inventory).where(Inventory.id == item.inventoryId).with_for_update()
        )
        if item.inventoryId
        else None
    )
    await check_ev_certificate(db, user, stock)
    expected = item.partCode or (stock.sku if stock else None)
    if body.kind == "package":
        if not stock or not expected:
            raise HTTPException(
                409,
                "Quản trị cần khai báo mã SKU thật cho vật tư trước khi xác nhận bao bì",
            )
        if (body.productCode or "").strip().upper() not in {
            expected.upper(),
            (stock.barcode or "").upper(),
        }:
            raise HTTPException(
                409, "Mã trên bao bì không trùng SKU hoặc mã vạch đã khai báo"
            )
        if not body.productCode or not body.productCode.strip():
            raise HTTPException(422, "Cần nhập mã trên bao bì")
        if item.partCode is None:
            item.partCode = expected
    image = await run_in_threadpool(sanitize_image, body.image)
    row = RepairEvidence(
        itemId=item.id,
        round=item.evidenceRound,
        kind=body.kind,
        productCode=body.productCode.strip().upper() if body.productCode else None,
        expectedCode=expected if body.kind == "package" else None,
        lotNumber=body.lotNumber,
        note=body.note,
        image=image,
        sha256=hashlib.sha256(image).hexdigest(),
        createdBy=user["id"],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(evidence_metadata(row), "Đã lưu bằng chứng", 201)


@router.get("/evidence/{evidence_id}/image")
async def photo(
    evidence_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    from models import RepairItem

    row = await db.get(RepairEvidence, evidence_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy ảnh")
    item = await db.get(RepairItem, row.itemId)
    await access(db, await db.get(RepairTicket, item.repairTicketId), user)
    return Response(
        row.image,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
