const { Sequelize } = require('sequelize');
const path = require('path');

// SQLite database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', '..', 'data', 'database.sqlite'),
  logging: false, // Set to console.log to see SQL queries
  define: {
    timestamps: true,
    underscored: false
  }
});

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully.');
  } catch (error) {
    console.error('✗ Unable to connect to the database:', error);
  }
};

module.exports = { sequelize, testConnection };
