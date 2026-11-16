"""
core/rate_limit.py — Brute-force protection for login endpoints
----------------------------------------------------------------
Strategy: progressive lockout per identifier (email or IP).
  - Window: 15 minutes
  - Threshold: 5 failed attempts → HTTP 429
  - No Redis required — uses the existing PostgreSQL database.
"""

import hashlib
from datetime import timedelta

from fastapi import HTTPException
from models.login_attempt import LoginAttempt
from models.request_control import RequestBudget
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import utcnow

_WINDOW    = timedelta(minutes=15)
_MAX_FAILS = 5


async def check_rate_limit(db: AsyncSession, identifier: str) -> None:
    """
    Raise HTTP 429 if *identifier* has >= _MAX_FAILS failed attempts
    within the last _WINDOW minutes.

    Call this BEFORE verifying credentials so the attacker gets no
    useful feedback when they are already locked out.
    """
    if identifier.startswith("email:"):
        # Keep the failed-password check and its eventual record in one lock scope.
        await db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": identifier})
    since = utcnow() - _WINDOW
    fail_count: int = await db.scalar(
        select(func.count()).where(
            LoginAttempt.identifier == identifier,
            LoginAttempt.success == False,        # noqa: E712
            LoginAttempt.attempted_at >= since,
        )
    )
    threshold = 100 if identifier.startswith("ip:") else _MAX_FAILS
    if (fail_count or 0) >= threshold:
        raise HTTPException(
            429,
            f"Quá nhiều lần thử sai. Vui lòng đợi {int(_WINDOW.seconds / 60)} phút rồi thử lại.",
        )


async def record_attempt(db: AsyncSession, identifier: str, success: bool) -> None:
    """Append one attempt row. Commits nothing — caller must commit."""
    db.add(LoginAttempt(identifier=identifier, success=success))


async def request_budget(db, request, scope, limit, seconds=60):
    """Atomic pre-work budget, committed even when the request is rejected."""
    ip = request.client.host if request.client else "unknown"
    identifier = scope + ":" + hashlib.sha256(ip.encode()).hexdigest()
    now = utcnow()
    start = now - timedelta(seconds=int(now.timestamp()) % seconds, microseconds=now.microsecond)
    statement = insert(RequestBudget).values(identifier=identifier, windowStart=start, count=1)
    used = await db.scalar(statement.on_conflict_do_update(
        index_elements=[RequestBudget.identifier, RequestBudget.windowStart],
        set_={"count": func.least(RequestBudget.count + 1, limit + 1)},
    ).returning(RequestBudget.count))
    await db.commit()
    if used > limit:
        raise HTTPException(429, "Gửi yêu cầu quá nhanh. Vui lòng thử lại sau.", headers={"Retry-After": str(seconds)})
