"""
core/security.py — Password hashing + JWT helpers
--------------------------------------------------
Password hashing:  Argon2id via argon2-cffi  (memory-hard, GPU-resistant)
JWT signing:       HS256 via python-jose

Backward-compat migration:
  Existing bcrypt hashes (prefix $2b$) are still verified via passlib bcrypt
  backend and auto-upgraded to Argon2id on the next successful login.
  Once all users have logged in at least once, passlib can be removed.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import anyio
import bcrypt
import jwt
from anyio.to_thread import run_sync
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from config.settings import settings

# ── Argon2id parameters (OWASP recommended minimums) ─────────────────────────
_ph = PasswordHasher(
    time_cost=3,        # iterations
    memory_cost=65536,  # 64 MB — makes GPU/ASIC brute-force very expensive
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

_BCRYPT_PREFIX = re.compile(r"^\$2[aby]\$")  # detect legacy bcrypt hashes


def hash_password(plain: str) -> str:
    """Hash a plain-text password with Argon2id."""
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify password against stored hash.
    Supports both Argon2id (new) and bcrypt (legacy) hashes transparently.
    Returns False on any mismatch — never raises to the caller.
    """
    if _BCRYPT_PREFIX.match(hashed):
        # Legacy bcrypt path — kept for backward compatibility
        try:
            # Legacy bcrypt compared the first 72 bytes, including UTF-8 passwords.
            return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("ascii"))
        except (ValueError, UnicodeError):
            return False

    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:
    """
    Returns True if the stored hash should be upgraded (bcrypt → Argon2id,
    or Argon2id params changed). Call this after a successful verify_password
    and re-hash + save if True.
    """
    if _BCRYPT_PREFIX.match(hashed):
        return True  # always upgrade bcrypt to Argon2id
    try:
        return _ph.check_needs_rehash(hashed)
    except Exception:
        return False


_password_limiter = anyio.CapacityLimiter(settings.password_workers)


async def async_hash_password(plain):
    return await run_sync(hash_password, plain, limiter=_password_limiter)


async def async_verify_password(plain, hashed):
    return await run_sync(verify_password, plain, hashed, limiter=_password_limiter)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.
    Default expiry: JWT_EXPIRE_HOURS from settings (typically 24h).
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=settings.jwt_expire_hours)
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.
    Raises jose.JWTError if token is invalid or expired.
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "id"]})
    if not isinstance(payload["id"], int) or isinstance(payload["id"], bool) or payload["id"] <= 0:
        raise jwt.InvalidTokenError("Invalid account identity")
    return payload
