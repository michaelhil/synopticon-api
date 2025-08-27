/**
 * Middleware Module Index - TypeScript Implementation
 * Aggregates all middleware modules into a unified interface with comprehensive type safety
 */

import { createCORSMiddleware } from './cors.js';
import { createErrorHandlerMiddleware } from './error-handler.js';
import { createRateLimitingMiddleware } from './rate-limiting.js';
import {
  type MiddlewareSystem,
  type MiddlewareSystemFactory,
  type MiddlewareConfig,
  type MiddlewareStatistics,
  type MiddlewareHealth,
  type MiddlewareType,
  type RequestHandler,
  type MiddlewareError,
  type ComponentHealth,
  type CORSMiddleware,
  type ErrorHandlerMiddleware,
  type RateLimitMiddleware,
  type RateLimitConfig
} from './middleware-types.js';

/**
 * Create unified middleware system with comprehensive type safety
 */
export const createMiddlewareSystem: MiddlewareSystemFactory = (config: MiddlewareConfig = {}): MiddlewareSystem => {
  // Initialize individual middleware modules
  const corsMiddleware = createCORSMiddleware(config.cors || {}) as CORSMiddleware;
  const errorHandler = createErrorHandlerMiddleware(config.errorHandler || {}) as ErrorHandlerMiddleware;
  const rateLimiter = createRateLimitingMiddleware(config.rateLimiting || {}) as RateLimitMiddleware;

  /**
   * Compose middleware chain for HTTP requests
   */
  const processRequest = async (request: Request, handler: RequestHandler): Promise<Response> => {
    try {
      // Apply CORS and rate limiting first
      return await corsMiddleware.corsMiddleware(request, async (req: Request) => {
        return await rateLimiter.rateLimitMiddleware(req, handler);
      });
    } catch (error) {
      // Let error handler process any errors
      return errorHandler.handleError(error as Error, request);
    }
  };

  /**
   * Create middleware-aware request handler wrapper
   */
  const withMiddleware = (handler: RequestHandler): RequestHandler => {
    return async (request: Request, ...args: any[]): Promise<Response> => {
      return await processRequest(request, async (req: Request) => {
        return await handler(req, ...args);
      });
    };
  };

  /**
   * Get comprehensive middleware statistics
   */
  const getStatistics = (): MiddlewareStatistics => {
    return {
      cors: corsMiddleware.getStatistics(),
      rateLimiting: rateLimiter.getStatistics(),
      errorHandling: errorHandler.getStatistics(),
      timestamp: Date.now()
    };
  };

  /**
   * Get health status for all middleware
   */
  const getHealthStatus = (): MiddlewareHealth => {
    const corsHealth = corsMiddleware.getHealthStatus();
    const rateLimitHealth = rateLimiter.getHealthStatus();
    const errorHealth = errorHandler.getHealthStatus();
    
    const allHealthy = [corsHealth, rateLimitHealth, errorHealth].every(h => h.status === 'healthy');
    const issues: string[] = [
      ...(corsHealth.issues || []),
      ...(rateLimitHealth.issues || []),
      ...(errorHealth.issues || [])
    ];

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      components: {
        cors: corsHealth,
        rateLimiting: rateLimitHealth,
        errorHandling: errorHealth
      },
      issues,
      timestamp: Date.now()
    };
  };

  /**
   * Update configuration for specific middleware
   */
  const updateMiddlewareConfig = (middleware: MiddlewareType, updates: any): void => {
    switch (middleware) {
      case 'cors':
        corsMiddleware.updateConfig(updates);
        break;
      case 'rateLimiting':
        rateLimiter.updateConfig(updates);
        break;
      case 'errorHandler':
        errorHandler.updateConfig(updates);
        break;
      default:
        console.warn(`Unknown middleware: ${middleware}`);
    }
  };

  /**
   * Add CORS allowed origin
   */
  const addAllowedOrigin = (origin: string): void => {
    corsMiddleware.addAllowedOrigin(origin);
  };

  /**
   * Add route-specific rate limit
   */
  const addRouteRateLimit = (pattern: string, limits: RateLimitConfig): void => {
    rateLimiter.addRouteLimit(pattern, limits);
  };

  /**
   * Reset rate limit for specific client
   */
  const resetClientRateLimit = (clientKey: string): void => {
    rateLimiter.resetClient(clientKey);
  };

  /**
   * Cleanup all middleware resources
   */
  const cleanup = (): void => {
    console.log('🧹 Cleaning up middleware system...');
    
    try {
      rateLimiter.destroy();
      errorHandler.resetStatistics();
      corsMiddleware.resetStatistics();
      
      console.log('✅ Middleware system cleanup complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Warning during middleware cleanup:', message);
    }
  };

  /**
   * Create middleware error
   */
  const createError = (message: string, status: number = 400, code?: string): MiddlewareError => {
    return errorHandler.createError(message, status, code);
  };

  return {
    // Core middleware processing
    processRequest,
    withMiddleware,
    
    // Individual middleware access
    cors: corsMiddleware,
    errorHandler,
    rateLimiter,
    
    // Management functions
    getStatistics,
    getHealthStatus,
    updateMiddlewareConfig,
    addAllowedOrigin,
    addRouteRateLimit,
    resetClientRateLimit,
    cleanup,
    
    // Utility functions for common error responses
    createError,
    
    // Direct middleware functions (for legacy compatibility)
    handleCORS: corsMiddleware.corsMiddleware,
    handleError: errorHandler.handleError,
    handleRateLimit: rateLimiter.rateLimitMiddleware
  };
};

// Re-export types for external use
export type {
  MiddlewareSystem,
  MiddlewareConfig,
  MiddlewareStatistics,
  MiddlewareHealth,
  MiddlewareType,
  RequestHandler,
  MiddlewareError,
  ComponentHealth,
  CORSMiddleware,
  ErrorHandlerMiddleware,
  RateLimitMiddleware,
  CORSConfig,
  RateLimitConfig,
  ErrorHandlerConfig
} from './middleware-types.js';