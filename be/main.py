"""
GarageCar — Python/FastAPI Backend
Entry point: uvicorn main:app --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from config.settings import settings
from database.engine import engine, Base
import models  # noqa: F401 — registers all ORM models with metadata

from routers import auth, vehicles, repairs, inventory, mechanics, ai


# ── Lifespan: create tables on startup ────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # create_all is safe: it skips tables that already exist
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Database tables ready")
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

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(vehicles.router)
app.include_router(repairs.router)
app.include_router(inventory.router)
app.include_router(mechanics.router)
app.include_router(ai.router)


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "success": True,
        "message": "GarageCar Python API is running",
        "version": "2.0.0",
        "ai_provider": settings.ai_provider,
    }


# ── Serve static frontend (optional) ──────────────────────────────────────────
# Mounted at /static so it never shadows API routes.
# Access frontend via: http://localhost:8000/static/admin/index.html

_fe_dir = Path(__file__).parent.parent / "fe"
if _fe_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_fe_dir)), name="frontend-static")


# ── Dev entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
