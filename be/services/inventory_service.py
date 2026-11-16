"""Stock and its immutable actor trail always share the caller's transaction."""

from models.inventory_movement import InventoryMovement


def add_stock_movement(db, inventory, change, reason, reference=None, detail=None):
    db.add(
        InventoryMovement(
            inventoryId=inventory.id,
            quantityChange=change,
            balanceAfter=inventory.quantity,
            reason=reason,
            reference=reference,
            actorId=db.info.get("actor_id"),
            requestId=db.info.get("request_id"),
            detail=detail,
        )
    )
