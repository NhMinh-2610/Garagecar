const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Vehicle = sequelize.define('Vehicle', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  licensePlate: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  carBrand: {
    type: DataTypes.STRING,
    allowNull: false
  },
  carModel: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('waiting', 'repairing', 'completed', 'delivered'),
    defaultValue: 'waiting'
  },
  receivedDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'vehicles',
  timestamps: true
});

module.exports = Vehicle;
