from datetime import datetime, timezone


def utcnow():
    """Legacy columns store naive UTC; API responses explicitly include UTC offset."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
