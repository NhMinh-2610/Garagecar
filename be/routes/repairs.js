const express = require('express');
const { RepairTicket, RepairItem, Vehicle } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const statusCodes = require('../constants/statusCodes');
const errorMessages = require('../constants/errorMessages');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

// GET /api/repairs - Get all repair tickets
router.get('/', async (req, res) => {
  try {
    const tickets = await RepairTicket.findAll({
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: RepairItem, as: 'items' }
      ],
      order: [['createdAt', 'DESC']]
    });

    sendSuccess(res, tickets);
  } catch (error) {
    logger.error('Error fetching repair tickets:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// GET /api/repairs/:id - Get single repair ticket
router.get('/:id', async (req, res) => {
  try {
    const ticket = await RepairTicket.findByPk(req.params.id, {
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: RepairItem, as: 'items' }
      ]
    });

    if (!ticket) {
      return sendError(res, errorMessages.NOT_FOUND_REPAIR, statusCodes.NOT_FOUND);
    }

    sendSuccess(res, ticket);
  } catch (error) {
    logger.error(`Error fetching repair ticket ${req.params.id}:`, error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// POST /api/repairs - Create repair ticket
router.post('/', async (req, res) => {
  try {
    const { vehicleId, items, mechanicName } = req.body;

    if (!vehicleId) {
      return sendError(res, errorMessages.VALIDATION_REQUIRED_FIELD('vehicleId'), statusCodes.BAD_REQUEST);
    }

    // Calculate total
    let totalAmount = 0;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
    }

    // Create ticket
    const ticket = await RepairTicket.create({
      vehicleId,
      totalAmount,
      status: 'draft',
      mechanicName: mechanicName || 'Chưa phân công'
    });

    // Create items
    if (items && items.length > 0) {
      const itemsData = items.map(item => ({
        ...item,
        repairTicketId: ticket.id
      }));
      await RepairItem.bulkCreate(itemsData);
    }

    // Update vehicle status to working
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (vehicle && vehicle.status === 'pending') {
      await vehicle.update({ status: 'working' });
    }

    // Fetch complete ticket
    const completeTicket = await RepairTicket.findByPk(ticket.id, {
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: RepairItem, as: 'items' }
      ]
    });

    sendSuccess(res, completeTicket, 'Tạo phiếu sửa chữa thành công', statusCodes.CREATED);
  } catch (error) {
    logger.error('Error creating repair ticket:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// PUT /api/repairs/:id - Update repair ticket
router.put('/:id', async (req, res) => {
  try {
    const ticket = await RepairTicket.findByPk(req.params.id, {
      include: [{ model: RepairItem, as: 'items' }]
    });

    if (!ticket) {
      return sendError(res, errorMessages.NOT_FOUND_REPAIR, statusCodes.NOT_FOUND);
    }

    const newStatus = req.body.status;
    const oldStatus = ticket.status;

    // Validation: Check if status can transition
    if (newStatus && newStatus !== oldStatus) {
      
      // Validate completed status: all items must be completed
      if (newStatus === 'completed') {
        const hasIncompleteItems = ticket.items.some(item => !item.isCompleted);
        if (hasIncompleteItems) {
          return sendError(res, 'Không thể hoàn thành! Vẫn còn hạng mục chưa hoàn thành.', statusCodes.BAD_REQUEST);
        }
      }

      // Auto-set timestamps based on status transitions
      if (newStatus === 'working' && !ticket.startedAt) req.body.startedAt = new Date();
      if (newStatus === 'completed' && !ticket.completedAt) req.body.completedAt = new Date();
      if (newStatus === 'paid' && !ticket.paidAt) req.body.paidAt = new Date();
    }

    // Update ticket
    await ticket.update(req.body);

    // Sync vehicle status if repair status changed
    if (newStatus && newStatus !== oldStatus && ticket.vehicleId) {
      const vehicle = await Vehicle.findByPk(ticket.vehicleId);
      if (vehicle) {
        let vehicleStatus = vehicle.status;
        
        // Map repair status to vehicle status
        if (newStatus === 'draft' || newStatus === 'working') {
          vehicleStatus = 'repairing';
        } else if (newStatus === 'completed' || newStatus === 'paid') {
          vehicleStatus = 'completed';
        }
        
        // Update vehicle if status changed
        if (vehicleStatus !== vehicle.status) {
          await vehicle.update({ status: vehicleStatus });
        }
      }
    }

    // Fetch updated ticket with relations
    const updatedTicket = await RepairTicket.findByPk(ticket.id, {
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: RepairItem, as: 'items' }
      ]
    });

    sendSuccess(res, updatedTicket, 'Cập nhật thành công');
  } catch (error) {
    logger.error(`Error updating repair ticket ${req.params.id}:`, error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// DELETE /api/repairs/:id - Delete repair ticket
router.delete('/:id', async (req, res) => {
  try {
    const ticket = await RepairTicket.findByPk(req.params.id);

    if (!ticket) {
      return sendError(res, errorMessages.NOT_FOUND_REPAIR, statusCodes.NOT_FOUND);
    }

    // Prevent deletion of completed/paid repairs
    if (ticket.status === 'completed' || ticket.status === 'paid') {
      return sendError(res, 'Không thể xóa phiếu đã hoàn thành hoặc đã thanh toán!', statusCodes.BAD_REQUEST);
    }

    await ticket.destroy();

    sendSuccess(res, null, 'Xóa thành công');
  } catch (error) {
    logger.error(`Error deleting repair ticket ${req.params.id}:`, error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// PUT /api/repairs/:id/items/:itemId/toggle - Toggle repair item completion
router.put('/:id/items/:itemId/toggle', async (req, res) => {
  try {
    const item = await RepairItem.findOne({
      where: {
        id: req.params.itemId,
        repairTicketId: req.params.id
      }
    });

    if (!item) {
      return sendError(res, errorMessages.NOT_FOUND_INVENTORY, statusCodes.NOT_FOUND); // reusing inventory error or generic not found
    }

    const isCompleted = req.body.isCompleted;

    await item.update({
      isCompleted: isCompleted,
      completedAt: isCompleted ? new Date() : null
    });

    sendSuccess(res, item, 'Đã cập nhật trạng thái hạng mục');
  } catch (error) {
    logger.error('Error toggling repair item:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// GET /api/repairs/:id/can-complete - Check if repair can be completed
router.get('/:id/can-complete', async (req, res) => {
  try {
    const ticket = await RepairTicket.findByPk(req.params.id, {
      include: [{ model: RepairItem, as: 'items' }]
    });

    if (!ticket) {
      return sendError(res, errorMessages.NOT_FOUND_REPAIR, statusCodes.NOT_FOUND);
    }

    const totalItems = ticket.items.length;
    const completedItems = ticket.items.filter(item => item.isCompleted).length;
    const canComplete = totalItems > 0 && completedItems === totalItems;

    sendSuccess(res, {
      canComplete,
      totalItems,
      completedItems,
      incompleteItems: totalItems - completedItems
    });
  } catch (error) {
    logger.error('Error checking repair status:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

module.exports = router;
