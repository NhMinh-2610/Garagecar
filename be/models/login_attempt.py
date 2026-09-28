from sqlalchemy import Column, Integer, String, Boolean, DateTime
from database.engine import Base
from core.time import utcnow


class LoginAttempt(Base):
    """
    Tracks failed login attempts per email and IP for rate limiting.
    Rows are cheap — a background job or migration can prune rows older than 1 day.
    """
    __tablename__ = "login_attempts"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    identifier   = Column(String(255), nullable=False, index=True)  # "email:x" or "ip:x"
    success      = Column(Boolean, nullable=False, default=False)
    attempted_at = Column(DateTime, nullable=False, default=utcnow)
