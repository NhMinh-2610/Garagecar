"""Phạm vi năm vai trò, không AI và chuyển đổi tài khoản nhân sự cũ."""

import importlib.util
from datetime import date
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from main import app
from sqlalchemy import text
from test_workflow import api as api

from core.permissions import ROLE_PERMISSIONS
from core.security import create_access_token, hash_password
from models import EmployeeProfile, User


@pytest.mark.asyncio
async def test_five_roles_no_ai_and_admin_hr_permissions(api):
    client, auth, ids, factory, _ = api
    assert set(ROLE_PERMISSIONS) == {
        "admin",
        "advisor",
        "accountant",
        "mechanic",
        "customer",
    }
    assert not any(route.path.startswith("/api/ai") for route in app.routes)
    for path in ("/hr", "/hr/", "/hr/index.html", "/static/hr/index.html"):
        response = await client.get(path, follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == "/admin"
    assert (
        await client.post("/api/ai/chat", headers=auth("customer"), json={})
    ).status_code == 404
    assert (
        await client.get("/api/hr/operations", headers=auth("admin"))
    ).status_code == 200
    body = dict(
        username="oldhr",
        email="oldhr@example.com",
        fullName="Old HR",
        password="secret123",
        role="hr",
    )
    assert (
        await client.post("/api/auth/users", headers=auth("admin"), json=body)
    ).status_code == 422
    assert (
        await client.post("/api/auth/register-staff", headers=auth("admin"), json=body)
    ).status_code == 400
    async with factory() as db:
        admin = await db.get(User, ids["admin"])
        admin.disabledPermissions = ["hr"]
        await db.commit()
    assert (
        await client.get("/api/service/employees", headers=auth("admin"))
    ).status_code == 403
    assert (
        await client.get("/api/auth/users", headers=auth("admin"))
    ).status_code == 200


@pytest.mark.asyncio
async def test_legacy_hr_migration_preserves_records_without_granting_admin_access(api):
    client, auth, ids, factory, engine = api
    async with factory() as db:
        users = [
            User(
                username=f"legacy{active}",
                email=f"legacy{active}@example.com",
                fullName="Legacy HR",
                role="hr",
                password=hash_password("secret123"),
                isActive=active,
                sessionVersion=4,
                disabledPermissions=["hr"] if not active else [],
            )
            for active in (True, False)
        ]
        db.add_all(users)
        await db.flush()
        legacy_ids = [user.id for user in users]
        db.add(
            EmployeeProfile(
                userId=legacy_ids[0],
                department="HR",
                jobTitle="HR manager",
                startDate=date(2026, 1, 1),
                updatedBy=ids["admin"],
            )
        )
        await db.commit()
    token = {
        "Authorization": "Bearer "
        + create_access_token({"id": legacy_ids[0], "version": 4})
    }
    assert (await client.get("/api/auth/me", headers=token)).status_code == 401

    def run_migration(connection):
        # Fixture already created an empty audit table; reconstruct the pre-008 state.
        connection.execute(text("DROP TABLE legacy_hr_role_migration"))
        path = Path(__file__).parents[1] / "migrations/versions/008_merge_hr_role.py"
        spec = importlib.util.spec_from_file_location("merge_hr", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()

    async with engine.begin() as connection:
        await connection.run_sync(run_migration)
    async with factory() as db:
        for user_id in legacy_ids:
            user = await db.get(User, user_id)
            assert user.role == "admin" and not user.isActive
            assert user.sessionVersion == 5
            assert set(user.disabledPermissions) == ROLE_PERMISSIONS["admin"]
        assert (await db.get(EmployeeProfile, legacy_ids[0])).department == "HR"
        admin = await db.get(User, ids["admin"])
        assert admin.isActive and admin.disabledPermissions == []
        rows = (
            (
                await db.execute(
                    text('SELECT * FROM legacy_hr_role_migration ORDER BY "userId"')
                )
            )
            .mappings()
            .all()
        )
        assert [row["wasActive"] for row in rows] == [True, False]
        assert [row["disabledPermissions"] for row in rows] == [[], ["hr"]]
    assert (await client.get("/api/auth/me", headers=token)).status_code == 401
    assert (
        await client.post(
            "/api/auth/login",
            json={"email": "legacyTrue@example.com", "password": "secret123"},
        )
    ).status_code == 401
    # Mở lại tài khoản không làm token cũ sống lại hoặc tự mở các quyền bị khóa.
    async with factory() as db:
        migrated = await db.get(User, legacy_ids[0])
        migrated.isActive = True
        await db.commit()
    assert (await client.get("/api/auth/me", headers=token)).status_code == 401
    fresh = {
        "Authorization": "Bearer "
        + create_access_token({"id": legacy_ids[0], "version": 5})
    }
    assert (await client.get("/api/auth/me", headers=fresh)).status_code == 200
    assert (
        await client.get("/api/service/employees", headers=fresh)
    ).status_code == 403
    assert (
        await client.get("/api/hr/operations", headers=auth("admin"))
    ).status_code == 200
