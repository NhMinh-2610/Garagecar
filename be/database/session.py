from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from database.engine import engine

# Giữ thuộc tính ORM sau commit để tạo response mà không phát sinh truy vấn ngầm.
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Mỗi request dùng một session; router/service quyết định khi nào commit.
    Thoát context sẽ đóng session và hủy giao dịch chưa commit nếu có lỗi.
    """
    async with AsyncSessionLocal() as session:
        yield session
