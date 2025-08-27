/**
 * MCP Server Logger
 * Structured logging for MCP server operations
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  error?: Error;
}

class MCPLogger {
  private level: LogLevel = LogLevel.INFO;
  private component: string;

  constructor(component: string, level?: LogLevel) {
    this.component = component;
    if (level !== undefined) {
      this.level = level;
    }
  }

  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    if (level > this.level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      data,
      error
    };

    this.output(entry);
  }

  private output(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const prefix = `[${entry.timestamp}] ${levelName} [${entry.component}]`;
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(`${prefix} ${entry.message}`, entry.data || '', entry.error || '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${entry.message}`, entry.data || '');
        break;
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, error?: Error, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }
}

/**
 * Create a logger for a specific component
 */
export const createLogger = (component: string, level?: LogLevel): MCPLogger => {
  return new MCPLogger(component, level);
};

/**
 * Get log level from environment
 */
export const getLogLevelFromEnv = (): LogLevel => {
  const envLevel = process.env.MCP_LOG_LEVEL?.toUpperCase();
  
  switch (envLevel) {
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN': return LogLevel.WARN;
    case 'INFO': return LogLevel.INFO;
    case 'DEBUG': return LogLevel.DEBUG;
    default: return LogLevel.INFO;
  }
};