const express = require('express');
const { Inventory } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const statusCodes = require('../constants/statusCodes');
const errorMessages = require('../constants/errorMessages');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

// GET /api/inventory - Get all inventory items (Admin + Mechanic)
router.get('/', requireRole(ROLES.ADMIN, ROLES.MECHANIC), async (req, res) => {
  try {
    const items = await Inventory.findAll({
      order: [['name', 'ASC']]
    });

    sendSuccess(res, items);
  } catch (error) {
    logger.error('Error fetching inventory:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// POST /api/inventory - Add inventory item (Admin only)
router.post('/', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { name, quantity, unitPrice } = req.body;

    const item = await Inventory.create({
      name,
      quantity,
      unitPrice
    });

    sendSuccess(res, item, 'Nhập kho thành công', statusCodes.CREATED);
  } catch (error) {
    logger.error('Error creating inventory item:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// PUT /api/inventory/:id - Update inventory item (Admin only)
router.put('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id);

    if (!item) {
      return sendError(res, errorMessages.NOT_FOUND_INVENTORY, statusCodes.NOT_FOUND);
    }

    await item.update(req.body);

    sendSuccess(res, item, 'Cập nhật thành công');
  } catch (error) {
    logger.error('Error updating inventory item:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// DELETE /api/inventory/:id - Delete inventory item (Admin only)
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id);

    if (!item) {
      return sendError(res, errorMessages.NOT_FOUND_INVENTORY, statusCodes.NOT_FOUND);
    }

    await item.destroy();

    sendSuccess(res, null, 'Xóa thành công');
  } catch (error) {
    logger.error('Error deleting inventory item:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

module.exports = router;
