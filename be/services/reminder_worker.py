"""Generate reminders in bounded transactions; publication remains a staff action."""

import asyncio
import logging
from database.session import AsyncSessionLocal
from services.maintenance_service import scan_all_reminders


async def reminder_loop():
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await scan_all_reminders(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger(__name__).exception("Maintenance reminder scan failed")
        await asyncio.sleep(300)
