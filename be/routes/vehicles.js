const express = require('express');
const { Vehicle, RepairTicket } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const { isValidLicensePlate, sanitizeString } = require('../utils/validation');
const statusCodes = require('../constants/statusCodes');
const errorMessages = require('../constants/errorMessages');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/vehicles/my-vehicles - Get vehicles for logged-in user (all roles)
router.get('/my-vehicles', async (req, res) => {
  try {
    const { fullName, role } = req.user;

    // Logic: Find vehicles where customerName matches user's fullName
    // In a real app, this should link via userId, but for now we match by name string
    const vehicles = await Vehicle.findAll({
      where: {
        customerName: fullName
      },
      include: [{
        model: RepairTicket,
        as: 'repairTickets',
        where: { status: 'completed' },
        required: false,
        limit: 1,
        order: [['completedAt', 'DESC']]
      }]
    });

    // Check query result
    if (!vehicles || vehicles.length === 0) {
        // Fallback: If no exact match, try fuzzy search or return empty
        // For prototype simplicity, we stick to exact match or empty
    }
    
    // Process vehicles to add 'lastRepairDate' field for frontend convenience
    const data = vehicles.map(v => {
        const lastTicket = v.repairTickets && v.repairTickets.length > 0 ? v.repairTickets[0] : null;
        return {
            ...v.toJSON(),
            lastRepairDate: lastTicket ? lastTicket.completedAt : null
        };
    });

    sendSuccess(res, data);

  } catch (error) {
    logger.error('Error fetching user vehicles:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// GET /api/vehicles - Get all vehicles with repair info (Admin only)
router.get('/', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      include: [{
        model: RepairTicket,
        as: 'repairTickets',
        required: false
      }],
      order: [['receivedDate', 'DESC']]
    });

    sendSuccess(res, vehicles);
  } catch (error) {
    logger.error('Error fetching vehicles:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// GET /api/vehicles/:id - Get single vehicle (Admin only)
router.get('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return sendError(res, errorMessages.NOT_FOUND_VEHICLE, statusCodes.NOT_FOUND);
    }

    sendSuccess(res, vehicle);
  } catch (error) {
    logger.error(`Error fetching vehicle ${req.params.id}:`, error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// POST /api/vehicles - Create new vehicle (Admin only)
router.post('/', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { licensePlate, customerName, phone, address, carBrand, carModel } = req.body;

    // Validation
    if (!licensePlate || !customerName || !phone) {
      return sendError(res, errorMessages.VALIDATION_REQUIRED_FIELD('licensePlate, customerName, phone'), statusCodes.BAD_REQUEST);
    }

    /*
    // Optional: Validate license plate format
    if (!isValidLicensePlate(licensePlate)) {
      return sendError(res, 'Biển số xe không hợp lệ', statusCodes.BAD_REQUEST);
    }
    */

    const vehicle = await Vehicle.create({
      licensePlate: sanitizeString(licensePlate),
      customerName: sanitizeString(customerName),
      phone: sanitizeString(phone),
      address: sanitizeString(address),
      carBrand: sanitizeString(carBrand),
      carModel: sanitizeString(carModel),
      status: 'pending'
    });

    sendSuccess(res, vehicle, 'Tiếp nhận xe thành công', statusCodes.CREATED);
  } catch (error) {
    logger.error('Error creating vehicle:', error);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, errorMessages.CONFLICT_LICENSE_PLATE_EXISTS, statusCodes.CONFLICT);
    }

    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// PUT /api/vehicles/:id - Update vehicle (Admin only)
router.put('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return sendError(res, errorMessages.NOT_FOUND_VEHICLE, statusCodes.NOT_FOUND);
    }

    await vehicle.update(req.body);

    sendSuccess(res, vehicle, 'Cập nhật thành công');
  } catch (error) {
    logger.error(`Error updating vehicle ${req.params.id}:`, error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// DELETE /api/vehicles/:id - Delete vehicle (Admin only)
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return sendError(res, errorMessages.NOT_FOUND_VEHICLE, statusCodes.NOT_FOUND);
    }

    await vehicle.destroy();

    sendSuccess(res, null, 'Xóa thành công');
  } catch (error) {
    logger.error(`Error deleting vehicle ${req.params.id}:`, error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

module.exports = router;
