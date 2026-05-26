// Response Formatter Utility

const statusCodes = require('../constants/statusCodes');

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = statusCodes.OK) => {
  const response = {
    success: true,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 500)
 * @param {Array} errors - Validation errors (optional)
 */
const sendError = (res, message = 'Error', statusCode = statusCodes.INTERNAL_SERVER_ERROR, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR ${statusCode}]:`, message, errors || '');
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of data
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @param {Number} total - Total count
 */
const sendPaginated = (res, data, page, limit, total) => {
  return res.status(statusCodes.OK).json({
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated
};
