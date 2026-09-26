from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.session import get_db
from models.settings import Brand, Wage, SystemParameter
from schemas.settings import (
    BrandCreate, BrandResponse,
    WageCreate, WageResponse,
    SystemParameterCreate, SystemParameterResponse
)
from core.constants import Role
from core.response import success_response, error_response
from middleware.auth import require_role

router = APIRouter(prefix="/api/settings", tags=["Settings"])

# --- Brands ---
@router.get("/brands", summary="List all vehicle brands")
async def list_brands(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand).order_by(Brand.name.asc()))
    brands = result.scalars().all()
    return success_response([BrandResponse.model_validate(b).model_dump() for b in brands])

@router.post("/brands", summary="Add a new brand (admin only)")
async def create_brand(
    body: BrandCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    brand = Brand(**body.model_dump())
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return success_response(BrandResponse.model_validate(brand).model_dump(), "Thêm hiệu xe thành công", 201)

@router.delete("/brands/{brand_id}", summary="Delete a brand (admin only)")
async def delete_brand(
    brand_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        return error_response("Không tìm thấy hiệu xe", 404)
    await db.delete(brand)
    await db.commit()
    return success_response(None, "Xóa hiệu xe thành công")

# --- Wages ---
@router.get("/wages", summary="List all labor wages")
async def list_wages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Wage).order_by(Wage.name.asc()))
    wages = result.scalars().all()
    return success_response([WageResponse.model_validate(w).model_dump() for w in wages])

@router.post("/wages", summary="Add a new wage (admin only)")
async def create_wage(
    body: WageCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    wage = Wage(**body.model_dump())
    db.add(wage)
    await db.commit()
    await db.refresh(wage)
    return success_response(WageResponse.model_validate(wage).model_dump(), "Thêm tiền công thành công", 201)

@router.delete("/wages/{wage_id}", summary="Delete a wage (admin only)")
async def delete_wage(
    wage_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(select(Wage).where(Wage.id == wage_id))
    wage = result.scalar_one_or_none()
    if not wage:
        return error_response("Không tìm thấy tiền công", 404)
    await db.delete(wage)
    await db.commit()
    return success_response(None, "Xóa tiền công thành công")

# --- System Parameters ---
@router.get("/params", summary="List all system parameters")
async def list_params(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemParameter))
    params = result.scalars().all()
    # Return as key-value dictionary for easy frontend parsing
    data = {p.key: p.value for p in params}
    return success_response(data)

@router.post("/params", summary="Upsert a system parameter (admin only)")
async def upsert_param(
    body: SystemParameterCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == body.key))
    param = result.scalar_one_or_none()
    
    if param:
        param.value = body.value
    else:
        param = SystemParameter(**body.model_dump())
        db.add(param)
        
    await db.commit()
    return success_response(None, "Lưu tham số thành công")
