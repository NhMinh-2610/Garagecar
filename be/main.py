"""
GarageCar — Python/FastAPI Backend
Entry point: uvicorn main:app --reload
"""

import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

import models  # noqa: F401 - Dang ky ORM models truoc khi khoi dong.
from config.settings import settings
from core.response import error_response
from database.engine import engine
from routers import (
    accounts,
    advisor_operations,
    ai,
    auth,
    bookings,
    employees,
    evidence,
    finance_operations,
    hr_operations,
    inventory,
    maintenance,
    mechanics,
    messaging,
    repairs,
    reports,
    service,
    vehicles,
)
from routers import settings as settings_router


# Lifespan: verify schema readiness
@asynccontextmanager
async def lifespan(app: FastAPI):
    from database.schema import ensure_schema
    from services.reminder_worker import reminder_loop

    worker = None
    try:
        await ensure_schema(engine)
        worker = asyncio.create_task(reminder_loop())
        yield
    finally:
        try:
            if worker is not None:
                worker.cancel()
                with suppress(asyncio.CancelledError):
                    await worker
        finally:
            await engine.dispose()


# App factory
app = FastAPI(
    title="GarageCar API",
    description=(
        "RESTful API for GarageCar garage management system.\n\n"
        "Features: multi-role authentication (admin/advisor/accountant/hr/mechanic/customer), "
        "vehicle intake, repair ticket workflow, inventory management, "
        "and an integrated **AI assistant** for repair diagnosis & cost estimation."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin] if settings.cors_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(StarletteHTTPException)
async def http_error(request, exc):
    return error_response(str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    errors = [
        f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors()
    ]
    return error_response("; ".join(errors), 422)


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return error_response(
        "Dữ liệu bị trùng hoặc đang được sử dụng. Vui lòng tải lại và kiểm tra.", 409
    )


# Routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(vehicles.router)
app.include_router(repairs.router)
app.include_router(inventory.router)
app.include_router(mechanics.router)
app.include_router(ai.router)
app.include_router(settings_router.router)
app.include_router(reports.router)
app.include_router(bookings.router)
app.include_router(maintenance.router)
app.include_router(service.router)
app.include_router(employees.router)
app.include_router(evidence.router)
app.include_router(finance_operations.router)
app.include_router(hr_operations.router)
app.include_router(advisor_operations.router)
app.include_router(messaging.router)


# Health check
@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "success": True,
        "message": "GarageCar Python API is running",
        "version": "3.0.0",
        "ai_provider": settings.ai_provider,
    }


# Serve static frontend
# Phuc vu frontend cung origin de dung chung API va phien dang nhap.
_fe_dir = Path(__file__).parent.parent / "fe"

if _fe_dir.exists():

    @app.get("/", include_in_schema=False)
    async def root():
        return RedirectResponse(url="/static/index.html")

    @app.get("/home", include_in_schema=False)
    async def home_page():
        return RedirectResponse(url="/static/index.html")

    @app.get("/login", include_in_schema=False)
    async def login_page():
        return RedirectResponse(url="/static/login/index.html")

    @app.get("/admin", include_in_schema=False)
    async def admin_page():
        return RedirectResponse(url="/static/admin/index.html")

    @app.get("/mechanic", include_in_schema=False)
    async def mechanic_page():
        return RedirectResponse(url="/static/mechanic/index.html")

    @app.get("/customer", include_in_schema=False)
    async def customer_page():
        return RedirectResponse(url="/static/customer/index.html")

    @app.get("/staff", include_in_schema=False)
    async def staff_page():
        return RedirectResponse(url="/static/staff/index.html")

    @app.get("/advisor", include_in_schema=False)
    async def advisor_page():
        return RedirectResponse(url="/static/advisor/index.html")

    @app.get("/accountant", include_in_schema=False)
    async def accountant_page():
        return RedirectResponse(url="/static/accountant/index.html")

    @app.get("/hr", include_in_schema=False)
    async def hr_page():
        return RedirectResponse(url="/static/hr/index.html")

    @app.get("/service-worker.js", include_in_schema=False)
    async def service_worker():
        return FileResponse(
            _fe_dir / "service-worker.js",
            media_type="application/javascript",
            headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"},
        )

    # Mount static files last so API routes take priority
    app.mount("/static", StaticFiles(directory=str(_fe_dir)), name="frontend-static")


# Dev entry point
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
