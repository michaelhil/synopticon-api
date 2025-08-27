/**
 * Simple Logging Utility
 * Configurable logging with levels and environment awareness
 */

// Log levels
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Default configuration
const DEFAULT_CONFIG = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableTimestamp: true,
  enableColors: true
};

/**
 * Create a logger instance
 * @param {Object} config - Logger configuration
 * @returns {Object} Logger instance
 */
export const createLogger = (config = {}) => {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  const formatMessage = (level, message, data) => {
    const timestamp = settings.enableTimestamp ? 
      `[${new Date().toISOString()}] ` : '';
    const levelStr = Object.keys(LogLevel)[level] || 'INFO';
    return `${timestamp}${levelStr}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}`;
  };

  const shouldLog = (level) => level <= settings.level;

  return {
    error: (message, data) => {
      if (shouldLog(LogLevel.ERROR) && settings.enableConsole) {
        console.error(formatMessage(LogLevel.ERROR, message, data));
      }
    },

    warn: (message, data) => {
      if (shouldLog(LogLevel.WARN) && settings.enableConsole) {
        console.warn(formatMessage(LogLevel.WARN, message, data));
      }
    },

    info: (message, data) => {
      if (shouldLog(LogLevel.INFO) && settings.enableConsole) {
        console.log(formatMessage(LogLevel.INFO, message, data));
      }
    },

    debug: (message, data) => {
      if (shouldLog(LogLevel.DEBUG) && settings.enableConsole) {
        console.log(formatMessage(LogLevel.DEBUG, message, data));
      }
    },

    setLevel: (level) => {
      settings.level = level;
    },

    getLevel: () => settings.level
  };
};

// Default logger instance
export const logger = createLogger();