/**
 * Middleware Module Index
 * Aggregates all middleware modules into a unified interface
 */

import { createCORSMiddleware } from './cors.js';
import { createErrorHandlerMiddleware } from './error-handler.js';
import { createRateLimitingMiddleware } from './rate-limiting.js';

/**
 * Create unified middleware system
 * @param {Object} config - Middleware configuration
 * @returns {Object} Middleware system instance
 */
export const createMiddlewareSystem = (config = {}) => {
  // Initialize individual middleware modules
  const corsMiddleware = createCORSMiddleware(config.cors || {});
  const errorHandler = createErrorHandlerMiddleware(config.errorHandler || {});
  const rateLimiter = createRateLimitingMiddleware(config.rateLimiting || {});

  /**
   * Compose middleware chain for HTTP requests
   * @param {Request} request - HTTP request
   * @param {Function} handler - Final request handler
   * @returns {Response} HTTP response
   */
  const processRequest = async (request, handler) => {
    try {
      // Apply CORS and rate limiting first
      return await corsMiddleware.corsMiddleware(request, async (req) => {
        return await rateLimiter.rateLimitMiddleware(req, handler);
      });
    } catch (error) {
      // Let error handler process any errors
      return errorHandler.handleError(error, request);
    }
  };

  /**
   * Create middleware-aware request handler wrapper
   * @param {Function} handler - Original handler function
   * @returns {Function} Wrapped handler with middleware
   */
  const withMiddleware = (handler) => {
    return async (request, ...args) => {
      return await processRequest(request, async (req) => {
        return await handler(req, ...args);
      });
    };
  };

  /**
   * Get comprehensive middleware statistics
   * @returns {Object} Combined statistics from all middleware
   */
  const getStatistics = () => {
    return {
      cors: corsMiddleware.getStatistics(),
      rateLimiting: rateLimiter.getStatistics(),
      errorHandling: errorHandler.getStatistics(),
      timestamp: Date.now()
    };
  };

  /**
   * Get health status for all middleware
   * @returns {Object} Combined health status
   */
  const getHealthStatus = () => {
    const corsHealth = corsMiddleware.getHealthStatus();
    const rateLimitHealth = rateLimiter.getHealthStatus();
    const errorHealth = errorHandler.getHealthStatus();
    
    const allHealthy = [corsHealth, rateLimitHealth, errorHealth].every(h => h.status === 'healthy');
    const issues = [
      ...corsHealth.issues || [],
      ...rateLimitHealth.issues || [],
      ...errorHealth.issues || []
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
   * @param {string} middleware - Middleware name
   * @param {Object} updates - Configuration updates
   */
  const updateMiddlewareConfig = (middleware, updates) => {
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
   * @param {string} origin - Origin to allow
   */
  const addAllowedOrigin = (origin) => {
    corsMiddleware.addAllowedOrigin(origin);
  };

  /**
   * Add route-specific rate limit
   * @param {string} pattern - Route pattern
   * @param {Object} limits - Rate limit configuration
   */
  const addRouteRateLimit = (pattern, limits) => {
    rateLimiter.addRouteLimit(pattern, limits);
  };

  /**
   * Reset rate limit for specific client
   * @param {string} clientKey - Client identifier
   */
  const resetClientRateLimit = (clientKey) => {
    rateLimiter.resetClient(clientKey);
  };

  /**
   * Cleanup all middleware resources
   */
  const cleanup = () => {
    console.log('🧹 Cleaning up middleware system...');
    
    try {
      rateLimiter.destroy();
      errorHandler.resetStatistics();
      corsMiddleware.resetStatistics();
      
      console.log('✅ Middleware system cleanup complete');
    } catch (error) {
      console.warn('Warning during middleware cleanup:', error.message);
    }
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
    createError: errorHandler.createError,
    
    // Direct middleware functions
    handleCORS: corsMiddleware.corsMiddleware,
    handleError: errorHandler.handleError,
    handleRateLimit: rateLimiter.rateLimitMiddleware
  };
};