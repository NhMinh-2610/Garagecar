from datetime import datetime, timezone
from typing import Any, Optional

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
) -> JSONResponse:
    """Trả JSON thống nhất cho frontend; thời gian thiếu múi giờ được hiểu là UTC."""
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(
            {"success": True, "data": data, "message": message},
            custom_encoder={
                datetime: lambda value: value.replace(
                    tzinfo=value.tzinfo or timezone.utc
                ).isoformat()
            },
        ),
    )


def error_response(
    message: str,
    status_code: int = 400,
    error: Optional[str] = None,
) -> JSONResponse:
    """Trả lỗi theo cùng cấu trúc success/message để frontend hiển thị."""
    content: dict[str, Any] = {"success": False, "message": message}
    if error:
        content["error"] = error
    return JSONResponse(status_code=status_code, content=jsonable_encoder(content))
