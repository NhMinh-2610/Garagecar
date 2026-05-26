const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RepairTicket = sequelize.define('RepairTicket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vehicleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'vehicles',
      key: 'id'
    }
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  mechanicName: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Chưa phân công'
  },
  status: {
    type: DataTypes.ENUM('draft', 'working', 'completed', 'paid'),
    allowNull: false,
    defaultValue: 'draft'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when repair started (status changed to working)'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when repair completed (status changed to completed)'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when payment received (status changed to paid)'
  }
}, {
  tableName: 'repair_tickets',
  timestamps: true
});

module.exports = RepairTicket;
