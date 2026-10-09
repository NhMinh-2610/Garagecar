import logging
from collections import deque
from time import monotonic

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.response import error_response, success_response
from database.session import get_db
from middleware.auth import get_current_user
from schemas.ai import (
    ChatRequest,
    CostEstimateRequest,
    DiagnoseRequest,
    MaintenanceAdviceRequest,
    SummarizeRepairRequest,
)
from services.ai_service import ai_service
from services.chat_context import build_chat_context

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])
logger = logging.getLogger(__name__)
_chat_requests = {}
_chat_active = set()


@router.get("/chat/info", summary="Chat provider and privacy information")
async def chat_info(_: dict = Depends(get_current_user)):
    return success_response(ai_service.chat_info())


@router.post(
    "/diagnose",
    summary="Diagnose vehicle issues from symptom description",
    response_model=None,
)
async def diagnose(
    body: DiagnoseRequest,
    _: dict = Depends(get_current_user),
):
    """
    Accepts a natural-language description of vehicle symptoms and returns
    possible root causes, recommended actions, urgency level, and cost estimate.
    Requires authentication (any role).
    """
    result = await ai_service.diagnose(body)
    return success_response(result.model_dump())


@router.post(
    "/estimate-cost",
    summary="Estimate repair costs for a list of tasks",
    response_model=None,
)
async def estimate_cost(
    body: CostEstimateRequest,
    _: dict = Depends(get_current_user),
):
    """
    Given a list of repair task names and an optional vehicle brand,
    returns a per-task cost breakdown and total estimate in VNĐ.
    """
    result = await ai_service.estimate_cost(body.tasks, body.carBrand)
    return success_response(result.model_dump())


@router.post(
    "/summarize-repair",
    summary="Generate a human-readable summary of a repair ticket",
    response_model=None,
)
async def summarize_repair(
    body: SummarizeRepairRequest,
    _: dict = Depends(get_current_user),
):
    """
    Converts a structured repair ticket (items, status, amounts) into a
    friendly Vietnamese paragraph suitable for customer communication.
    """
    ticket_data = body.model_dump()
    result = await ai_service.summarize_repair(ticket_data)
    return success_response(result.model_dump())


@router.post(
    "/maintenance-advice",
    summary="Get personalised maintenance schedule recommendations",
    response_model=None,
)
async def maintenance_advice(
    body: MaintenanceAdviceRequest,
    _: dict = Depends(get_current_user),
):
    """
    Based on vehicle make/model and current mileage, returns a prioritised
    maintenance checklist and the recommended next service interval.
    """
    result = await ai_service.maintenance_advice(
        car_brand=body.carBrand,
        car_model=body.carModel,
        mileage=body.mileage,
        last_service=body.lastServiceDate,
    )
    return success_response(result.model_dump())


@router.post(
    "/chat",
    summary="General-purpose automotive assistant chatbot",
    response_model=None,
)
async def chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Multi-turn conversation endpoint for general automotive Q&A.
    Maintains context via the messages array sent by the client.
    """
    context, sources = None, []
    if body.vehicleId:
        context, sources = await build_chat_context(
            db, body.vehicleId, user, body.messages[-1].content
        )
    now = monotonic()
    for key in list(_chat_requests):
        if not _chat_requests[key] or now - _chat_requests[key][-1] >= 60:
            del _chat_requests[key]
    recent = _chat_requests.setdefault(user["id"], deque())
    while recent and now - recent[0] >= 60:
        recent.popleft()
    if user["id"] in _chat_active or len(recent) >= 8 or len(_chat_active) >= 4:
        raise HTTPException(
            429, "AI đang bận hoặc bạn gửi quá nhanh. Hãy chờ một lát rồi thử lại."
        )
    recent.append(now)
    _chat_active.add(user["id"])
    try:
        result = await ai_service.chat(body.messages, context, sources)
        response = success_response(result.model_dump())
        response.headers["Cache-Control"] = "private, no-store"
        return response
    except (TimeoutError, httpx.TimeoutException):
        return error_response(
            "AI trả lời quá lâu. Hãy thử lại sau hoặc liên hệ cố vấn dịch vụ.", 504
        )
    except ValueError:
        return error_response(
            "AI chưa trả về câu trả lời. Hãy thử mô tả lại câu hỏi.", 502
        )
    except Exception as exc:
        # Do not log prompts, keys, provider payloads or URLs containing credentials.
        logger.warning("Chat provider failed: %s", type(exc).__name__)
        return error_response(
            "Chưa kết nối được AI. Garage cần kiểm tra model, API key hoặc dịch vụ LLM.",
            503,
        )
    finally:
        _chat_active.discard(user["id"])
