// Simple Logger Utility

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const colors = {
  ERROR: '\x1b[31m',   // Red
  WARN: '\x1b[33m',    // Yellow
  INFO: '\x1b[36m',    // Cyan
  DEBUG: '\x1b[35m',   // Magenta
  RESET: '\x1b[0m'
};

class Logger {
  constructor(context = 'APP') {
    this.context = context;
    this.level = process.env.LOG_LEVEL || 'INFO';
  }
  
  _shouldLog(level) {
    const levels = Object.keys(LOG_LEVELS);
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }
  
  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const color = colors[level] || colors.RESET;
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    
    return `${color}[${timestamp}] [${level}] [${this.context}]${colors.RESET} ${message} ${metaStr}`;
  }
  
  error(message, meta = {}) {
    if (this._shouldLog('ERROR')) {
      console.error(this._formatMessage('ERROR', message, meta));
    }
  }
  
  warn(message, meta = {}) {
    if (this._shouldLog('WARN')) {
      console.warn(this._formatMessage('WARN', message, meta));
    }
  }
  
  info(message, meta = {}) {
    if (this._shouldLog('INFO')) {
      console.log(this._formatMessage('INFO', message, meta));
    }
  }
  
  debug(message, meta = {}) {
    if (this._shouldLog('DEBUG')) {
      console.log(this._formatMessage('DEBUG', message, meta));
    }
  }
}

// Create default logger
const logger = new Logger();

// Allow creating context-specific loggers
logger.createLogger = (context) => new Logger(context);

module.exports = logger;
