"""Explicit integration check against the disposable API/Nginx containers.

Set GARAGE_PROXY_URL and GARAGE_PROXY_DATABASE_URL to the test stack only.
This file is deliberately outside the default testpaths.
"""

import asyncio
import os
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


@pytest.mark.asyncio
async def test_nginx_overwrites_spoofed_forwarded_ip():
    url = os.environ["GARAGE_PROXY_URL"]
    engine = create_async_engine(os.environ["GARAGE_PROXY_DATABASE_URL"])
    try:
        async with engine.connect() as db:
            started = await db.scalar(text("SELECT now() AT TIME ZONE 'UTC'"))
        async with httpx.AsyncClient(base_url=url, timeout=10) as client:
            ready = False
            for _ in range(30):
                try:
                    ready = (await client.get("/api/health")).status_code == 200
                except httpx.HTTPError:
                    pass
                if ready:
                    break
                await asyncio.sleep(0.2)
            assert ready
            email = f"proxy-{uuid4().hex}@example.com"
            response = await client.post(
                "/api/auth/login",
                json={"email": email, "password": "wrong-password"},
                headers={
                    "X-Forwarded-For": "198.51.100.41",
                    "X-Real-IP": "198.51.100.42",
                },
            )
            assert response.status_code == 401
            assert "no-store" in response.headers["cache-control"]
        async with engine.connect() as db:
            assert (
                await db.scalar(
                    text(
                        "SELECT count(*) FROM login_attempts WHERE identifier=:identifier"
                    ),
                    {"identifier": "email:" + email},
                )
                == 1
            )
            ips = list(
                (
                    await db.scalars(
                        text(
                            "SELECT identifier FROM login_attempts WHERE identifier LIKE 'ip:%' AND attempted_at>=:started"
                        ),
                        {"started": started},
                    )
                ).all()
            )
            assert ips and "ip:unknown" not in ips
            assert "ip:198.51.100.41" not in ips and "ip:198.51.100.42" not in ips
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_nginx_rejects_public_registration_burst_before_hashing():
    async with httpx.AsyncClient(
        base_url=os.environ["GARAGE_PROXY_URL"], timeout=10
    ) as client:
        responses = await asyncio.gather(
            *[client.post("/api/auth/register", json={}) for _ in range(20)]
        )
    assert any(response.status_code == 429 for response in responses)
    assert all(response.status_code in (422, 429) for response in responses)
    for response in responses:
        if response.status_code == 429:
            assert response.json()["success"] is False
            assert response.headers["retry-after"] == "60"
