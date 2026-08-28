"""
AI Service — adapter pattern for LLM providers.

Supported providers (configured via .env AI_PROVIDER):
  - mock    : Rule-based mock responses (default, no API key required)
  - openai  : OpenAI Chat Completions API (gpt-4o-mini by default)
  - gemini  : Google Generative AI (gemini-1.5-flash by default)
  - ollama  : Self-hosted Ollama server (llama3.2 by default)

All providers implement the same BaseAIProvider interface so they are
interchangeable without changing router code.
"""

from __future__ import annotations

import asyncio
import json
import re
from abc import ABC, abstractmethod
from typing import Any

import httpx

from config.settings import settings
from schemas.ai import (
    ChatMessage,
    ChatResponse,
    CostEstimateResponse,
    DiagnoseRequest,
    DiagnoseResponse,
    MaintenanceAdviceResponse,
    SummarizeResponse,
)


# ── Base provider ──────────────────────────────────────────────────────────────

class BaseAIProvider(ABC):
    """Abstract base for all LLM providers."""

    @abstractmethod
    async def complete(self, system_prompt: str, user_message: str) -> str:
        """Send a single-turn completion request and return the response text."""


# ── Mock provider ──────────────────────────────────────────────────────────────

class MockProvider(BaseAIProvider):
    """
    Deterministic mock provider — no external API calls.
    Returns realistic Vietnamese automotive responses for demo / portfolio purposes.
    """

    async def complete(self, system_prompt: str, user_message: str) -> str:
        msg = user_message.lower()

        # Diagnose keywords
        if any(k in msg for k in ["triệu chứng", "symptoms", "diagnos"]):
            return json.dumps({
                "possibleCauses": [
                    "Bugi bị mòn hoặc hỏng",
                    "Bộ lọc không khí bẩn",
                    "Hệ thống đánh lửa có vấn đề",
                ],
                "recommendedActions": [
                    "Kiểm tra và thay bugi nếu cần",
                    "Vệ sinh hoặc thay lọc gió",
                    "Đưa xe đến garage để kiểm tra hệ thống đánh lửa",
                ],
                "urgencyLevel": "medium",
                "estimatedCost": "500,000 - 2,000,000 VNĐ",
                "disclaimer": "Đây là chẩn đoán sơ bộ. Vui lòng đến garage để kiểm tra chính xác.",
            })

        # Cost estimate
        if any(k in msg for k in ["cost", "estimate", "ước tính", "chi phí"]):
            return json.dumps({
                "breakdown": [
                    {"task": "Thay dầu động cơ", "estimatedCost": "300,000 - 500,000 VNĐ"},
                    {"task": "Thay lọc dầu", "estimatedCost": "80,000 - 150,000 VNĐ"},
                ],
                "totalEstimate": "380,000 - 650,000 VNĐ",
                "notes": "Giá có thể thay đổi tuỳ theo loại xe và nhà cung cấp phụ tùng.",
            })

        # Summarize repair
        if any(k in msg for k in ["summar", "tóm tắt", "phiếu"]):
            return (
                "Xe đã được tiếp nhận và thực hiện các hạng mục sửa chữa theo yêu cầu. "
                "Thợ kỹ thuật đã hoàn thành kiểm tra, thay thế phụ tùng cần thiết và chạy thử xe. "
                "Tình trạng xe hiện tại ổn định, sẵn sàng bàn giao cho khách hàng."
            )

        # Maintenance advice
        if any(k in msg for k in ["maintenance", "bảo dưỡng", "định kỳ"]):
            return json.dumps({
                "recommendations": [
                    "Thay dầu động cơ mỗi 5,000 km hoặc 6 tháng",
                    "Kiểm tra áp suất lốp hàng tháng",
                    "Thay lọc gió mỗi 15,000 km",
                    "Kiểm tra dầu phanh và dầu trợ lực mỗi 20,000 km",
                    "Thay bugi mỗi 30,000 km",
                ],
                "nextServiceMileage": 5000,
                "notes": "Lịch bảo dưỡng dựa trên tiêu chuẩn của nhà sản xuất.",
            })

        # Generic chat
        return (
            "Tôi là trợ lý AI của GarageCar, chuyên hỗ trợ tư vấn kỹ thuật ô tô. "
            "Bạn có thể hỏi tôi về chẩn đoán lỗi, chi phí sửa chữa, hoặc lịch bảo dưỡng định kỳ."
        )


# ── OpenAI provider ────────────────────────────────────────────────────────────

class OpenAIProvider(BaseAIProvider):
    """OpenAI Chat Completions — uses the official openai Python SDK."""

    def __init__(self) -> None:
        try:
            from openai import AsyncOpenAI  # type: ignore
            self._client = AsyncOpenAI(api_key=settings.openai_api_key)
            self._model = settings.openai_model
        except ImportError as exc:
            raise RuntimeError("openai package not installed. Run: pip install openai") from exc

    async def complete(self, system_prompt: str, user_message: str) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content or ""


# ── Gemini provider ────────────────────────────────────────────────────────────

class GeminiProvider(BaseAIProvider):
    """Google Gemini via google-generativeai SDK."""

    def __init__(self) -> None:
        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=settings.gemini_api_key)
            self._model = genai.GenerativeModel(settings.gemini_model)
        except ImportError as exc:
            raise RuntimeError("google-generativeai not installed. Run: pip install google-generativeai") from exc

    async def complete(self, system_prompt: str, user_message: str) -> str:
        prompt = f"{system_prompt}\n\n{user_message}"
        # generate_content is a blocking call — run in a thread pool to avoid
        # blocking the FastAPI async event loop.
        response = await asyncio.to_thread(self._model.generate_content, prompt)
        return response.text or ""


# ── Ollama provider ────────────────────────────────────────────────────────────

class OllamaProvider(BaseAIProvider):
    """Self-hosted Ollama via REST API (no extra SDK required)."""

    def __init__(self) -> None:
        self._base_url = settings.ollama_base_url.rstrip("/")
        self._model = settings.ollama_model

    async def complete(self, system_prompt: str, user_message: str) -> str:
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{self._base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")


# ── AI Service ─────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "Bạn là chuyên gia kỹ thuật ô tô của GarageCar — một garage sửa chữa chuyên nghiệp tại Việt Nam. "
    "Hãy trả lời ngắn gọn, chính xác, bằng tiếng Việt. "
    "Khi trả lời dạng JSON, chỉ trả về JSON thuần, không thêm markdown code block."
)


class AIService:
    """
    High-level AI service. Delegates to the configured provider and
    parses raw LLM text into typed Pydantic response models.
    """

    def __init__(self) -> None:
        provider = settings.ai_provider.lower()
        if provider == "openai" and settings.openai_api_key:
            self._provider: BaseAIProvider = OpenAIProvider()
        elif provider == "gemini" and settings.gemini_api_key:
            self._provider = GeminiProvider()
        elif provider == "ollama":
            self._provider = OllamaProvider()
        else:
            self._provider = MockProvider()

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_json(text: str) -> Any:
        """Strip markdown fences if present, then parse JSON."""
        cleaned = re.sub(r"```(?:json)?", "", text).strip().strip("`")
        return json.loads(cleaned)

    async def _ask(self, user_message: str) -> str:
        return await self._provider.complete(_SYSTEM_PROMPT, user_message)

    # ── public methods ────────────────────────────────────────────────────────

    async def diagnose(self, req: DiagnoseRequest) -> DiagnoseResponse:
        prompt = (
            f"Triệu chứng xe: {req.symptoms}. "
            f"Xe: {req.carBrand or 'Không rõ'} {req.carModel or ''}. "
            f"Số km: {req.mileage or 'Không rõ'}. "
            "Hãy chẩn đoán và trả về JSON với các trường: "
            "possibleCauses (list[str]), recommendedActions (list[str]), "
            "urgencyLevel (low|medium|high|critical), estimatedCost (str), disclaimer (str)."
        )
        raw = await self._ask(prompt)
        try:
            data = self._parse_json(raw)
            return DiagnoseResponse(**data)
        except Exception:
            return DiagnoseResponse(
                possibleCauses=["Không xác định được nguyên nhân"],
                recommendedActions=["Đưa xe đến garage để kiểm tra trực tiếp"],
                urgencyLevel="medium",
                disclaimer="Vui lòng đến garage để kiểm tra chính xác.",
            )

    async def estimate_cost(self, tasks: list[str], car_brand: str | None) -> CostEstimateResponse:
        prompt = (
            f"Các hạng mục sửa chữa: {', '.join(tasks)}. "
            f"Loại xe: {car_brand or 'phổ thông'}. "
            "Ước tính chi phí từng hạng mục và tổng cộng. "
            "Trả về JSON: breakdown (list[{{task, estimatedCost}}]), totalEstimate (str), notes (str)."
        )
        raw = await self._ask(prompt)
        try:
            data = self._parse_json(raw)
            return CostEstimateResponse(**data)
        except Exception:
            return CostEstimateResponse(
                breakdown=[{"task": t, "estimatedCost": "Liên hệ garage"} for t in tasks],
                totalEstimate="Liên hệ garage để báo giá chính xác",
                notes="Chi phí phụ thuộc vào tình trạng thực tế của xe.",
            )

    async def summarize_repair(self, ticket_data: dict) -> SummarizeResponse:
        prompt = (
            f"Tóm tắt phiếu sửa chữa sau bằng ngôn ngữ tự nhiên, thân thiện:\n"
            f"{json.dumps(ticket_data, ensure_ascii=False, indent=2)}"
        )
        raw = await self._ask(prompt)
        return SummarizeResponse(summary=raw.strip())

    async def maintenance_advice(
        self, car_brand: str, car_model: str | None, mileage: int, last_service: str | None
    ) -> MaintenanceAdviceResponse:
        prompt = (
            f"Xe: {car_brand} {car_model or ''}. Số km hiện tại: {mileage:,}. "
            f"Lần bảo dưỡng gần nhất: {last_service or 'Không rõ'}. "
            "Đưa ra lịch bảo dưỡng định kỳ. "
            "Trả về JSON: recommendations (list[str]), nextServiceMileage (int|null), notes (str)."
        )
        raw = await self._ask(prompt)
        try:
            data = self._parse_json(raw)
            return MaintenanceAdviceResponse(**data)
        except Exception:
            return MaintenanceAdviceResponse(
                recommendations=["Thay dầu động cơ mỗi 5,000 km", "Kiểm tra lốp hàng tháng"],
                nextServiceMileage=mileage + 5000,
                notes="Tham khảo sổ tay bảo dưỡng của nhà sản xuất.",
            )

    async def chat(self, messages: list[ChatMessage]) -> ChatResponse:
        # Build conversation context
        conversation = "\n".join(f"{m.role.upper()}: {m.content}" for m in messages)
        raw = await self._ask(conversation)
        return ChatResponse(reply=raw.strip())


# Singleton — imported by the router
ai_service = AIService()
