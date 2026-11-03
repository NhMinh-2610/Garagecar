"""Các hành vi dễ bị đổi ngoài ý muốn khi tổ chức lại code dùng chung."""

from datetime import date
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from middleware.auth import _request_permission
from schemas.auth import PasswordReset, RegisterRequest
from services.maintenance_service import calculate_due


def test_maintenance_history_keeps_action_scope_and_stable_ties():
    care = SimpleNamespace(
        firstUseDate=date(2024, 1, 1),
        observedOn=date(2026, 1, 1),
        odometer=10000,
    )
    rule = dict(
        component="engine_oil",
        action="replace",
        firstKm=10000,
        firstMonths=12,
        repeatKm=5000,
        repeatMonths=6,
    )

    def record(identifier, action="replace", day=date(2025, 3, 1), km=3000):
        return SimpleNamespace(
            id=identifier,
            component="engine_oil",
            action=action,
            performedOn=day,
            odometer=km,
        )

    records = [
        record(999, day=date(2025, 1, 1)),
        record(3),
        record(4),
        record(1000, action="inspect", day=date(2026, 1, 1), km=9000),
    ]
    result = calculate_due(care, [rule], records, on=date(2026, 1, 1))[0]
    assert (result["lastRecordId"], result["dueKm"], result["dueDate"]) == (
        4,
        8000,
        "2025-09-01",
    )
    # ID None và 0 có cùng thứ tự như cách sort cũ; bản cuối cùng vẫn thắng.
    for identifiers in ((None, 0), (0, None)):
        tied = calculate_due(
            care, [rule], [record(i) for i in identifiers], on=date(2026, 1, 1)
        )[0]
        assert tied["lastRecordId"] == identifiers[-1]


def test_request_permissions_keep_finance_and_workshop_boundaries():
    cases = [
        ("GET", "/api/repairs", "admin", [], "finance"),
        ("PUT", "/api/repairs/3", "admin", [], "finance"),
        ("GET", "/api/repairs/3", "admin", [], "workshop"),
        ("POST", "/api/repairs", "admin", [], "workshop"),
        ("GET", "/api/repairs", "admin", ["workshop"], "workshop"),
        ("PUT", "/api/repairs/3", "accountant", [], "finance"),
        ("GET", "/api/inventory", "mechanic", [], "workshop"),
        ("GET", "/api/mechanics", "advisor", [], "workshop"),
        ("GET", "/api/inventory", "admin", [], "catalog"),
        ("POST", "/api/mechanics", "admin", [], "hr"),
        ("POST", "/api/auth/register-staff", "admin", [], "accounts"),
        ("GET", "/api/auth/users/3", "admin", [], "accounts"),
        ("GET", "/api/auth/me", "admin", [], None),
    ]
    for method, path, role, permissions, expected in cases:
        request = SimpleNamespace(method=method, url=SimpleNamespace(path=path))
        assert (
            _request_permission(request, {"role": role, "permissions": permissions})
            == expected
        )


def test_password_validation_keeps_utf8_byte_limit_for_register_and_reset():
    details = dict(username="example", email="example@example.com", fullName="Example")
    for schema, extra in ((PasswordReset, {}), (RegisterRequest, details)):
        assert schema(password="ệ" * 24, **extra).password == "ệ" * 24
        with pytest.raises(ValidationError, match="Mật khẩu vượt giới hạn 72 byte"):
            schema(password="ệ" * 25, **extra)
