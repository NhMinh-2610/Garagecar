const express = require('express');
const router = express.Router();
const Mechanic = require('../models/Mechanic');

// GET /api/mechanics - List all active mechanics
router.get('/', async (req, res) => {
    try {
        const mechanics = await Mechanic.findAll({
            where: { status: 'active' },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: mechanics });
    } catch (error) {
        console.error('Get mechanics error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// POST /api/mechanics - Create new mechanic
router.post('/', async (req, res) => {
    try {
        const { fullName, phone, specialty } = req.body;
        if (!fullName) {
            return res.status(400).json({ success: false, message: 'Tên thợ là bắt buộc' });
        }

        const newMechanic = await Mechanic.create({
            fullName,
            phone,
            specialty
        });

        res.json({ success: true, data: newMechanic });
    } catch (error) {
        console.error('Create mechanic error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// DELETE /api/mechanics/:id - Soft delete (set status inactive)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Mechanic.update({ status: 'inactive' }, { where: { id } });
        res.json({ success: true, message: 'Đã xóa thợ thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

module.exports = router;
