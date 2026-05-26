const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Mechanic = sequelize.define('Mechanic', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  specialty: {
    type: DataTypes.STRING, // e.g., 'Máy gầm', 'Điện', 'Đồng sơn'
    defaultValue: 'Chung'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active', // active, inactive
    validate: {
      isIn: [['active', 'inactive']]
    }
  }
}, {
  tableName: 'mechanics',
  timestamps: true
});

module.exports = Mechanic;
