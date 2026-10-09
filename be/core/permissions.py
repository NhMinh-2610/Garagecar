"""Position defaults. Feature restrictions can only remove permissions."""

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
    "hr": {"hr"},
    "mechanic": {"workshop", "maintenance"},
    "customer": {"maintenance", "messages"},
}


def permissions(role, disabled=()):
    return sorted(ROLE_PERMISSIONS.get(role, set()) - set(disabled or ()))
