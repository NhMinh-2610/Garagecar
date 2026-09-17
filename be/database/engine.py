from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import DeclarativeBase

from config.settings import settings

# PostgreSQL async engine via asyncpg driver
# Connection URL comes from .env: DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,   # reconnect automatically if connection drops
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass
