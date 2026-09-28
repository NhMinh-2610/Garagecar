"""
GarageCar — Python/FastAPI Backend
Entry point: uvicorn main:app --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError
from core.response import error_response

from config.settings import settings
from database.engine import engine, Base
import models  # noqa: F401 — registers all ORM models with metadata

from routers import auth, vehicles, repairs, inventory, mechanics, ai
from routers import settings as settings_router
from routers import reports
from routers import bookings, accounts


# ── Lifespan: verify schema readiness ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema changes are explicit: python -m alembic upgrade head.
    from sqlalchemy import inspect
    async with engine.connect() as conn:
        columns = await conn.run_sync(lambda sync: {c["name"] for c in inspect(sync).get_columns("vehicles")})
        if "customerId" not in columns:
            raise RuntimeError("Database needs migration: cd be && python -m alembic upgrade head")
        user_columns = await conn.run_sync(lambda sync: {c["name"] for c in inspect(sync).get_columns("users")})
        if not {"isActive", "sessionVersion", "lastLoginAt"}.issubset(user_columns):
            raise RuntimeError("Database needs account migration: python be/manage.py upgrade")
    yield
    # Teardown (optional cleanup)
    await engine.dispose()


# ── App factory ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GarageCar API",
    description=(
        "RESTful API for GarageCar garage management system.\n\n"
        "Features: multi-role authentication (admin/mechanic/customer), "
        "vehicle intake, repair ticket workflow, inventory management, "
        "and an integrated **AI assistant** for repair diagnosis & cost estimation."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────

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
    errors = [f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors()]
    return error_response("; ".join(errors), 422)


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return error_response("Dữ liệu bị trùng hoặc đang được sử dụng. Vui lòng tải lại và kiểm tra.", 409)

# ── Routers ────────────────────────────────────────────────────────────────────

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


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "success": True,
        "message": "GarageCar Python API is running",
        "version": "2.0.0",
        "ai_provider": settings.ai_provider,
    }


# ── Serve static frontend ─────────────────────────────────────────────────────
# Frontend được serve tại /static/
# Các route dưới đây redirect để người dùng có thể truy cập trực tiếp
# thay vì phải mở file:// (gây lỗi localStorage & CORS)

_fe_dir = Path(__file__).parent.parent / "fe"

if _fe_dir.exists():
    # Convenience redirects — giúp frontend chạy đúng origin http://localhost:8000
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

    # Mount static files last so API routes take priority
    app.mount("/static", StaticFiles(directory=str(_fe_dir)), name="frontend-static")


# ── Dev entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
