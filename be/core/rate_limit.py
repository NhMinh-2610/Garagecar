"""
core/rate_limit.py — Brute-force protection for login endpoints
----------------------------------------------------------------
Strategy: progressive lockout per identifier (email or IP).
  - Window: 15 minutes
  - Threshold: 5 failed attempts → HTTP 429
  - No Redis required — uses the existing PostgreSQL database.
"""

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import utcnow
from models.login_attempt import LoginAttempt

_WINDOW    = timedelta(minutes=15)
_MAX_FAILS = 5


async def check_rate_limit(db: AsyncSession, identifier: str) -> None:
    """
    Raise HTTP 429 if *identifier* has >= _MAX_FAILS failed attempts
    within the last _WINDOW minutes.

    Call this BEFORE verifying credentials so the attacker gets no
    useful feedback when they are already locked out.
    """
    since = utcnow() - _WINDOW
    fail_count: int = await db.scalar(
        select(func.count()).where(
            LoginAttempt.identifier == identifier,
            LoginAttempt.success == False,        # noqa: E712
            LoginAttempt.attempted_at >= since,
        )
    )
    if (fail_count or 0) >= _MAX_FAILS:
        raise HTTPException(
            429,
            f"Quá nhiều lần thử sai. Vui lòng đợi {int(_WINDOW.seconds / 60)} phút rồi thử lại.",
        )


async def record_attempt(db: AsyncSession, identifier: str, success: bool) -> None:
    """Append one attempt row. Commits nothing — caller must commit."""
    db.add(LoginAttempt(identifier=identifier, success=success))
