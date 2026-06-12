const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { isValidEmail, validatePassword } = require('../utils/validation');
const statusCodes = require('../constants/statusCodes');
const errorMessages = require('../constants/errorMessages');
const { ROLES, STAFF_ROLES } = require('../constants/roles');
const { authMiddleware, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/auth/register - Public registration (Customer only)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return sendError(res, errorMessages.VALIDATION_REQUIRED_FIELD('username, email, password'), statusCodes.BAD_REQUEST);
    }

    if (!isValidEmail(email)) {
      return sendError(res, errorMessages.VALIDATION_INVALID_EMAIL, statusCodes.BAD_REQUEST);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return sendError(res, passwordValidation.message, statusCodes.BAD_REQUEST);
    }

    // Check if user exists
    const existingUser = await User.findOne({ 
      where: { 
        [require('sequelize').Op.or]: [{ email }, { username }] 
      } 
    });

    if (existingUser) {
      return sendError(res, errorMessages.CONFLICT_USERNAME_EXISTS, statusCodes.BAD_REQUEST);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user - ALWAYS customer role for public registration
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName,
      role: ROLES.CUSTOMER
    });

    sendSuccess(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }, 'Đăng ký thành công', statusCodes.CREATED);

  } catch (error) {
    logger.error('Register error:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// POST /api/auth/register-staff - Admin creates staff accounts (Mechanic / Admin)
router.post('/register-staff', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;

    // Validation
    if (!username || !email || !password || !fullName || !role) {
      return sendError(res, errorMessages.VALIDATION_REQUIRED_FIELD('username, email, password, fullName, role'), statusCodes.BAD_REQUEST);
    }

    // Only allow creating staff roles
    if (!STAFF_ROLES.includes(role)) {
      return sendError(res, `Chỉ có thể tạo tài khoản với vai trò: ${STAFF_ROLES.join(', ')}`, statusCodes.BAD_REQUEST);
    }

    if (!isValidEmail(email)) {
      return sendError(res, errorMessages.VALIDATION_INVALID_EMAIL, statusCodes.BAD_REQUEST);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return sendError(res, passwordValidation.message, statusCodes.BAD_REQUEST);
    }

    // Check if user exists
    const existingUser = await User.findOne({ 
      where: { 
        [require('sequelize').Op.or]: [{ email }, { username }] 
      } 
    });

    if (existingUser) {
      return sendError(res, errorMessages.CONFLICT_USERNAME_EXISTS, statusCodes.BAD_REQUEST);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create staff user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName,
      role
    });

    sendSuccess(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }, `Tạo tài khoản ${role} thành công`, statusCodes.CREATED);

  } catch (error) {
    logger.error('Register staff error:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return sendError(res, errorMessages.VALIDATION_REQUIRED_FIELD('email, password'), statusCodes.BAD_REQUEST);
    }

    // Find user
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return sendError(res, errorMessages.AUTH_INVALID_CREDENTIALS, statusCodes.UNAUTHORIZED);
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return sendError(res, errorMessages.AUTH_INVALID_CREDENTIALS, statusCodes.UNAUTHORIZED);
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        fullName: user.fullName
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    sendSuccess(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    }, 'Đăng nhập thành công');

  } catch (error) {
    logger.error('Login error:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// GET /api/auth/users - Admin only: list all users
router.get('/users', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'fullName', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    sendSuccess(res, users);
  } catch (error) {
    logger.error('Get users error:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

// DELETE /api/auth/users/:id - Admin only: delete user
router.delete('/users/:id', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (userId === req.user.id) {
      return sendError(res, 'Không thể xóa tài khoản của chính bạn', statusCodes.BAD_REQUEST);
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return sendError(res, errorMessages.NOT_FOUND_USER, statusCodes.NOT_FOUND);
    }

    await user.destroy();

    sendSuccess(res, null, 'Xóa tài khoản thành công');
  } catch (error) {
    logger.error('Delete user error:', error);
    sendError(res, errorMessages.SERVER_ERROR, statusCodes.INTERNAL_SERVER_ERROR, error.message);
  }
});

module.exports = router;
