/**
 * Comprehensive Error Handling System
 * Provides standardized error handling, logging controls, and recovery mechanisms
 */

// Error severity levels enum
export enum ErrorSeverity {
  FATAL = 'fatal',
  ERROR = 'error', 
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug'
}

// Error categories for better classification
export enum ErrorCategory {
  INITIALIZATION = 'initialization',
  WEBGL = 'webgl',
  CAMERA = 'camera',
  PROCESSING = 'processing',
  MEMORY = 'memory',
  PERFORMANCE = 'performance',
  NETWORK = 'network',
  VALIDATION = 'validation'
}

// Standard error structure
export interface StandardError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: string;
  context: Record<string, unknown>;
  stack?: string;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  logLevel?: ErrorSeverity;
  enableConsole?: boolean;
  enableCollection?: boolean;
  maxErrorHistory?: number;
  onError?: ((error: StandardError) => void) | null;
  enableRecovery?: boolean;
}

// Error statistics interface
export interface ErrorStatistics {
  total: number;
  bySeverity: Record<ErrorSeverity, number>;
  byCategory: Record<ErrorCategory, number>;
  recentErrors: StandardError[];
}

// Default configuration
const DEFAULT_ERROR_CONFIG: Required<ErrorHandlerConfig> = {
  logLevel: ErrorSeverity.WARNING,
  enableConsole: true,
  enableCollection: false,
  maxErrorHistory: 100,
  onError: null,
  enableRecovery: true
};

/**
 * Creates a comprehensive error handler system
 */
export const createErrorHandler = (config: ErrorHandlerConfig = {}) => {
  const errorConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
  
  const state = {
    config: errorConfig,
    history: [] as StandardError[],
    recoveryAttempts: new Map<string, number>()
  };

  const severityLevels: Record<ErrorSeverity, number> = {
    [ErrorSeverity.DEBUG]: 0,
    [ErrorSeverity.INFO]: 1,
    [ErrorSeverity.WARNING]: 2,
    [ErrorSeverity.ERROR]: 3,
    [ErrorSeverity.FATAL]: 4
  };

  const shouldLog = (severity: ErrorSeverity): boolean => {
    const configLevel = severityLevels[state.config.logLevel] || 2;
    const messageLevel = severityLevels[severity] || 2;
    return messageLevel >= configLevel;
  };

  const createStandardError = (
    message: string, 
    category: ErrorCategory, 
    severity: ErrorSeverity = ErrorSeverity.ERROR, 
    context: Record<string, unknown> = {}
  ): StandardError => {
    const timestamp = new Date().toISOString();
    const error: StandardError = {
      id: `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      category,
      severity,
      timestamp,
      context,
      stack: new Error().stack
    };

    if (state.config.enableCollection) {
      state.history.push(error);
      if (state.history.length > state.config.maxErrorHistory) {
        state.history.shift();
      }
    }

    return error;
  };

  const logError = (error: StandardError): void => {
    if (!shouldLog(error.severity)) return;

    const prefix = `[${error.severity.toUpperCase()}] [${error.category}]`;
    const message = `${prefix} ${error.message}`;
    
    if (state.config.enableConsole) {
      switch (error.severity) {
      case ErrorSeverity.FATAL:
      case ErrorSeverity.ERROR:
        console.error(message, error.context);
        break;
      case ErrorSeverity.WARNING:
        console.warn(message, error.context);
        break;
      case ErrorSeverity.INFO:
        console.info(message, error.context);
        break;
      case ErrorSeverity.DEBUG:
        console.debug(message, error.context);
        break;
      }
    }

    if (state.config.onError) {
      try {
        state.config.onError(error);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }
  };

  const handleError = (
    message: string, 
    category: ErrorCategory, 
    severity: ErrorSeverity = ErrorSeverity.ERROR, 
    context: Record<string, unknown> = {}
  ): StandardError => {
    const error = createStandardError(message, category, severity, context);
    logError(error);
    
    if (severity !== ErrorSeverity.FATAL && severity !== ErrorSeverity.INFO && state.config.enableRecovery) {
      attemptRecovery(error);
    }
    
    return error;
  };

  const attemptRecovery = (error: StandardError): boolean => {
    const recoveryKey = `${error.category}_${error.message}`;
    const attempts = state.recoveryAttempts.get(recoveryKey) || 0;
    
    if (attempts >= 3) {
      console.error(`Recovery failed after ${attempts} attempts: ${error.message}`, { originalError: error });
      return false;
    }

    state.recoveryAttempts.set(recoveryKey, attempts + 1);
    
    switch (error.category) {
    case ErrorCategory.WEBGL:
      return recoverWebGL(error);
    case ErrorCategory.CAMERA:
      return recoverCamera(error);
    case ErrorCategory.MEMORY:
      return recoverMemory(error);
    default:
      return false;
    }
  };

  const recoverWebGL = (error: StandardError): boolean => {
    handleError('Attempting WebGL context recovery', ErrorCategory.WEBGL, ErrorSeverity.INFO, { originalError: error.id });
    
    try {
      const canvas = (error.context?.canvas as HTMLCanvasElement) || document.querySelector('canvas');
      if (!canvas) {
        handleError('No canvas found for WebGL recovery', ErrorCategory.WEBGL, ErrorSeverity.ERROR);
        return false;
      }

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        handleError('Failed to get WebGL context during recovery', ErrorCategory.WEBGL, ErrorSeverity.ERROR);
        return false;
      }

      if (gl.isContextLost && gl.isContextLost()) {
        const handleContextRestored = (): void => {
          console.info('[INFO] [WEBGL] WebGL context restored successfully');
          const onContextRestored = error.context?.onContextRestored as (() => void) | undefined;
          if (onContextRestored) {
            onContextRestored();
          }
          canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };

        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return true;
      }

      let glError: number;
      while ((glError = gl.getError()) !== gl.NO_ERROR) {
        console.warn(`[WARNING] [WEBGL] Clearing GL error during recovery: ${glError}`);
      }

      const testTexture = gl.createTexture();
      if (!testTexture) {
        console.error('[ERROR] [WEBGL] WebGL recovery failed: cannot create test texture');
        return false;
      }
      
      gl.deleteTexture(testTexture);
      console.info('[INFO] [WEBGL] WebGL recovery successful');
      return true;

    } catch (recoveryError) {
      console.error('[ERROR] [WEBGL] WebGL recovery failed with exception', { 
        originalError: error.id,
        recoveryError: (recoveryError as Error).message
      });
      return false;
    }
  };

  const recoverCamera = (error: StandardError): boolean => {
    handleError('Attempting camera recovery', ErrorCategory.CAMERA, ErrorSeverity.INFO, { originalError: error.id });
    return true;
  };

  const recoverMemory = (error: StandardError): boolean => {
    handleError('Attempting memory cleanup and recovery', ErrorCategory.MEMORY, ErrorSeverity.WARNING, { originalError: error.id });
    if ((globalThis as any).gc) {
      (globalThis as any).gc();
    }
    return true;
  };

  const validateRequired = (value: unknown, name: string, context: Record<string, unknown> = {}): boolean => {
    if (value === null || value === undefined) {
      handleError(`Required parameter '${name}' is missing`, ErrorCategory.VALIDATION, ErrorSeverity.ERROR, { paramName: name, ...context });
      return false;
    }
    return true;
  };

  const validateType = (value: unknown, expectedType: string, name: string, context: Record<string, unknown> = {}): boolean => {
    if (typeof value !== expectedType) {
      handleError(`Parameter '${name}' expected ${expectedType}, got ${typeof value}`, ErrorCategory.VALIDATION, ErrorSeverity.ERROR, { paramName: name, expectedType, actualType: typeof value, ...context });
      return false;
    }
    return true;
  };

  const validateRange = (value: number, min: number, max: number, name: string, context: Record<string, unknown> = {}): boolean => {
    if (value < min || value > max) {
      handleError(`Parameter '${name}' must be between ${min} and ${max}, got ${value}`, ErrorCategory.VALIDATION, ErrorSeverity.ERROR, { paramName: name, value, min, max, ...context });
      return false;
    }
    return true;
  };

  const wrapFunction = <T extends (...args: any[]) => any>(fn: T, name: string, category: ErrorCategory = ErrorCategory.PROCESSING): T => {
    return ((...args: Parameters<T>): ReturnType<T> => {
      const start = performance.now();
      
      try {
        const result = fn.apply(null, args);
        
        if (result && typeof result.then === 'function') {
          return result.catch((error: Error) => {
            handleError(`Async function '${name}' failed: ${error.message}`, category, ErrorSeverity.ERROR, { functionName: name, args: args.length, duration: performance.now() - start });
            throw error;
          });
        }
        
        const duration = performance.now() - start;
        if (duration > 50) {
          handleError(`Function '${name}' took ${duration.toFixed(2)}ms to execute`, ErrorCategory.PERFORMANCE, ErrorSeverity.WARNING, { functionName: name, duration, args: args.length });
        }
        
        return result;
      } catch (error) {
        handleError(`Function '${name}' failed: ${(error as Error).message}`, category, ErrorSeverity.ERROR, { functionName: name, args: args.length, duration: performance.now() - start });
        throw error;
      }
    }) as T;
  };

  const safeAsync = async <T>(operation: () => Promise<T>, fallback: T | null = null): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      handleError(`Async operation failed: ${(error as Error).message}`, ErrorCategory.PROCESSING, ErrorSeverity.ERROR, { hasStack: Boolean((error as Error).stack) });
      return fallback;
    }
  };

  const setLogLevel = (level: ErrorSeverity): void => {
    if (!Object.values(ErrorSeverity).includes(level)) {
      handleError(`Invalid log level: ${level}`, ErrorCategory.VALIDATION, ErrorSeverity.WARNING);
      return;
    }
    state.config.logLevel = level;
    handleError(`Log level changed to: ${level}`, ErrorCategory.INITIALIZATION, ErrorSeverity.INFO);
  };

  const getErrorHistory = (): StandardError[] => [...state.history];

  const clearErrorHistory = (): void => {
    state.history.length = 0;
    handleError('Error history cleared', ErrorCategory.INITIALIZATION, ErrorSeverity.INFO);
  };

  const getStatistics = (): ErrorStatistics => {
    const stats: ErrorStatistics = {
      total: state.history.length,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      recentErrors: state.history.slice(-10)
    };

    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = state.history.filter(e => e.severity === severity).length;
    });

    Object.values(ErrorCategory).forEach(category => {
      stats.byCategory[category] = state.history.filter(e => e.category === category).length;
    });

    return stats;
  };

  return {
    handleError,
    logError,
    validateRequired,
    validateType, 
    validateRange,
    wrapFunction,
    safeAsync,
    setLogLevel,
    getErrorHistory,
    clearErrorHistory,
    getStatistics
  };
};

// Global error handler instance
export const GlobalErrorHandler = createErrorHandler();

// Convenience functions using global handler
export const { handleError } = GlobalErrorHandler;
export const { validateRequired } = GlobalErrorHandler;
export const { validateType } = GlobalErrorHandler; 
export const { validateRange } = GlobalErrorHandler;
export const { wrapFunction } = GlobalErrorHandler;
export const { safeAsync } = GlobalErrorHandler;
