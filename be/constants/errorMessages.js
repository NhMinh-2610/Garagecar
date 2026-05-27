// Error Messages Constants

module.exports = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
  AUTH_TOKEN_MISSING: 'Token xác thực không tồn tại',
  AUTH_TOKEN_INVALID: 'Token xác thực không hợp lệ',
  AUTH_TOKEN_EXPIRED: 'Token xác thực đã hết hạn',
  AUTH_UNAUTHORIZED: 'Bạn không có quyền truy cập',
  
  // Validation
  VALIDATION_REQUIRED_FIELD: (field) => `Trường ${field} là bắt buộc`,
  VALIDATION_INVALID_EMAIL: 'Email không hợp lệ',
  VALIDATION_PASSWORD_TOO_SHORT: 'Mật khẩu phải có ít nhất 6 ký tự',
  VALIDATION_PHONE_INVALID: 'Số điện thoại không hợp lệ',
  
  // Resource Not Found
  NOT_FOUND_VEHICLE: 'Không tìm thấy thông tin xe',
  NOT_FOUND_REPAIR: 'Không tìm thấy phiếu sửa chữa',
  NOT_FOUND_INVENTORY: 'Không tìm thấy linh kiện',
  NOT_FOUND_MECHANIC: 'Không tìm thấy thợ sửa',
  NOT_FOUND_USER: 'Không tìm thấy người dùng',
  
  // Conflict
  CONFLICT_EMAIL_EXISTS: 'Email đã tồn tại trong hệ thống',
  CONFLICT_USERNAME_EXISTS: 'Username đã được sử dụng',
  CONFLICT_LICENSE_PLATE_EXISTS: 'Biển số xe đã tồn tại',
  
  // Server Errors
  SERVER_ERROR: 'Lỗi server, vui lòng thử lại sau',
  DATABASE_ERROR: 'Lỗi cơ sở dữ liệu'
};
