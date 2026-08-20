from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exc as sa_exc

from database.session import get_db
from models.vehicle import Vehicle
from schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse
from core.constants import Role
from core.response import success_response, error_response
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])


@router.get("/my-vehicles", summary="Get vehicles belonging to the logged-in customer")
async def my_vehicles(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Returns all vehicles whose customerName matches the authenticated user's fullName."""
    stmt = select(Vehicle).where(Vehicle.customerName == current_user["fullName"])
    result = await db.execute(stmt)
    vehicles = result.scalars().all()
    data = [VehicleResponse.model_validate(v).model_dump() for v in vehicles]
    return success_response(data)


@router.get("/", summary="List all vehicles (admin only)")
async def list_vehicles(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Vehicle).order_by(Vehicle.receivedDate.desc())
    result = await db.execute(stmt)
    vehicles = result.scalars().all()
    return success_response([VehicleResponse.model_validate(v).model_dump() for v in vehicles])


@router.get("/{vehicle_id}", summary="Get a single vehicle (admin only)")
async def get_vehicle(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Vehicle).where(Vehicle.id == vehicle_id)
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        return error_response("Không tìm thấy xe", 404)
    return success_response(VehicleResponse.model_validate(vehicle).model_dump())


@router.post("/", summary="Register a new vehicle (admin only)")
async def create_vehicle(
    body: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    vehicle = Vehicle(**body.model_dump())
    vehicle.status = "waiting"
    db.add(vehicle)
    try:
        await db.commit()
        await db.refresh(vehicle)
    except sa_exc.IntegrityError:
        await db.rollback()
        return error_response("Biển số xe đã tồn tại", 409)
    return success_response(VehicleResponse.model_validate(vehicle).model_dump(), "Tiếp nhận xe thành công", 201)


@router.put("/{vehicle_id}", summary="Update vehicle info (admin only)")
async def update_vehicle(
    vehicle_id: int,
    body: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Vehicle).where(Vehicle.id == vehicle_id)
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        return error_response("Không tìm thấy xe", 404)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(vehicle, field, value)

    await db.commit()
    await db.refresh(vehicle)
    return success_response(VehicleResponse.model_validate(vehicle).model_dump(), "Cập nhật thành công")


@router.delete("/{vehicle_id}", summary="Delete a vehicle (admin only)")
async def delete_vehicle(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN)),
):
    stmt = select(Vehicle).where(Vehicle.id == vehicle_id)
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        return error_response("Không tìm thấy xe", 404)
    await db.delete(vehicle)
    await db.commit()
    return success_response(None, "Xóa thành công")
