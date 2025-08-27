/**
 * MCP Error Handling Utilities
 * Standardized error handling for MCP operations
 */

import { createLogger } from './logger.ts';

const logger = createLogger('ErrorHandler');

export enum MCPErrorCode {
  SYNOPTICON_UNAVAILABLE = 'SYNOPTICON_UNAVAILABLE',
  INVALID_TOOL_CALL = 'INVALID_TOOL_CALL',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export class MCPError extends Error {
  public readonly code: MCPErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    code: MCPErrorCode,
    message: string,
    context?: Record<string, unknown>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.context = context;
    this.originalError = originalError;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Create standardized error response for MCP
 */
export const createErrorResponse = (error: MCPError) => {
  logger.error(`MCP Error: ${error.message}`, error.originalError, {
    code: error.code,
    context: error.context
  });

  return {
    error: {
      code: error.code,
      message: error.message,
      data: error.context
    }
  };
};

/**
 * Wrap async operations with error handling
 */
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: Record<string, unknown> = {}
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }

    // Convert standard errors to MCP errors
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        throw new MCPError(
          MCPErrorCode.NETWORK_ERROR,
          'Network request failed',
          context,
          error
        );
      }

      if (error.message.includes('timeout')) {
        throw new MCPError(
          MCPErrorCode.TIMEOUT_ERROR,
          'Operation timed out',
          context,
          error
        );
      }

      throw new MCPError(
        MCPErrorCode.TOOL_EXECUTION_FAILED,
        error.message,
        context,
        error
      );
    }

    // Handle unknown errors
    throw new MCPError(
      MCPErrorCode.TOOL_EXECUTION_FAILED,
      'Unknown error occurred',
      { ...context, originalError: String(error) }
    );
  }
};

/**
 * Validate required parameters
 */
export const validateRequired = (
  params: Record<string, unknown>,
  required: string[]
): void => {
  const missing = required.filter(key => !(key in params) || params[key] == null);
  
  if (missing.length > 0) {
    throw new MCPError(
      MCPErrorCode.VALIDATION_ERROR,
      `Missing required parameters: ${missing.join(', ')}`,
      { missing, provided: Object.keys(params) }
    );
  }
};

/**
 * Create connection health checker
 */
export const createHealthChecker = (
  healthCheckUrl: string,
  timeoutMs: number = 5000
) => {
  return async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(healthCheckUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.warn('Health check failed', { url: healthCheckUrl, error });
      return false;
    }
  };
};