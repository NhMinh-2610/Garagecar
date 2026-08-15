from fastapi.responses import JSONResponse
from typing import Any, Optional


def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
) -> JSONResponse:
    """Return a standardised success JSON payload — mirrors Node.js sendSuccess()."""
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "data": data, "message": message},
    )


def error_response(
    message: str,
    status_code: int = 400,
    error: Optional[str] = None,
) -> JSONResponse:
    """Return a standardised error JSON payload — mirrors Node.js sendError()."""
    content: dict[str, Any] = {"success": False, "message": message}
    if error:
        content["error"] = error
    return JSONResponse(status_code=status_code, content=content)
