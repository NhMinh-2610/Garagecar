"""Recorded receipts and controlled expenses, separate from workshop data."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.response import success_response
from core.time import utcnow
from database.session import get_db
from middleware.auth import require_permission
from models import Expense, PaymentReceipt
from schemas.professional import ExpenseInput, PaymentInput
from services.maintenance_service import row_dict

router = APIRouter(prefix="/api/finance", tags=["Accounting operations"])


@router.get("/receipts")
async def receipts(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("finance"))
):
    rows = (
        await db.scalars(
            select(PaymentReceipt).order_by(PaymentReceipt.id.desc()).limit(1000)
        )
    ).all()
    return success_response([row_dict(r) for r in rows])


@router.get("/expenses")
async def expenses(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("finance"))
):
    return success_response(
        [
            row_dict(r)
            for r in (
                await db.scalars(
                    select(Expense).order_by(Expense.id.desc()).limit(1000)
                )
            ).all()
        ]
    )


@router.post("/expenses")
async def create_expense(
    body: ExpenseInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("finance")),
):
    row = Expense(**body.model_dump(), createdBy=user["id"])
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(row_dict(row), "Đã gửi đề nghị chi", 201)


@router.post("/expenses/{expense_id}/approve")
async def approve(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("finance")),
):
    if user["role"] != "admin":
        raise HTTPException(403, "Đề nghị chi cần quản trị duyệt")
    row = await db.scalar(
        select(Expense).where(Expense.id == expense_id).with_for_update()
    )
    if not row:
        raise HTTPException(404, "Không tìm thấy đề nghị")
    if row.createdBy == user["id"]:
        raise HTTPException(409, "Người lập không được tự duyệt đề nghị chi")
    if row.status != "submitted":
        raise HTTPException(409, "Đề nghị không còn chờ duyệt")
    row.status, row.approvedBy, row.approvedAt = "approved", user["id"], utcnow()
    await db.commit()
    return success_response(row_dict(row), "Đã duyệt chi")


@router.post("/expenses/{expense_id}/pay")
async def pay(
    expense_id: int,
    body: PaymentInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("finance")),
):
    row = await db.scalar(
        select(Expense).where(Expense.id == expense_id).with_for_update()
    )
    if not row:
        raise HTTPException(404, "Không tìm thấy đề nghị")
    if row.status != "approved":
        raise HTTPException(
            409, "Chỉ chi tiền sau khi được duyệt; không được chi lần hai"
        )
    row.status, row.paidBy, row.paidAt = "paid", user["id"], utcnow()
    row.method, row.reference = body.method, body.reference
    await db.commit()
    return success_response(row_dict(row), "Đã ghi chi tiền")


@router.post("/expenses/{expense_id}/cancel")
async def cancel(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("finance")),
):
    row = await db.scalar(
        select(Expense).where(Expense.id == expense_id).with_for_update()
    )
    if not row:
        raise HTTPException(404, "Không tìm thấy đề nghị")
    if row.status != "submitted" or (
        row.createdBy != user["id"] and user["role"] != "admin"
    ):
        raise HTTPException(
            409, "Chỉ hủy đề nghị chưa duyệt của mình hoặc bởi quản trị"
        )
    row.status = "cancelled"
    await db.commit()
    return success_response(None, "Đã hủy đề nghị")
