/**
 * Simple Logging Utility
 * Configurable logging with levels and environment awareness
 */

// Log levels enum for type safety
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Logger configuration interface
export interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableTimestamp?: boolean;
  enableColors?: boolean;
}

// Logger interface
export interface Logger {
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
  setLevel: (level: LogLevel) => void;
  getLevel: () => LogLevel;
}

// Default configuration
const DEFAULT_CONFIG: Required<LoggerConfig> = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableTimestamp: true,
  enableColors: true
};

/**
 * Create a logger instance
 */
export const createLogger = (config: LoggerConfig = {}): Logger => {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  const formatMessage = (level: LogLevel, message: string, data?: unknown): string => {
    const timestamp = settings.enableTimestamp ? 
      `[${new Date().toISOString()}] ` : '';
    const levelStr = LogLevel[level] || 'INFO';
    return `${timestamp}${levelStr}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}`;
  };

  const shouldLog = (level: LogLevel): boolean => level <= settings.level;

  return {
    error: (message: string, data?: unknown): void => {
      if (shouldLog(LogLevel.ERROR) && settings.enableConsole) {
        console.error(formatMessage(LogLevel.ERROR, message, data));
      }
    },

    warn: (message: string, data?: unknown): void => {
      if (shouldLog(LogLevel.WARN) && settings.enableConsole) {
        console.warn(formatMessage(LogLevel.WARN, message, data));
      }
    },

    info: (message: string, data?: unknown): void => {
      if (shouldLog(LogLevel.INFO) && settings.enableConsole) {
        console.log(formatMessage(LogLevel.INFO, message, data));
      }
    },

    debug: (message: string, data?: unknown): void => {
      if (shouldLog(LogLevel.DEBUG) && settings.enableConsole) {
        console.log(formatMessage(LogLevel.DEBUG, message, data));
      }
    },

    setLevel: (level: LogLevel): void => {
      settings.level = level;
    },

    getLevel: (): LogLevel => settings.level
  };
};

// Default logger instance
export const logger = createLogger();
