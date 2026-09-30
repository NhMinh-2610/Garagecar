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
    },
    "advisor": {"reception", "workshop", "maintenance"},
    "accountant": {"finance", "reports"},
    "hr": {"hr"},
    "mechanic": {"workshop", "maintenance"},
    "customer": {"maintenance"},
}


def permissions(role, disabled=()):
    return sorted(ROLE_PERMISSIONS.get(role, set()) - set(disabled or ()))
