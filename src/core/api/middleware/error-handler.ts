/**
 * Error Handler Middleware Module - TypeScript Implementation
 * Centralized error handling and response formatting
 */

export interface ErrorHandlerConfig {
  enableStackTrace?: boolean;
  enableErrorLogging?: boolean;
  enableDetailedErrors?: boolean;
  errorCodeMapping?: Record<string | number, number>;
  excludeFromLogging?: string[];
  maxErrorLength?: number;
}

export interface ErrorResponse {
  error: boolean;
  message: string;
  status: number;
  timestamp: number;
  requestId: string;
  path: string;
  code?: string | number;
  type?: string;
  stack?: string;
  details?: any;
  context?: any;
}

export interface ErrorStatistics {
  totalErrors: number;
  errorRate: number;
  errorsByType: [string, number][];
  errorsByStatus: [number, number][];
  lastError: {
    name: string;
    message: string;
    status: number;
    timestamp: number;
  } | null;
  uptime: number;
  topErrorTypes: [string, number][];
  timestamp: number;
}

export interface ErrorHealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  errorRate: number;
  totalErrors: number;
  lastError: any;
  issues: string[];
}

export interface CustomError extends Error {
  status?: number;
  code?: string | number;
  details?: any;
  context?: any;
  validation?: any;
}

export interface ErrorHandlerMiddleware {
  handleError: (error: CustomError, request?: Request) => Response;
  asyncErrorWrapper: <T extends any[], R>(handler: (request: Request, ...args: T) => Promise<R>) => (request: Request, ...args: T) => Promise<R | Response>;
  createError: {
    validation: (message: string, details?: any) => CustomError;
    unauthorized: (message?: string) => CustomError;
    forbidden: (message?: string) => CustomError;
    notFound: (message?: string) => CustomError;
    conflict: (message?: string) => CustomError;
    tooManyRequests: (message?: string) => CustomError;
    internal: (message?: string, context?: any) => CustomError;
  };
  getStatistics: () => ErrorStatistics;
  resetStatistics: () => void;
  getHealthStatus: () => ErrorHealthStatus;
  updateConfig: (updates: Partial<ErrorHandlerConfig>) => void;
  getConfig: () => ErrorHandlerConfig;
}

/**
 * Create error handling middleware
 */
export const createErrorHandlerMiddleware = (config: ErrorHandlerConfig = {}): ErrorHandlerMiddleware => {
  const state = {
    config: {
      enableStackTrace: config.enableStackTrace !== false,
      enableErrorLogging: config.enableErrorLogging !== false,
      enableDetailedErrors: config.enableDetailedErrors || false,
      errorCodeMapping: config.errorCodeMapping || {},
      excludeFromLogging: config.excludeFromLogging || [],
      maxErrorLength: config.maxErrorLength || 1000,
      ...config
    },
    stats: {
      totalErrors: 0,
      errorsByType: new Map<string, number>(),
      errorsByStatus: new Map<number, number>(),
      lastError: null as {
        name: string;
        message: string;
        status: number;
        timestamp: number;
      } | null,
      startTime: Date.now()
    }
  };

  /**
   * Format error response based on configuration
   */
  const formatErrorResponse = (error: CustomError, request?: Request): { response: ErrorResponse; status: number } => {
    const timestamp = Date.now();
    const url = request ? request.url : 'unknown';
    const method = request ? request.method : 'unknown';
    
    // Determine status code
    let status = 500;
    if (error.status) {
      status = error.status;
    } else if (error.name === 'ValidationError') {
      status = 400;
    } else if (error.name === 'UnauthorizedError') {
      status = 401;
    } else if (error.name === 'ForbiddenError') {
      status = 403;
    } else if (error.name === 'NotFoundError') {
      status = 404;
    } else if (error.name === 'ConflictError') {
      status = 409;
    } else if (error.name === 'TooManyRequestsError') {
      status = 429;
    }

    // Map custom error codes if configured
    if (error.code && state.config.errorCodeMapping[error.code]) {
      status = state.config.errorCodeMapping[error.code];
    }

    // Truncate error message if too long
    let message = error.message || 'Internal Server Error';
    if (message.length > state.config.maxErrorLength) {
      message = `${message.substring(0, state.config.maxErrorLength)}...`;
    }

    // Base response
    const response: ErrorResponse = {
      error: true,
      message,
      status,
      timestamp,
      requestId: generateRequestId(),
      path: url
    };

    // Add error code if present
    if (error.code) {
      response.code = error.code;
    }

    // Add error type
    if (error.name && error.name !== 'Error') {
      response.type = error.name;
    }

    // Add stack trace in development mode
    if (state.config.enableStackTrace && state.config.enableDetailedErrors) {
      response.stack = error.stack;
    }

    // Add validation details if present
    if (error.details || error.validation) {
      response.details = error.details || error.validation;
    }

    // Add context if present
    if (error.context) {
      response.context = error.context;
    }

    return { response, status };
  };

  /**
   * Generate unique request ID for error tracking
   */
  const generateRequestId = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `err_${timestamp}_${random}`;
  };

  /**
   * Log error with context
   */
  const logError = (error: CustomError, request: Request | undefined, errorResponse: ErrorResponse): void => {
    if (!state.config.enableErrorLogging) return;
    
    // Skip excluded errors
    if (state.config.excludeFromLogging.includes(error.name)) {
      return;
    }

    // Skip logging for certain status codes (like 404)
    if (errorResponse.status === 404) {
      return;
    }

    const logData = {
      timestamp: new Date().toISOString(),
      requestId: errorResponse.requestId,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      request: {
        method: request ? request.method : 'unknown',
        url: request ? request.url : 'unknown',
        userAgent: request ? request.headers.get('user-agent') : null,
        origin: request ? request.headers.get('origin') : null
      },
      response: {
        status: errorResponse.status
      }
    };

    // Log based on severity
    if (errorResponse.status >= 500) {
      console.error('🚨 Server Error:', JSON.stringify(logData, null, 2));
    } else if (errorResponse.status >= 400) {
      console.warn('⚠️  Client Error:', logData.requestId, error.message);
    } else {
      console.log('ℹ️  Error:', logData.requestId, error.message);
    }
  };

  /**
   * Update error statistics
   */
  const updateStatistics = (error: CustomError, status: number): void => {
    state.stats.totalErrors++;
    state.stats.lastError = {
      name: error.name,
      message: error.message,
      status,
      timestamp: Date.now()
    };

    // Track by error type
    const errorType = error.name || 'UnknownError';
    state.stats.errorsByType.set(
      errorType, 
      (state.stats.errorsByType.get(errorType) || 0) + 1
    );

    // Track by status code
    state.stats.errorsByStatus.set(
      status, 
      (state.stats.errorsByStatus.get(status) || 0) + 1
    );
  };

  /**
   * Main error handling middleware
   */
  const handleError = (error: CustomError, request?: Request): Response => {
    try {
      const { response, status } = formatErrorResponse(error, request);
      
      // Log the error
      logError(error, request, response);
      
      // Update statistics
      updateStatistics(error, status);

      // Create HTTP response
      return new Response(JSON.stringify(response), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-ID': response.requestId,
          'X-Content-Type-Options': 'nosniff'
        }
      });
      
    } catch (handlingError) {
      console.error('🔥 Error in error handler:', handlingError);
      
      // Fallback response
      return new Response(JSON.stringify({
        error: true,
        message: 'Internal error processing request',
        timestamp: Date.now(),
        status: 500
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  };

  /**
   * Async error wrapper for middleware chains
   */
  const asyncErrorWrapper = <T extends any[], R>(
    handler: (request: Request, ...args: T) => Promise<R>
  ) => {
    return async (request: Request, ...args: T): Promise<R | Response> => {
      try {
        return await handler(request, ...args);
      } catch (error) {
        return handleError(error as CustomError, request);
      }
    };
  };

  /**
   * Create standard error types
   */
  const createError = {
    validation: (message: string, details: any = null): CustomError => {
      const error = new Error(message) as CustomError;
      error.name = 'ValidationError';
      error.status = 400;
      if (details) error.details = details;
      return error;
    },
    
    unauthorized: (message = 'Unauthorized'): CustomError => {
      const error = new Error(message) as CustomError;
      error.name = 'UnauthorizedError';
      error.status = 401;
      return error;
    },
    
    forbidden: (message = 'Forbidden'): CustomError => {
      const error = new Error(message) as CustomError;
      error.name = 'ForbiddenError';
      error.status = 403;
      return error;
    },
    
    notFound: (message = 'Not Found'): CustomError => {
      const error = new Error(message) as CustomError;
      error.name = 'NotFoundError';
      error.status = 404;
      return error;
    },
    
    conflict: (message = 'Conflict'): CustomError => {
      const error = new Error(message) as CustomError;
      error.name = 'ConflictError';
      error.status = 409;
      return error;
    },
    
    tooManyRequests: (message = 'Too Many Requests'): CustomError => {
      const error = new Error(message) as CustomError;
      error.name = 'TooManyRequestsError';
      error.status = 429;
      return error;
    },
    
    internal: (message = 'Internal Server Error', context: any = null): CustomError => {
      const error = new Error(message) as CustomError;
      error.name = 'InternalError';
      error.status = 500;
      if (context) error.context = context;
      return error;
    }
  };

  /**
   * Get error statistics
   */
  const getStatistics = (): ErrorStatistics => {
    const uptime = Date.now() - state.stats.startTime;
    
    return {
      totalErrors: state.stats.totalErrors,
      errorRate: state.stats.totalErrors / Math.max(uptime / 1000 / 60, 1), // errors per minute
      errorsByType: Array.from(state.stats.errorsByType.entries()),
      errorsByStatus: Array.from(state.stats.errorsByStatus.entries()),
      lastError: state.stats.lastError,
      uptime,
      topErrorTypes: Array.from(state.stats.errorsByType.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      timestamp: Date.now()
    };
  };

  /**
   * Reset error statistics
   */
  const resetStatistics = (): void => {
    state.stats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByStatus: new Map(),
      lastError: null,
      startTime: Date.now()
    };
    console.log('📊 Error statistics reset');
  };

  /**
   * Health check for error handling system
   */
  const getHealthStatus = (): ErrorHealthStatus => {
    const stats = getStatistics();
    const recentErrorRate = stats.errorRate;
    const isHealthy = recentErrorRate < 10; // Less than 10 errors per minute

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      errorRate: Math.round(recentErrorRate * 100) / 100,
      totalErrors: stats.totalErrors,
      lastError: stats.lastError,
      issues: isHealthy ? [] : ['High error rate detected']
    };
  };

  return {
    // Core error handling
    handleError,
    asyncErrorWrapper,
    
    // Error creation utilities
    createError,
    
    // Monitoring
    getStatistics,
    resetStatistics,
    getHealthStatus,
    
    // Configuration
    updateConfig: (updates: Partial<ErrorHandlerConfig>) => {
      state.config = { ...state.config, ...updates };
      console.log('🔧 Error handler configuration updated');
    },
    getConfig: (): ErrorHandlerConfig => ({ ...state.config })
  };
};