"""Các thao tác kho dùng chung; transaction do router gọi quyết định."""

from models import InventoryMovement


def add_stock_movement(db, inventory, quantity_change, reason, reference=None):
    """Ghi số dư sau cập nhật; không tự đổi tồn hoặc commit."""
    db.add(
        InventoryMovement(
            inventoryId=inventory.id,
            quantityChange=quantity_change,
            balanceAfter=inventory.quantity,
            reason=reason,
            reference=reference,
        )
    )
