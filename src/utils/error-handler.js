/**
 * Comprehensive Error Handling System
 * Provides standardized error handling, logging controls, and recovery mechanisms
 */

// Error severity levels
export const ErrorSeverity = {
  FATAL: 'fatal',
  ERROR: 'error', 
  WARNING: 'warning',
  INFO: 'info',
  DEBUG: 'debug'
};

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
};

// Global error handling configuration
let errorConfig = {
  logLevel: ErrorSeverity.WARNING,
  enableConsole: true,
  enableCollection: false,
  maxErrorHistory: 100,
  onError: null,
  enableRecovery: true
};

// Error history for debugging
const errorHistory = [];

/**
 * Creates a comprehensive error handler system
 */
export const createErrorHandler = (config = {}) => {
  // Merge configuration
  errorConfig = { ...errorConfig, ...config };
  
  const state = {
    config: errorConfig,
    history: [],
    recoveryAttempts: new Map()
  };

  // Severity level ordering for filtering
  const severityLevels = {
    [ErrorSeverity.DEBUG]: 0,
    [ErrorSeverity.INFO]: 1,
    [ErrorSeverity.WARNING]: 2,
    [ErrorSeverity.ERROR]: 3,
    [ErrorSeverity.FATAL]: 4
  };

  const shouldLog = (severity) => {
    const configLevel = severityLevels[state.config.logLevel] || 2;
    const messagLevel = severityLevels[severity] || 2;
    return messagLevel >= configLevel;
  };

  const createStandardError = (message, category, severity = ErrorSeverity.ERROR, context = {}) => {
    const timestamp = new Date().toISOString();
    const error = {
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

  const logError = (error) => {
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

  const handleError = (message, category, severity = ErrorSeverity.ERROR, context = {}) => {
    const error = createStandardError(message, category, severity, context);
    logError(error);
    
    // Skip recovery for INFO level messages to avoid interference with initialization
    if (severity !== ErrorSeverity.FATAL && severity !== ErrorSeverity.INFO && state.config.enableRecovery) {
      attemptRecovery(error);
    }
    
    return error;
  };

  const attemptRecovery = (error) => {
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

  const recoverWebGL = (error) => {
    handleError(
      'Attempting WebGL context recovery',
      ErrorCategory.WEBGL,
      ErrorSeverity.INFO,
      { originalError: error.id }
    );
    
    // WebGL context recovery implementation
    try {
      const canvas = error.context?.canvas || document.querySelector('canvas');
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
      if (gl.isContextLost && gl.isContextLost()) {
        handleError(
          'WebGL context is lost, waiting for restoration',
          ErrorCategory.WEBGL,
          ErrorSeverity.WARNING
        );

        // Set up context restoration handler
        const handleContextRestored = () => {
          console.info('[INFO] [WEBGL] WebGL context restored successfully');
          
          // Trigger reinitialization if callback available
          if (error.context?.onContextRestored) {
            error.context.onContextRestored();
          }
          
          canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };

        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return true; // Recovery attempt in progress
      }

      // Context is not lost, try other recovery strategies
      
      // Clear any GL errors
      let glError;
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
        recoveryError: recoveryError.message,
        stack: recoveryError.stack
      });
      
      return false;
    }
  };

  const recoverCamera = (error) => {
    handleError(
      'Attempting camera recovery',
      ErrorCategory.CAMERA, 
      ErrorSeverity.INFO,
      { originalError: error.id }
    );
    
    // Camera recovery could involve re-initializing permissions
    return true;
  };

  const recoverMemory = (error) => {
    handleError(
      'Attempting memory cleanup and recovery',
      ErrorCategory.MEMORY,
      ErrorSeverity.WARNING,
      { originalError: error.id }
    );
    
    // Memory recovery would trigger cleanup routines
    if (globalThis.gc) {
      globalThis.gc();
    }
    return true;
  };

  // Validation helpers
  const validateRequired = (value, name, context = {}) => {
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

  const validateType = (value, expectedType, name, context = {}) => {
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

  const validateRange = (value, min, max, name, context = {}) => {
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
  const wrapFunction = (fn, name, category = ErrorCategory.PROCESSING) => {
    return function(...args) {
      const start = performance.now();
      
      try {
        const result = fn.apply(this, args);
        
        // Log performance if it's a Promise
        if (result && typeof result.then === 'function') {
          return result.catch(error => {
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
        handleError(
          `Function '${name}' failed: ${error.message}`,
          category,
          ErrorSeverity.ERROR,
          { functionName: name, args: args.length, duration: performance.now() - start }
        );
        throw error;
      }
    };
  };

  // Error boundary for async operations
  const safeAsync = async (operation, fallback = null) => {
    try {
      return await operation();
    } catch (error) {
      handleError(
        `Async operation failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { hasStack: !!error.stack }
      );
      return fallback;
    }
  };

  // Configuration management
  const setLogLevel = (level) => {
    if (!Object.values(ErrorSeverity).includes(level)) {
      handleError(
        `Invalid log level: ${level}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING
      );
      return;
    }
    state.config.logLevel = level;
    handleError(
      `Log level changed to: ${level}`,
      ErrorCategory.INITIALIZATION,
      ErrorSeverity.INFO
    );
  };

  const getErrorHistory = () => {
    return [...state.history];
  };

  const clearErrorHistory = () => {
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
      bySeverity: {},
      byCategory: {},
      recentErrors: state.history.slice(-10)
    };

    // Count by severity
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = state.history.filter(e => e.severity === severity).length;
    });

    // Count by category  
    Object.values(ErrorCategory).forEach(category => {
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