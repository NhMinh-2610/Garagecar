from fastapi import APIRouter, Depends

from schemas.ai import (
    DiagnoseRequest,
    DiagnoseResponse,
    CostEstimateRequest,
    CostEstimateResponse,
    SummarizeRepairRequest,
    SummarizeResponse,
    MaintenanceAdviceRequest,
    MaintenanceAdviceResponse,
    ChatRequest,
    ChatResponse,
)
from services.ai_service import ai_service
from core.response import success_response
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


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
    _: dict = Depends(get_current_user),
):
    """
    Multi-turn conversation endpoint for general automotive Q&A.
    Maintains context via the messages array sent by the client.
    """
    result = await ai_service.chat(body.messages)
    return success_response(result.model_dump())
