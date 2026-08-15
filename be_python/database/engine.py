from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import DeclarativeBase
from pathlib import Path

# Resolve the SQLite file path relative to the monorepo root
# be_python/ is one level inside the repo root, data/ is at the root
_db_path = Path(__file__).resolve().parent.parent.parent / "data" / "database.sqlite"
_db_path.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{_db_path}"

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass
