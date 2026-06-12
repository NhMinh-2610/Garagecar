const express = require('express');
const { RepairTicket, RepairItem, Vehicle } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const statusCodes = require('../constants/statusCodes');
const errorMessages = require('../constants/errorMessages');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

// GET /api/repairs/my-tasks - Get repairs assigned to the logged-in mechanic
router.get('/my-tasks', requireRole(ROLES.ADMIN, ROLES.MECHANIC), async (req, res) => {
  try {
    const { fullName } = req.user;

    const tickets = await RepairTicket.findAll({
      where: { mechanicName: fullName },
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: RepairItem, as: 'items' }
      ],
      order: [['createdAt', 'DESC']]
    });

    sendSuccess(res, tickets);
  } catch (error) {
    logger.error('Error fetching mechanic tasks:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// GET /api/repairs/my-repairs - Get repairs for vehicles belonging to logged-in customer
router.get('/my-repairs', async (req, res) => {
  try {
    const { fullName } = req.user;

    // Find all vehicles belonging to this customer
    const vehicles = await Vehicle.findAll({
      where: { customerName: fullName },
      attributes: ['id']
    });

    const vehicleIds = vehicles.map(v => v.id);

    if (vehicleIds.length === 0) {
      return sendSuccess(res, []);
    }

    // Find all repair tickets for those vehicles
    const tickets = await RepairTicket.findAll({
      where: { vehicleId: vehicleIds },
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: RepairItem, as: 'items' }
      ],
      order: [['createdAt', 'DESC']]
    });

    sendSuccess(res, tickets);
  } catch (error) {
    logger.error('Error fetching customer repairs:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// GET /api/repairs - Get all repair tickets (Admin only)
router.get('/', requireRole(ROLES.ADMIN), async (req, res) => {
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

// GET /api/repairs/:id - Get single repair ticket (Admin + Mechanic)
router.get('/:id', requireRole(ROLES.ADMIN, ROLES.MECHANIC, ROLES.CUSTOMER), async (req, res) => {
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

    // Customer can only view their own vehicle's repairs
    if (req.user.role === ROLES.CUSTOMER) {
      const vehicle = ticket.vehicle;
      if (!vehicle || vehicle.customerName !== req.user.fullName) {
        return sendError(res, errorMessages.AUTH_UNAUTHORIZED, statusCodes.FORBIDDEN);
      }
    }

    // Mechanic can only view repairs assigned to them
    if (req.user.role === ROLES.MECHANIC) {
      if (ticket.mechanicName !== req.user.fullName) {
        return sendError(res, errorMessages.AUTH_UNAUTHORIZED, statusCodes.FORBIDDEN);
      }
    }

    sendSuccess(res, ticket);
  } catch (error) {
    logger.error(`Error fetching repair ticket ${req.params.id}:`, error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// POST /api/repairs - Create repair ticket (Admin only)
router.post('/', requireRole(ROLES.ADMIN), async (req, res) => {
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

// PUT /api/repairs/:id - Update repair ticket (Admin + Mechanic)
router.put('/:id', requireRole(ROLES.ADMIN, ROLES.MECHANIC), async (req, res) => {
  try {
    const ticket = await RepairTicket.findByPk(req.params.id, {
      include: [{ model: RepairItem, as: 'items' }]
    });

    if (!ticket) {
      return sendError(res, errorMessages.NOT_FOUND_REPAIR, statusCodes.NOT_FOUND);
    }

    // Mechanic can only update repairs assigned to them
    if (req.user.role === ROLES.MECHANIC) {
      if (ticket.mechanicName !== req.user.fullName) {
        return sendError(res, 'Bạn không được phân công phiếu này', statusCodes.FORBIDDEN);
      }
      // Mechanic can only change status to 'completed'
      if (req.body.status && req.body.status !== 'completed') {
        return sendError(res, 'Thợ chỉ có thể đánh dấu hoàn thành phiếu sửa', statusCodes.FORBIDDEN);
      }
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

// DELETE /api/repairs/:id - Delete repair ticket (Admin only)
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
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

// PUT /api/repairs/:id/items/:itemId/toggle - Toggle repair item completion (Admin + Mechanic)
router.put('/:id/items/:itemId/toggle', requireRole(ROLES.ADMIN, ROLES.MECHANIC), async (req, res) => {
  try {
    // If mechanic, verify assignment
    if (req.user.role === ROLES.MECHANIC) {
      const ticket = await RepairTicket.findByPk(req.params.id);
      if (!ticket || ticket.mechanicName !== req.user.fullName) {
        return sendError(res, 'Bạn không được phân công phiếu này', statusCodes.FORBIDDEN);
      }
    }

    const item = await RepairItem.findOne({
      where: {
        id: req.params.itemId,
        repairTicketId: req.params.id
      }
    });

    if (!item) {
      return sendError(res, errorMessages.NOT_FOUND_INVENTORY, statusCodes.NOT_FOUND);
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

// GET /api/repairs/:id/can-complete - Check if repair can be completed (Admin + Mechanic)
router.get('/:id/can-complete', requireRole(ROLES.ADMIN, ROLES.MECHANIC), async (req, res) => {
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
