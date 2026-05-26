// Validation Utility Functions

/**
 * Validate email format
 * @param {String} email
 * @returns {Boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Vietnamese format)
 * @param {String} phone
 * @returns {Boolean}
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^(0|\+84)[0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Validate password strength
 * @param {String} password
 * @returns {Object} { valid: Boolean, message: String }
 */
const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' };
  }
  
  // Optional: Add more complex validation
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa' };
  // }
  
  return { valid: true, message: '' };
};

/**
 * Validate Vietnamese license plate
 * @param {String} plate
 * @returns {Boolean}
 */
const isValidLicensePlate = (plate) => {
  // Vietnamese license plate format: XX-YYY.YY or XXY-YYYY
  const regex = /^\d{2}[A-Z]-\d{3,}\.\d{2}$|^\d{2}[A-Z]-\d{4,5}$/i;
  return regex.test(plate);
};

/**
 * Sanitize string input
 * @param {String} input
 * @returns {String}
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/<script[^>]*>.*?<\/script>/gi, '');
};

/**
 * Validate required fields
 * @param {Object} data
 * @param {Array} requiredFields
 * @returns {Array} Array of missing fields
 */
const validateRequiredFields = (data, requiredFields) => {
  const missing = [];
  
  requiredFields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      missing.push(field);
    }
  });
  
  return missing;
};

module.exports = {
  isValidEmail,
  isValidPhone,
  validatePassword,
  isValidLicensePlate,
  sanitizeString,
  validateRequiredFields
};
