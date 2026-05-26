require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const { sequelize, testConnection } = require('./config/database');
const models = require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const repairRoutes = require('./routes/repairs');
const inventoryRoutes = require('./routes/inventory');
const mechanicRoutes = require('./routes/mechanics');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'fe')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/mechanics', mechanicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'AutoPro API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint không tồn tại' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Lỗi server',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Sync database (create tables if not exist)
    await sequelize.sync({ alter: false });
    logger.info('✓ Database synced successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`✓ Server is running on http://localhost:${PORT}`);
      logger.info(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('\n📚 Available endpoints:');
      logger.info('  POST   /api/auth/login');
      logger.info('  POST   /api/auth/register');
      logger.info('  GET    /api/vehicles');
      logger.info('  POST   /api/vehicles');
      logger.info('  GET    /api/repairs');
      logger.info('  POST   /api/repairs');
      logger.info('  GET    /api/inventory');
      logger.info('  POST   /api/inventory');
      logger.info('  GET    /api/mechanics');
      logger.info('\n💡 Use seed.js to create initial data');
    });
  } catch (error) {
    logger.error('✗ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
