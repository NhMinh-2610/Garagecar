const express = require('express');
const router = express.Router();
const Mechanic = require('../models/Mechanic');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const { sendSuccess, sendError } = require('../utils/response');
const statusCodes = require('../constants/statusCodes');
const errorMessages = require('../constants/errorMessages');
const logger = require('../utils/logger');

// Apply auth to all routes
router.use(authMiddleware);

// GET /api/mechanics - List all active mechanics (Admin + Mechanic)
router.get('/', requireRole(ROLES.ADMIN, ROLES.MECHANIC), async (req, res) => {
    try {
        const mechanics = await Mechanic.findAll({
            where: { status: 'active' },
            order: [['createdAt', 'DESC']]
        });
        sendSuccess(res, mechanics);
    } catch (error) {
        logger.error('Get mechanics error:', error);
        sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
});

// POST /api/mechanics - Create new mechanic (Admin only)
router.post('/', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { fullName, phone, specialty } = req.body;
        if (!fullName) {
            return sendError(res, 'Tên thợ là bắt buộc', statusCodes.BAD_REQUEST);
        }

        const newMechanic = await Mechanic.create({
            fullName,
            phone,
            specialty
        });

        sendSuccess(res, newMechanic, 'Thêm thợ thành công', statusCodes.CREATED);
    } catch (error) {
        logger.error('Create mechanic error:', error);
        sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
});

// DELETE /api/mechanics/:id - Soft delete (Admin only)
router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        await Mechanic.update({ status: 'inactive' }, { where: { id } });
        sendSuccess(res, null, 'Đã xóa thợ thành công');
    } catch (error) {
        logger.error('Delete mechanic error:', error);
        sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
});

module.exports = router;
