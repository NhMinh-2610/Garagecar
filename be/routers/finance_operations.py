"""Recorded receipts and controlled expenses, separate from workshop data."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.response import success_response
from core.serialization import serialize_columns
from core.time import utcnow
from database.session import get_db
from middleware.auth import require_permission
from models import Expense, PaymentReceipt
from schemas.professional import ExpenseInput, PaymentInput

router = APIRouter(prefix="/api/finance", tags=["Accounting operations"])


async def _lock_expense(db, expense_id):
    expense = await db.scalar(
        select(Expense).where(Expense.id == expense_id).with_for_update()
    )
    if expense is None:
        raise HTTPException(404, "Không tìm thấy đề nghị")
    return expense


@router.get("/receipts")
async def receipts(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("finance"))
):
    rows = (
        await db.scalars(
            select(PaymentReceipt).order_by(PaymentReceipt.id.desc()).limit(1000)
        )
    ).all()
    return success_response([serialize_columns(r) for r in rows])


@router.get("/expenses")
async def expenses(
    db: AsyncSession = Depends(get_db), user=Depends(require_permission("finance"))
):
    return success_response(
        [
            serialize_columns(r)
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
    expense = Expense(**body.model_dump(), createdBy=user["id"])
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return success_response(serialize_columns(expense), "Đã gửi đề nghị chi", 201)


@router.post("/expenses/{expense_id}/approve")
async def approve(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("finance")),
):
    if user["role"] != "admin":
        raise HTTPException(403, "Đề nghị chi cần quản trị duyệt")
    expense = await _lock_expense(db, expense_id)
    if expense.createdBy == user["id"]:
        raise HTTPException(409, "Người lập không được tự duyệt đề nghị chi")
    if expense.status != "submitted":
        raise HTTPException(409, "Đề nghị không còn chờ duyệt")
    expense.status, expense.approvedBy, expense.approvedAt = (
        "approved",
        user["id"],
        utcnow(),
    )
    await db.commit()
    return success_response(serialize_columns(expense), "Đã duyệt chi")


@router.post("/expenses/{expense_id}/pay")
async def pay(
    expense_id: int,
    body: PaymentInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("finance")),
):
    expense = await _lock_expense(db, expense_id)
    if expense.status != "approved":
        raise HTTPException(
            409, "Chỉ chi tiền sau khi được duyệt; không được chi lần hai"
        )
    expense.status, expense.paidBy, expense.paidAt = "paid", user["id"], utcnow()
    expense.method, expense.reference = body.method, body.reference
    await db.commit()
    return success_response(serialize_columns(expense), "Đã ghi chi tiền")


@router.post("/expenses/{expense_id}/cancel")
async def cancel(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("finance")),
):
    expense = await _lock_expense(db, expense_id)
    if expense.status != "submitted" or (
        expense.createdBy != user["id"] and user["role"] != "admin"
    ):
        raise HTTPException(
            409, "Chỉ hủy đề nghị chưa duyệt của mình hoặc bởi quản trị"
        )
    expense.status = "cancelled"
    await db.commit()
    return success_response(None, "Đã hủy đề nghị")
