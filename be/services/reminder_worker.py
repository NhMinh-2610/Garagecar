"""Generate reminders in bounded transactions; publication remains a staff action."""

import asyncio
import logging

from sqlalchemy import select

from database.session import AsyncSessionLocal
from models import VehicleCare
from services.maintenance_service import scan_reminders


async def reminder_loop():
    while True:
        try:
            async with AsyncSessionLocal() as db:
                vehicle_ids = list(
                    (
                        await db.scalars(
                            select(VehicleCare.vehicleId).order_by(
                                VehicleCare.vehicleId
                            )
                        )
                    ).all()
                )
            for start in range(0, len(vehicle_ids), 50):
                async with AsyncSessionLocal() as db:
                    await scan_reminders(db, vehicle_ids[start : start + 50])
                    await db.commit()
                await asyncio.sleep(0)
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger(__name__).exception("Maintenance reminder scan failed")
        await asyncio.sleep(300)
