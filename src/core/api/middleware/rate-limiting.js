/**
 * Rate Limiting Middleware Module
 * Advanced rate limiting with multiple algorithms and monitoring
 */

import { checkFixedWindow, checkSlidingWindow, checkTokenBucket } from './rate-limiting-algorithms.js';
import { createRateLimitConfig } from '../../../core/configuration/consolidated-config-factory.js';
import { createRateLimitStats } from './rate-limiting-stats.js';
import { createRateLimitStorage } from './rate-limiting-storage.js';

/**
 * Create rate limiting middleware
 * @param {Object} config - Rate limiting configuration
 * @returns {Object} Rate limiting middleware functions
 */
export const createRateLimitingMiddleware = (config = {}) => {
  // Initialize components
  const configManager = createRateLimitConfig(config);
  const stats = createRateLimitStats(config.enableMonitoring !== false, config.logViolations !== false);
  const storageManager = createRateLimitStorage(config.windowMs || 15 * 60 * 1000);

  /**
   * Check rate limit for a client
   * @param {string} key - Client identifier
   * @param {string} pathname - Request pathname
   * @returns {Object} Rate limit result
   */
  const checkRateLimit = (key, pathname) => {
    const routeConfig = configManager.getRouteConfig(pathname);
    
    // Skip if client is in skip list
    if (routeConfig.skipList.includes(key)) {
      return {
        allowed: true,
        limit: routeConfig.maxRequests,
        remaining: routeConfig.maxRequests,
        resetTime: Date.now() + routeConfig.windowMs,
        retryAfter: 0,
        skipped: true
      };
    }
    
    // Apply algorithm
    switch (routeConfig.algorithm) {
    case 'fixed-window':
      return checkFixedWindow(storageManager.storage.fixedWindow, key, routeConfig);
    case 'sliding-window':
      return checkSlidingWindow(storageManager.storage.slidingWindow, key, routeConfig);
    case 'token-bucket':
      return checkTokenBucket(storageManager.storage.tokenBucket, key, routeConfig);
    default:
      console.warn(`Unknown rate limiting algorithm: ${routeConfig.algorithm}`);
      return checkSlidingWindow(storageManager.storage.slidingWindow, key, routeConfig);
    }
  };

  /**
   * Create rate limit headers
   * @param {Object} result - Rate limit result
   * @returns {Object} Headers object
   */
  const createRateLimitHeaders = (result) => {
    const currentConfig = configManager.getConfig();
    if (!currentConfig.headers) return {};
    
    const headers = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(result.resetTime / 1000).toString()
    };
    
    if (!result.allowed) {
      headers['Retry-After'] = result.retryAfter.toString();
    }
    
    return headers;
  };

  /**
   * Main rate limiting middleware for Bun.serve
   * @param {Request} request - HTTP request
   * @param {Function} next - Next middleware function
   * @returns {Response} Response with rate limiting applied
   */
  const rateLimitMiddleware = async (request, next) => {
    const {pathname} = new URL(request.url);
    const currentConfig = configManager.getConfig();
    const key = currentConfig.keyGenerator(request);
    
    // Check rate limit
    const result = checkRateLimit(key, pathname);
    
    // Update statistics
    stats.updateStatistics(key, pathname, result.allowed);
    
    // Handle blocked requests
    if (!result.allowed) {
      stats.logViolation(key, pathname, result, request);
      
      const headers = {
        'Content-Type': 'application/json',
        ...createRateLimitHeaders(result)
      };
      
      return new Response(JSON.stringify({
        error: true,
        message: currentConfig.message,
        retryAfter: result.retryAfter,
        limit: result.limit,
        timestamp: Date.now()
      }), {
        status: currentConfig.statusCode,
        headers
      });
    }
    
    // Process request
    const response = await next(request);
    
    // Add rate limit headers to successful responses
    const rateLimitHeaders = createRateLimitHeaders(result);
    if (Object.keys(rateLimitHeaders).length > 0) {
      const newHeaders = new Headers(response.headers);
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }
    
    return response;
  };

  // Set up periodic cleanup
  const currentConfig = configManager.getConfig();
  const cleanupInterval = setInterval(() => {
    storageManager.cleanup(currentConfig.maxRequests);
  }, currentConfig.windowMs);

  return {
    // Core middleware
    rateLimitMiddleware,
    
    // Management
    addRouteLimit: configManager.addRouteLimit,
    resetClient: storageManager.resetClient,
    cleanup: () => storageManager.cleanup(currentConfig.maxRequests),
    
    // Monitoring
    getStatistics: () => ({
      ...stats.getStatistics(),
      storageSize: storageManager.getStorageSize()
    }),
    getHealthStatus: stats.getHealthStatus,
    
    // Configuration
    updateConfig: configManager.updateConfig,
    getConfig: configManager.getConfig,
    
    // Utilities
    checkRateLimit,
    
    // Cleanup
    destroy: () => {
      clearInterval(cleanupInterval);
      console.log('🧹 Rate limiting middleware destroyed');
    }
  };
};
