const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { isValidEmail, validatePassword } = require('../utils/validation');
const statusCodes = require('../constants/statusCodes');
const errorMessages = require('../constants/errorMessages');
const { ROLES } = require('../constants/roles');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;

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

    // Create user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName,
      role: role || ROLES.USER // Use 'user' as default from constants
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
        role: user.role 
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

module.exports = router;
