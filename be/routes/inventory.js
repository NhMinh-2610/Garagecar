const express = require('express');
const { Inventory } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/inventory - Get all inventory items
router.get('/', async (req, res) => {
  try {
    const items = await Inventory.findAll({
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
});

// POST /api/inventory - Add inventory item
router.post('/', async (req, res) => {
  try {
    const { name, quantity, unitPrice } = req.body;

    const item = await Inventory.create({
      name,
      quantity,
      unitPrice
    });

    res.status(201).json({
      success: true,
      message: 'Nhập kho thành công',
      data: item
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
});

// PUT /api/inventory/:id - Update inventory item
router.put('/:id', async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy vật tư' 
      });
    }

    await item.update(req.body);

    res.json({
      success: true,
      message: 'Cập nhật thành công',
      data: item
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
});

// DELETE /api/inventory/:id - Delete inventory item
router.delete('/:id', async (req, res) => {
  try {
    const item = await Inventory.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy vật tư' 
      });
    }

    await item.destroy();

    res.json({
      success: true,
      message: 'Xóa thành công'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server', 
      error: error.message 
    });
  }
});

module.exports = router;
