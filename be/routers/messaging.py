"""Authenticated support inbox; database locks serialize assignment and message retries."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, true
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from core.permissions import permissions
from core.response import success_response
from core.time import utcnow
from database.session import get_db
from middleware.auth import require_permission
from models import SupportConversation, SupportMessage, SupportRead, User, Vehicle
from schemas.messaging import (
    AssignInput,
    ConversationInput,
    MessageInput,
    ReadInput,
    StatusInput,
)

router = APIRouter(prefix="/api/messaging", tags=["Customer chat"])
chat_user = require_permission("messages")


def visible_threads(user):
    if user["role"] == "customer":
        return SupportConversation.customerId == user["id"]
    if user["role"] == "advisor":
        return or_(
            SupportConversation.advisorId.is_(None),
            SupportConversation.advisorId == user["id"],
        )
    if user["role"] == "admin":
        return true()
    raise HTTPException(403, "Bạn không có quyền vào hộp thư khách hàng")


def private_response(data, status=200):
    response = success_response(data, status_code=status)
    response.headers["Cache-Control"] = "private, no-store"
    return response


async def thread_access(db, conversation_id, user, lock=False):
    query = select(SupportConversation).where(
        SupportConversation.id == conversation_id, visible_threads(user)
    )
    if lock:
        query = query.with_for_update()
    conversation = await db.scalar(query)
    if not conversation:
        raise HTTPException(
            404, "Không tìm thấy hội thoại hoặc bạn không có quyền truy cập"
        )
    # Re-evaluate after waiting on a row lock; an advisor may have claimed the thread.
    if user["role"] == "advisor" and conversation.advisorId not in (None, user["id"]):
        raise HTTPException(404, "Hội thoại đang được cố vấn khác phụ trách")
    return conversation


def inbox_query(user):
    customer = aliased(User)
    advisor = aliased(User)
    read_id = (
        select(SupportRead.lastReadMessageId)
        .where(
            SupportRead.conversationId == SupportConversation.id,
            SupportRead.userId == user["id"],
        )
        .correlate(SupportConversation)
        .scalar_subquery()
    )
    unread = (
        select(func.count(SupportMessage.id))
        .where(
            SupportMessage.conversationId == SupportConversation.id,
            SupportMessage.senderId != user["id"],
            SupportMessage.id > func.coalesce(read_id, 0),
        )
        .correlate(SupportConversation)
        .scalar_subquery()
    )
    latest = (
        select(SupportMessage.content)
        .where(SupportMessage.conversationId == SupportConversation.id)
        .order_by(SupportMessage.id.desc())
        .limit(1)
        .correlate(SupportConversation)
        .scalar_subquery()
    )
    query = select(
        SupportConversation,
        customer.fullName,
        Vehicle.licensePlate,
        Vehicle.carBrand,
        Vehicle.carModel,
        advisor.fullName,
        unread.label("unread"),
        latest.label("preview"),
    )
    return (
        query.join(customer, customer.id == SupportConversation.customerId)
        .outerjoin(Vehicle, Vehicle.id == SupportConversation.vehicleId)
        .outerjoin(advisor, advisor.id == SupportConversation.advisorId)
        .where(visible_threads(user))
    )


def thread_dict(row):
    thread, customer, plate, brand, model, advisor, unread, preview = row
    return {
        "id": thread.id,
        "customerId": thread.customerId,
        "customerName": customer,
        "vehicleId": thread.vehicleId,
        "licensePlate": plate,
        "carBrand": brand,
        "carModel": model,
        "advisorId": thread.advisorId,
        "advisorName": advisor,
        "status": thread.status,
        "createdAt": thread.createdAt,
        "updatedAt": thread.updatedAt,
        "unreadCount": unread,
        "lastMessage": (preview or "")[:160],
    }


def message_dict(message):
    return {
        key: getattr(message, key)
        for key in (
            "id",
            "conversationId",
            "senderId",
            "senderName",
            "senderRole",
            "content",
            "clientMessageId",
            "createdAt",
        )
    }


@router.get("/conversations")
async def conversations(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(chat_user),
    q: str = Query(default="", max_length=100),
    offset: int = Query(default=0, ge=0),
):
    query = inbox_query(user)
    if q.strip():
        # Filter by known public labels; message bodies are not searched across customers.
        pattern = (
            "%"
            + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            + "%"
        )
        query = query.where(
            or_(
                query.column_descriptions[1]["expr"].ilike(pattern, escape="\\"),
                Vehicle.licensePlate.ilike(pattern, escape="\\"),
            )
        )
    rows = (
        await db.execute(
            query.order_by(
                SupportConversation.updatedAt.desc(), SupportConversation.id.desc()
            )
            .offset(offset)
            .limit(51)
        )
    ).all()
    counts = inbox_query(user).subquery()
    total_unread = await db.scalar(select(func.coalesce(func.sum(counts.c.unread), 0)))
    return private_response(
        {
            "items": [thread_dict(row) for row in rows[:50]],
            "hasMore": len(rows) > 50,
            "totalUnread": int(total_unread),
        }
    )


@router.post("/conversations")
async def create_conversation(
    body: ConversationInput,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(chat_user),
):
    if user["role"] != "customer":
        raise HTTPException(
            403, "Khách hàng bắt đầu hội thoại trong tài khoản của mình"
        )
    if body.vehicleId and not await db.scalar(
        select(Vehicle.id).where(
            Vehicle.id == body.vehicleId, Vehicle.customerId == user["id"]
        )
    ):
        raise HTTPException(404, "Không tìm thấy xe thuộc tài khoản của bạn")
    statement = (
        insert(SupportConversation)
        .values(
            customerId=user["id"],
            vehicleId=body.vehicleId,
            status="open",
            updatedAt=utcnow(),
        )
        .on_conflict_do_nothing()
    )
    await db.execute(statement)
    scope = (
        SupportConversation.vehicleId == body.vehicleId
        if body.vehicleId
        else SupportConversation.vehicleId.is_(None)
    )
    conversation_id = await db.scalar(
        select(SupportConversation.id).where(
            SupportConversation.customerId == user["id"], scope
        )
    )
    await db.commit()
    row = (
        await db.execute(
            inbox_query(user).where(SupportConversation.id == conversation_id)
        )
    ).one()
    return private_response(thread_dict(row), 201)


@router.get("/advisors")
async def advisors(db: AsyncSession = Depends(get_db), user: dict = Depends(chat_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Chỉ quản trị viên được phân công hộp thư")
    candidates = (
        await db.scalars(
            select(User).where(User.role == "advisor", User.isActive.is_(True))
        )
    ).all()
    return private_response(
        [
            {"id": person.id, "fullName": person.fullName}
            for person in candidates
            if "messages" in permissions(person.role, person.disabledPermissions)
        ]
    )


@router.get("/conversations/{conversation_id}/messages")
async def messages(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(chat_user),
    after: int | None = Query(default=None, gt=0),
    before: int | None = Query(default=None, gt=0),
):
    await thread_access(db, conversation_id, user)
    if after and before:
        raise HTTPException(422, "Chỉ dùng một mốc trước hoặc sau")
    query = select(SupportMessage).where(
        SupportMessage.conversationId == conversation_id
    )
    if after:
        query = query.where(SupportMessage.id > after).order_by(SupportMessage.id)
    else:
        if before:
            query = query.where(SupportMessage.id < before)
        query = query.order_by(SupportMessage.id.desc())
    rows = list((await db.scalars(query.limit(51))).all())
    more = len(rows) > 50
    rows = rows[:50]
    if not after:
        rows.reverse()
    customer_id = await db.scalar(
        select(SupportConversation.customerId).where(
            SupportConversation.id == conversation_id
        )
    )
    customer_read = await db.scalar(
        select(SupportRead.lastReadMessageId).where(
            SupportRead.conversationId == conversation_id,
            SupportRead.userId == customer_id,
        )
    )
    staff_read = await db.scalar(
        select(func.max(SupportRead.lastReadMessageId)).where(
            SupportRead.conversationId == conversation_id,
            SupportRead.userId != customer_id,
        )
    )
    conversation_row = (
        await db.execute(
            inbox_query(user).where(SupportConversation.id == conversation_id)
        )
    ).one()
    return private_response(
        {
            "conversation": thread_dict(conversation_row),
            "items": [message_dict(row) for row in rows],
            "hasMore": more,
            "customerReadId": customer_read or 0,
            "staffReadId": staff_read or 0,
        }
    )


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: int,
    body: MessageInput,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(chat_user),
):
    conversation = await thread_access(db, conversation_id, user, lock=True)
    retry_id = str(body.clientMessageId)
    old = await db.scalar(
        select(SupportMessage).where(
            SupportMessage.conversationId == conversation_id,
            SupportMessage.senderId == user["id"],
            SupportMessage.clientMessageId == retry_id,
        )
    )
    if old:
        if old.content != body.content:
            raise HTTPException(409, "Mã gửi lại đã được dùng cho nội dung khác")
        return private_response(message_dict(old))
    if user["role"] != "customer" and conversation.status == "closed":
        raise HTTPException(409, "Mở lại hội thoại trước khi trả lời")
    if user["role"] == "advisor" and conversation.advisorId is None:
        conversation.advisorId = user["id"]
    recent = await db.scalar(
        select(func.count(SupportMessage.id)).where(
            SupportMessage.senderId == user["id"],
            SupportMessage.createdAt >= utcnow() - timedelta(minutes=1),
        )
    )
    if recent >= 40:
        raise HTTPException(429, "Bạn gửi tin quá nhanh. Hãy chờ một lát.")
    message = SupportMessage(
        conversationId=conversation_id,
        senderId=user["id"],
        senderName=user["fullName"][:255],
        senderRole=user["role"],
        content=body.content,
        clientMessageId=retry_id,
    )
    db.add(message)
    conversation.status = "open"
    conversation.updatedAt = utcnow()
    await db.commit()
    await db.refresh(message)
    return private_response(message_dict(message), 201)


@router.post("/conversations/{conversation_id}/read")
async def mark_read(
    conversation_id: int,
    body: ReadInput,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(chat_user),
):
    await thread_access(db, conversation_id, user, lock=True)
    if not await db.scalar(
        select(SupportMessage.id).where(
            SupportMessage.id == body.throughMessageId,
            SupportMessage.conversationId == conversation_id,
        )
    ):
        raise HTTPException(404, "Mốc đã đọc không thuộc hội thoại này")
    statement = insert(SupportRead).values(
        conversationId=conversation_id,
        userId=user["id"],
        lastReadMessageId=body.throughMessageId,
        updatedAt=utcnow(),
    )
    await db.execute(
        statement.on_conflict_do_update(
            index_elements=[SupportRead.conversationId, SupportRead.userId],
            set_={
                "lastReadMessageId": func.greatest(
                    SupportRead.lastReadMessageId, statement.excluded.lastReadMessageId
                ),
                "updatedAt": utcnow(),
            },
        )
    )
    await db.commit()
    return private_response({"read": True})


@router.put("/conversations/{conversation_id}/assignment")
async def assign(
    conversation_id: int,
    body: AssignInput,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(chat_user),
):
    if user["role"] not in ("admin", "advisor"):
        raise HTTPException(403, "Khách hàng không được phân công cố vấn")
    conversation = await thread_access(db, conversation_id, user, lock=True)
    if user["role"] == "advisor" and (
        body.advisorId != user["id"] or conversation.advisorId not in (None, user["id"])
    ):
        raise HTTPException(403, "Cố vấn chỉ nhận hội thoại cho chính mình")
    if body.advisorId:
        person = await db.get(User, body.advisorId)
        if (
            not person
            or not person.isActive
            or person.role != "advisor"
            or "messages" not in permissions(person.role, person.disabledPermissions)
        ):
            raise HTTPException(
                400, "Cố vấn không hoạt động hoặc tính năng nhắn tin đã bị khóa"
            )
    conversation.advisorId = body.advisorId
    conversation.updatedAt = utcnow()
    await db.commit()
    return private_response({"advisorId": conversation.advisorId})


@router.put("/conversations/{conversation_id}/status")
async def change_status(
    conversation_id: int,
    body: StatusInput,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(chat_user),
):
    if user["role"] not in ("admin", "advisor"):
        raise HTTPException(403, "Chỉ garage được kết thúc hoặc mở lại hội thoại")
    conversation = await thread_access(db, conversation_id, user, lock=True)
    # An unassigned advisor must take responsibility before closing a customer's request.
    if user["role"] == "advisor" and conversation.advisorId is None:
        conversation.advisorId = user["id"]
    conversation.status = body.status
    conversation.updatedAt = utcnow()
    await db.commit()
    return private_response({"status": conversation.status})
