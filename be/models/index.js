const User = require('./User');
const Vehicle = require('./Vehicle');
const RepairTicket = require('./RepairTicket');
const RepairItem = require('./RepairItem');
const Inventory = require('./Inventory');
const Mechanic = require('./Mechanic');

// Define relationships
Vehicle.hasMany(RepairTicket, { foreignKey: 'vehicleId', as: 'repairTickets' });
RepairTicket.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });

RepairTicket.hasMany(RepairItem, { foreignKey: 'repairTicketId', as: 'items' });
RepairItem.belongsTo(RepairTicket, { foreignKey: 'repairTicketId', as: 'ticket' });

module.exports = {
  User,
  Vehicle,
  RepairTicket,
  RepairItem,
  Inventory,
  Mechanic
};
