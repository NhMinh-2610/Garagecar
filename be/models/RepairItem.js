const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RepairItem = sequelize.define('RepairItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  repairTicketId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'repair_tickets',
      key: 'id'
    }
  },
  taskName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  partName: {
    type: DataTypes.STRING,
    defaultValue: '---'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  partPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  laborPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether this repair item has been completed'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when this item was marked as completed'
  }
}, {
  tableName: 'repair_items',
  timestamps: true
});

module.exports = RepairItem;
