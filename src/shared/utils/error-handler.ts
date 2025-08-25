/**
 * Comprehensive Error Handling System - TypeScript Native
 * Provides standardized error handling, logging controls, and recovery mechanisms
 * Strict type safety for all error operations
 */

// Error severity levels
export const ErrorSeverity = {
  FATAL: 'fatal',
  ERROR: 'error', 
  WARNING: 'warning',
  INFO: 'info',
  DEBUG: 'debug'
} as const;

export type ErrorSeverityType = typeof ErrorSeverity[keyof typeof ErrorSeverity];

// Error categories for better classification
export const ErrorCategory = {
  INITIALIZATION: 'initialization',
  WEBGL: 'webgl',
  CAMERA: 'camera',
  PROCESSING: 'processing',
  MEMORY: 'memory',
  PERFORMANCE: 'performance',
  NETWORK: 'network',
  VALIDATION: 'validation'
} as const;

export type ErrorCategoryType = typeof ErrorCategory[keyof typeof ErrorCategory];

// Error handler configuration interface
export interface ErrorHandlerConfig {
  readonly logLevel?: ErrorSeverityType;
  readonly enableConsole?: boolean;
  readonly enableCollection?: boolean;
  readonly maxErrorHistory?: number;
  readonly onError?: ((error: StandardError) => void) | null;
  readonly enableRecovery?: boolean;
}

// Standard error interface
export interface StandardError {
  readonly id: string;
  readonly message: string;
  readonly category: ErrorCategoryType;
  readonly severity: ErrorSeverityType;
  readonly timestamp: string;
  readonly context: Record<string, unknown>;
  readonly stack?: string;
}

// Error handler interface
export interface ErrorHandler {
  handleError(
    message: string, 
    category: ErrorCategoryType, 
    severity?: ErrorSeverityType, 
    context?: Record<string, unknown>
  ): StandardError;
  logError(error: StandardError): void;
  validateRequired(value: unknown, name: string, context?: Record<string, unknown>): boolean;
  validateType(value: unknown, expectedType: string, name: string, context?: Record<string, unknown>): boolean;
  validateRange(value: number, min: number, max: number, name: string, context?: Record<string, unknown>): boolean;
  wrapFunction<T extends (...args: any[]) => any>(
    fn: T, 
    name: string, 
    category?: ErrorCategoryType
  ): T;
  safeAsync<T>(operation: () => Promise<T>, fallback?: T): Promise<T | null>;
  setLogLevel(level: ErrorSeverityType): void;
  getErrorHistory(): ReadonlyArray<StandardError>;
  clearErrorHistory(): void;
  getStatistics(): {
    readonly total: number;
    readonly bySeverity: Record<ErrorSeverityType, number>;
    readonly byCategory: Record<ErrorCategoryType, number>;
    readonly recentErrors: ReadonlyArray<StandardError>;
  };
  readonly ErrorSeverity: typeof ErrorSeverity;
  readonly ErrorCategory: typeof ErrorCategory;
}

// Internal state interface
interface ErrorHandlerState {
  config: Required<ErrorHandlerConfig>;
  history: StandardError[];
  recoveryAttempts: Map<string, number>;
}

// Recovery context interface
interface RecoveryContext {
  readonly canvas?: HTMLCanvasElement;
  readonly onContextRestored?: () => void;
  readonly [key: string]: unknown;
}

/**
 * Creates a comprehensive error handler system
 */
export const createErrorHandler = (config: ErrorHandlerConfig = {}): ErrorHandler => {
  const state: ErrorHandlerState = {
    config: {
      logLevel: config.logLevel ?? ErrorSeverity.WARNING,
      enableConsole: config.enableConsole ?? true,
      enableCollection: config.enableCollection ?? false,
      maxErrorHistory: config.maxErrorHistory ?? 100,
      onError: config.onError ?? null,
      enableRecovery: config.enableRecovery ?? true
    },
    history: [],
    recoveryAttempts: new Map()
  };

  // Severity level ordering for filtering
  const severityLevels: Record<ErrorSeverityType, number> = {
    [ErrorSeverity.DEBUG]: 0,
    [ErrorSeverity.INFO]: 1,
    [ErrorSeverity.WARNING]: 2,
    [ErrorSeverity.ERROR]: 3,
    [ErrorSeverity.FATAL]: 4
  };

  const shouldLog = (severity: ErrorSeverityType): boolean => {
    const configLevel = severityLevels[state.config.logLevel];
    const messageLevel = severityLevels[severity];
    return messageLevel >= configLevel;
  };

  const createStandardError = (
    message: string, 
    category: ErrorCategoryType, 
    severity: ErrorSeverityType = ErrorSeverity.ERROR, 
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

    // Add to history if collection enabled
    if (state.config.enableCollection) {
      state.history.push(error);
      
      // Maintain history size limit
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

    // Call custom error handler
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
    category: ErrorCategoryType, 
    severity: ErrorSeverityType = ErrorSeverity.ERROR, 
    context: Record<string, unknown> = {}
  ): StandardError => {
    const error = createStandardError(message, category, severity, context);
    logError(error);
    
    // Skip recovery for INFO level messages to avoid interference with initialization
    if (severity !== ErrorSeverity.FATAL && severity !== ErrorSeverity.INFO && state.config.enableRecovery) {
      attemptRecovery(error);
    }
    
    return error;
  };

  const attemptRecovery = (error: StandardError): boolean => {
    const recoveryKey = `${error.category}_${error.message}`;
    const attempts = state.recoveryAttempts.get(recoveryKey) || 0;
    
    // Limit recovery attempts to prevent infinite loops
    if (attempts >= 3) {
      console.error(`Recovery failed after ${attempts} attempts: ${error.message}`, { originalError: error });
      return false;
    }

    state.recoveryAttempts.set(recoveryKey, attempts + 1);
    
    // Category-specific recovery strategies
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
    handleError(
      'Attempting WebGL context recovery',
      ErrorCategory.WEBGL,
      ErrorSeverity.INFO,
      { originalError: error.id }
    );
    
    // WebGL context recovery implementation
    try {
      const context = error.context as RecoveryContext;
      const canvas = context?.canvas || document.querySelector('canvas');
      if (!canvas) {
        handleError(
          'No canvas found for WebGL recovery',
          ErrorCategory.WEBGL,
          ErrorSeverity.ERROR
        );
        return false;
      }

      // Check if context is lost
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        handleError(
          'Failed to get WebGL context during recovery',
          ErrorCategory.WEBGL,
          ErrorSeverity.ERROR
        );
        return false;
      }

      // Check if context is actually lost
      if (gl.isContextLost()) {
        handleError(
          'WebGL context is lost, waiting for restoration',
          ErrorCategory.WEBGL,
          ErrorSeverity.WARNING
        );

        // Set up context restoration handler
        const handleContextRestored = (): void => {
          console.info('[INFO] [WEBGL] WebGL context restored successfully');
          
          // Trigger reinitialization if callback available
          if (context?.onContextRestored) {
            context.onContextRestored();
          }
          
          canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };

        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return true; // Recovery attempt in progress
      }

      // Context is not lost, try other recovery strategies
      
      // Clear any GL errors
      let glError: number;
      while ((glError = gl.getError()) !== gl.NO_ERROR) {
        console.warn(`[WARNING] [WEBGL] Clearing GL error during recovery: ${glError}`);
      }

      // Test basic WebGL functionality
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
        recoveryError: recoveryError instanceof Error ? recoveryError.message : 'Unknown error',
        stack: recoveryError instanceof Error ? recoveryError.stack : undefined
      });
      
      return false;
    }
  };

  const recoverCamera = (error: StandardError): boolean => {
    handleError(
      'Attempting camera recovery',
      ErrorCategory.CAMERA, 
      ErrorSeverity.INFO,
      { originalError: error.id }
    );
    
    // Camera recovery could involve re-initializing permissions
    return true;
  };

  const recoverMemory = (error: StandardError): boolean => {
    handleError(
      'Attempting memory cleanup and recovery',
      ErrorCategory.MEMORY,
      ErrorSeverity.WARNING,
      { originalError: error.id }
    );
    
    // Memory recovery would trigger cleanup routines
    if ('gc' in globalThis && typeof (globalThis as any).gc === 'function') {
      (globalThis as any).gc();
    }
    return true;
  };

  // Validation helpers
  const validateRequired = (value: unknown, name: string, context: Record<string, unknown> = {}): boolean => {
    if (value === null || value === undefined) {
      handleError(
        `Required parameter '${name}' is missing`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.ERROR,
        { paramName: name, ...context }
      );
      return false;
    }
    return true;
  };

  const validateType = (
    value: unknown, 
    expectedType: string, 
    name: string, 
    context: Record<string, unknown> = {}
  ): boolean => {
    if (typeof value !== expectedType) {
      handleError(
        `Parameter '${name}' expected ${expectedType}, got ${typeof value}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.ERROR,
        { paramName: name, expectedType, actualType: typeof value, ...context }
      );
      return false;
    }
    return true;
  };

  const validateRange = (
    value: number, 
    min: number, 
    max: number, 
    name: string, 
    context: Record<string, unknown> = {}
  ): boolean => {
    if (value < min || value > max) {
      handleError(
        `Parameter '${name}' must be between ${min} and ${max}, got ${value}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.ERROR,
        { paramName: name, value, min, max, ...context }
      );
      return false;
    }
    return true;
  };

  // Performance monitoring
  const wrapFunction = <T extends (...args: any[]) => any>(
    fn: T, 
    name: string, 
    category: ErrorCategoryType = ErrorCategory.PROCESSING
  ): T => {
    return (function(this: any, ...args: Parameters<T>): ReturnType<T> {
      const start = performance.now();
      
      try {
        const result = fn.apply(this, args);
        
        // Log performance if it's a Promise
        if (result && typeof result.then === 'function') {
          return result.catch((error: Error) => {
            handleError(
              `Async function '${name}' failed: ${error.message}`,
              category,
              ErrorSeverity.ERROR,
              { functionName: name, args: args.length, duration: performance.now() - start }
            );
            throw error;
          });
        }
        
        const duration = performance.now() - start;
        if (duration > 50) { // Log slow operations
          handleError(
            `Function '${name}' took ${duration.toFixed(2)}ms to execute`,
            ErrorCategory.PERFORMANCE,
            ErrorSeverity.WARNING,
            { functionName: name, duration, args: args.length }
          );
        }
        
        return result;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        handleError(
          `Function '${name}' failed: ${errorMessage}`,
          category,
          ErrorSeverity.ERROR,
          { functionName: name, args: args.length, duration: performance.now() - start }
        );
        throw error;
      }
    }) as T;
  };

  // Error boundary for async operations
  const safeAsync = async <T>(operation: () => Promise<T>, fallback: T | null = null): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      handleError(
        `Async operation failed: ${errorMessage}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { hasStack: error instanceof Error && !!error.stack }
      );
      return fallback;
    }
  };

  // Configuration management
  const setLogLevel = (level: ErrorSeverityType): void => {
    if (!Object.values(ErrorSeverity).includes(level)) {
      handleError(
        `Invalid log level: ${level}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING
      );
      return;
    }
    (state.config as any).logLevel = level;
    handleError(
      `Log level changed to: ${level}`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO
    );
  };

  const getErrorHistory = (): ReadonlyArray<StandardError> => {
    return [...state.history];
  };

  const clearErrorHistory = (): void => {
    state.history.length = 0;
    handleError(
      'Error history cleared',
      ErrorCategory.INITIALIZATION, 
      ErrorSeverity.INFO
    );
  };

  const getStatistics = () => {
    const stats = {
      total: state.history.length,
      bySeverity: {} as Record<ErrorSeverityType, number>,
      byCategory: {} as Record<ErrorCategoryType, number>,
      recentErrors: state.history.slice(-10)
    };

    // Count by severity
    (Object.values(ErrorSeverity) as ErrorSeverityType[]).forEach(severity => {
      stats.bySeverity[severity] = state.history.filter(e => e.severity === severity).length;
    });

    // Count by category  
    (Object.values(ErrorCategory) as ErrorCategoryType[]).forEach(category => {
      stats.byCategory[category] = state.history.filter(e => e.category === category).length;
    });

    return stats;
  };

  return {
    // Core error handling
    handleError,
    logError,
    
    // Validation helpers
    validateRequired,
    validateType, 
    validateRange,
    
    // Performance monitoring
    wrapFunction,
    safeAsync,
    
    // Configuration
    setLogLevel,
    
    // History and statistics
    getErrorHistory,
    clearErrorHistory,
    getStatistics,
    
    // Constants
    ErrorSeverity,
    ErrorCategory
  };
};

// Global error handler instance
export const GlobalErrorHandler = createErrorHandler();

// Convenience functions using global handler
export const handleError = GlobalErrorHandler.handleError;
export const validateRequired = GlobalErrorHandler.validateRequired;
export const validateType = GlobalErrorHandler.validateType; 
export const validateRange = GlobalErrorHandler.validateRange;
export const wrapFunction = GlobalErrorHandler.wrapFunction;
export const safeAsync = GlobalErrorHandler.safeAsync;

// Type exports (already declared above)
