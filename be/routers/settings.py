from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import Role
from core.response import error_response, success_response
from database.session import get_db
from middleware.auth import require_role
from models.settings import Brand, SystemParameter, Wage
from models.vehicle import Vehicle
from schemas.settings import (
    BrandCreate,
    BrandResponse,
    SystemParameterCreate,
    WageCreate,
    WageResponse,
)

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.put("/brands/{brand_id}")
async def update_brand(
    brand_id: int,
    body: BrandCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    brand = await db.scalar(select(Brand).where(Brand.id == brand_id).with_for_update())
    if not brand:
        return error_response("Không tìm thấy hiệu xe", 404)
    old_name = brand.name
    brand.name = body.name
    await db.execute(
        update(Vehicle).where(Vehicle.carBrand == old_name).values(carBrand=body.name)
    )
    await db.commit()
    return success_response(
        BrandResponse.model_validate(brand).model_dump(), "Đã cập nhật hiệu xe"
    )


@router.put("/wages/{wage_id}")
async def update_wage(
    wage_id: int,
    body: WageCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    wage = await db.get(Wage, wage_id)
    if not wage:
        return error_response("Không tìm thấy tiền công", 404)
    wage.name, wage.price = body.name, body.price
    await db.commit()
    return success_response(
        WageResponse.model_validate(wage).model_dump(), "Đã cập nhật tiền công"
    )


# Brands
@router.get("/brands", summary="List all vehicle brands")
async def list_brands(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand).order_by(Brand.name.asc()))
    brands = result.scalars().all()
    return success_response(
        [BrandResponse.model_validate(b).model_dump() for b in brands]
    )


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
    return success_response(
        BrandResponse.model_validate(brand).model_dump(), "Thêm hiệu xe thành công", 201
    )


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


# Wages
@router.get("/wages", summary="List all labor wages")
async def list_wages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Wage).order_by(Wage.name.asc()))
    wages = result.scalars().all()
    return success_response(
        [WageResponse.model_validate(w).model_dump() for w in wages]
    )


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
    return success_response(
        WageResponse.model_validate(wage).model_dump(), "Thêm tiền công thành công", 201
    )


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


# System Parameters
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
    if (
        body.key != "max_cars_per_day"
        or not body.value.isdigit()
        or not 1 <= int(body.value) <= 10000
    ):
        return error_response("Số xe tối đa mỗi ngày phải từ 1 đến 10000", 422)
    result = await db.execute(
        select(SystemParameter).where(SystemParameter.key == body.key)
    )
    param = result.scalar_one_or_none()

    if param:
        param.value = body.value
    else:
        param = SystemParameter(**body.model_dump())
        db.add(param)

    await db.commit()
    return success_response(None, "Lưu tham số thành công")
