"""Quyền mặc định của năm vai trò; khóa chức năng chỉ thu hẹp quyền.

Quản trị viên quản lý nhân sự qua quyền ``hr``; đây không còn là vai trò riêng.
"""

ROLE_PERMISSIONS = {
    "admin": {
        "reception",
        "workshop",
        "maintenance",
        "catalog",
        "finance",
        "reports",
        "hr",
        "accounts",
        "messages",
    },
    "advisor": {"reception", "workshop", "maintenance", "messages"},
    "accountant": {"finance", "reports"},
    "mechanic": {"workshop", "maintenance"},
    "customer": {"maintenance", "messages"},
}


def permissions(role, disabled=()):
    return sorted(ROLE_PERMISSIONS.get(role, set()) - set(disabled or ()))
