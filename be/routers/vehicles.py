from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import exc as sa_exc
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants import Role
from core.response import error_response, success_response
from core.time import utcnow
from database.session import get_db
from middleware.auth import get_current_user, require_role
from models.settings import SystemParameter
from models.user import User
from models.vehicle import Vehicle
from schemas.vehicle import VehicleCreate, VehicleResponse, VehicleUpdate

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])


@router.get("/my-vehicles", summary="Get vehicles belonging to the logged-in customer")
async def my_vehicles(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Ownership is based exclusively on the linked account ID."""
    stmt = select(Vehicle).where(Vehicle.customerId == current_user["id"])
    result = await db.execute(stmt)
    vehicles = result.scalars().all()
    data = [VehicleResponse.model_validate(v).model_dump() for v in vehicles]
    return success_response(data)


@router.get("", summary="List all vehicles (admin only)")
async def list_vehicles(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.ADVISOR)),
):
    stmt = select(Vehicle).order_by(Vehicle.receivedDate.desc())
    result = await db.execute(stmt)
    vehicles = result.scalars().all()
    return success_response(
        [VehicleResponse.model_validate(v).model_dump() for v in vehicles]
    )


@router.get("/{vehicle_id}", summary="Get a single vehicle (admin only)")
async def get_vehicle(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.ADVISOR)),
):
    stmt = select(Vehicle).where(Vehicle.id == vehicle_id)
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        return error_response("Không tìm thấy xe", 404)
    return success_response(VehicleResponse.model_validate(vehicle).model_dump())


@router.post("", summary="Register a new vehicle (admin only)")
async def create_vehicle(
    body: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.ADVISOR)),
):
    vehicle = Vehicle(**body.model_dump())
    await check_plate(db, body.licensePlate)
    if body.customerId:
        customer = await db.get(User, body.customerId)
        if not customer or customer.role != "customer":
            raise HTTPException(400, "Tài khoản khách hàng không hợp lệ")
        vehicle.customerName = customer.fullName
    await check_capacity(db)
    vehicle.status = "waiting"
    db.add(vehicle)
    try:
        await db.commit()
        await db.refresh(vehicle)
    except sa_exc.IntegrityError:
        await db.rollback()
        return error_response("Biển số xe đã tồn tại", 409)
    return success_response(
        VehicleResponse.model_validate(vehicle).model_dump(),
        "Tiếp nhận xe thành công",
        201,
    )


@router.put("/{vehicle_id}", summary="Update vehicle info (admin only)")
async def update_vehicle(
    vehicle_id: int,
    body: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(require_role(Role.ADMIN, Role.ADVISOR)),
):
    stmt = select(Vehicle).where(Vehicle.id == vehicle_id).with_for_update()
    result = await db.execute(stmt)
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        return error_response("Không tìm thấy xe", 404)

    if "customerId" in body.model_fields_set and body.customerId:
        customer = await db.get(User, body.customerId)
        if not customer or customer.role != "customer":
            raise HTTPException(400, "Tài khoản khách hàng không hợp lệ")
    if body.licensePlate:
        await check_plate(db, body.licensePlate, vehicle_id)
    if body.status and body.status != vehicle.status:
        if body.status == "delivered":
            from models import ServiceVisit

            visits = (
                await db.scalars(
                    select(ServiceVisit).where(
                        ServiceVisit.vehicleId == vehicle_id,
                        ServiceVisit.status != "closed",
                    )
                )
            ).all()
            if any(not v.qcAt for v in visits):
                raise HTTPException(
                    409, "Cần nghiệm thu lượt dịch vụ trước khi giao xe"
                )
            for visit in visits:
                visit.status = "closed"
            if (
                vehicle.status != "completed"
                or not vehicle.repairTickets
                or any(t.status != "paid" for t in vehicle.repairTickets)
            ):
                raise HTTPException(409, "Chỉ giao xe khi tất cả phiếu đã thanh toán")
        elif body.status == "waiting" and vehicle.status == "delivered":
            await check_capacity(db)
            vehicle.receivedDate = utcnow()
        else:
            raise HTTPException(409, "Trạng thái xe được cập nhật từ phiếu sửa chữa")
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None and field not in ("customerId", "address", "carModel"):
            continue
        setattr(vehicle, field, value)
    if vehicle.customerId:
        customer = await db.get(User, vehicle.customerId)
        vehicle.customerName = customer.fullName

    await db.commit()
    await db.refresh(vehicle)
    return success_response(
        VehicleResponse.model_validate(vehicle).model_dump(), "Cập nhật thành công"
    )


@router.delete("/{vehicle_id}", summary="Delete a vehicle with no repair history")
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

    ticket_count = len(vehicle.repairTickets)
    if ticket_count:
        raise HTTPException(409, "Xe có lịch sử sửa chữa không được xóa")

    try:
        await db.delete(vehicle)
        await db.commit()
    except sa_exc.IntegrityError:
        await db.rollback()
        return error_response(
            "Không thể xóa xe vì còn dữ liệu liên quan. Vui lòng xóa các phiếu sửa chữa trước.",
            409,
        )

    return success_response(None, "Xóa thành công")


async def check_capacity(db):
    parameter = await db.scalar(
        select(SystemParameter)
        .where(SystemParameter.key == "max_cars_per_day")
        .with_for_update()
    )
    if parameter:
        local_date = (utcnow() + timedelta(hours=7)).date()
        count = await db.scalar(
            select(func.count(Vehicle.id)).where(
                func.date(Vehicle.receivedDate + timedelta(hours=7)) == local_date
            )
        )
        if count >= int(parameter.value):
            raise HTTPException(409, "Đã đạt số xe tiếp nhận tối đa trong ngày")


async def check_plate(db, plate, exclude_id=None):
    normalized = func.regexp_replace(
        func.upper(Vehicle.licensePlate), "[^A-Z0-9]", "", "g"
    )
    stmt = select(Vehicle.id).where(normalized == plate)
    if exclude_id:
        stmt = stmt.where(Vehicle.id != exclude_id)
    if await db.scalar(stmt):
        raise HTTPException(409, "Biển số xe đã tồn tại; dùng chức năng tiếp nhận lại")
