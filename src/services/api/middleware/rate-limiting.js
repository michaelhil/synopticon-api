/**
 * Rate Limiting Middleware Module
 * Advanced rate limiting with multiple algorithms and monitoring
 */

/**
 * Create rate limiting middleware
 * @param {Object} config - Rate limiting configuration
 * @returns {Object} Rate limiting middleware functions
 */
export const createRateLimitingMiddleware = (config = {}) => {
  const state = {
    config: {
      // Global defaults
      windowMs: config.windowMs || 15 * 60 * 1000, // 15 minutes
      maxRequests: config.maxRequests || 100,
      algorithm: config.algorithm || 'sliding-window', // 'fixed-window', 'sliding-window', 'token-bucket'
      keyGenerator: config.keyGenerator || ((req) => req.headers.get('x-forwarded-for') || 'anonymous'),
      
      // Skip conditions
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      skipList: config.skipList || [], // IPs to skip
      
      // Response configuration
      message: config.message || 'Too Many Requests',
      statusCode: config.statusCode || 429,
      headers: config.headers !== false,
      
      // Advanced features
      enableVariableWindow: config.enableVariableWindow || false,
      burstAllowance: config.burstAllowance || 0.1, // 10% burst allowance
      
      // Route-specific limits
      routeLimits: config.routeLimits || new Map(),
      
      // Monitoring
      enableMonitoring: config.enableMonitoring !== false,
      logViolations: config.logViolations !== false,
      
      ...config
    },
    
    // Storage for different algorithms
    storage: {
      fixedWindow: new Map(),    // key -> { count, resetTime }
      slidingWindow: new Map(),  // key -> { requests: Array<timestamp> }
      tokenBucket: new Map()     // key -> { tokens, lastRefill }
    },
    
    stats: {
      totalRequests: 0,
      blockedRequests: 0,
      uniqueClients: new Set(),
      violationsByClient: new Map(),
      requestsByEndpoint: new Map(),
      startTime: Date.now()
    }
  };

  /**
   * Get rate limit configuration for specific route
   * @param {string} pathname - Request pathname
   * @returns {Object} Route-specific rate limit config
   */
  const getRouteConfig = (pathname) => {
    // Check for exact match first
    if (state.config.routeLimits.has(pathname)) {
      return { ...state.config, ...state.config.routeLimits.get(pathname) };
    }
    
    // Check for pattern matches
    for (const [pattern, routeConfig] of state.config.routeLimits.entries()) {
      if (pattern.includes('*') || pattern.includes('/')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (regex.test(pathname)) {
          return { ...state.config, ...routeConfig };
        }
      }
    }
    
    return state.config;
  };

  /**
   * Fixed window rate limiting algorithm
   * @param {string} key - Client identifier
   * @param {Object} routeConfig - Route-specific config
   * @returns {Object} Rate limit result
   */
  const checkFixedWindow = (key, routeConfig) => {
    const now = Date.now();
    const windowStart = Math.floor(now / routeConfig.windowMs) * routeConfig.windowMs;
    const resetTime = windowStart + routeConfig.windowMs;
    
    if (!state.storage.fixedWindow.has(key)) {
      state.storage.fixedWindow.set(key, { count: 0, resetTime: resetTime });
    }
    
    const record = state.storage.fixedWindow.get(key);
    
    // Reset if window has passed
    if (now >= record.resetTime) {
      record.count = 0;
      record.resetTime = resetTime;
    }
    
    const allowed = record.count < routeConfig.maxRequests;
    const remaining = Math.max(0, routeConfig.maxRequests - record.count - (allowed ? 1 : 0));
    
    if (allowed) {
      record.count++;
    }
    
    return {
      allowed,
      limit: routeConfig.maxRequests,
      remaining,
      resetTime,
      retryAfter: Math.ceil((resetTime - now) / 1000)
    };
  };

  /**
   * Sliding window rate limiting algorithm
   * @param {string} key - Client identifier
   * @param {Object} routeConfig - Route-specific config
   * @returns {Object} Rate limit result
   */
  const checkSlidingWindow = (key, routeConfig) => {
    const now = Date.now();
    const windowStart = now - routeConfig.windowMs;
    
    if (!state.storage.slidingWindow.has(key)) {
      state.storage.slidingWindow.set(key, { requests: [] });
    }
    
    const record = state.storage.slidingWindow.get(key);
    
    // Remove old requests outside the window
    record.requests = record.requests.filter(timestamp => timestamp > windowStart);
    
    const currentRequests = record.requests.length;
    const allowed = currentRequests < routeConfig.maxRequests;
    
    if (allowed) {
      record.requests.push(now);
    }
    
    // Calculate when the oldest request will expire
    const oldestRequest = record.requests[0] || now;
    const resetTime = oldestRequest + routeConfig.windowMs;
    const retryAfter = Math.ceil((resetTime - now) / 1000);
    
    return {
      allowed,
      limit: routeConfig.maxRequests,
      remaining: Math.max(0, routeConfig.maxRequests - currentRequests - (allowed ? 1 : 0)),
      resetTime,
      retryAfter: Math.max(1, retryAfter)
    };
  };

  /**
   * Token bucket rate limiting algorithm
   * @param {string} key - Client identifier
   * @param {Object} routeConfig - Route-specific config
   * @returns {Object} Rate limit result
   */
  const checkTokenBucket = (key, routeConfig) => {
    const now = Date.now();
    const refillRate = routeConfig.maxRequests / (routeConfig.windowMs / 1000); // tokens per second
    const bucketSize = routeConfig.maxRequests + Math.floor(routeConfig.maxRequests * routeConfig.burstAllowance);
    
    if (!state.storage.tokenBucket.has(key)) {
      state.storage.tokenBucket.set(key, { 
        tokens: bucketSize, 
        lastRefill: now 
      });
    }
    
    const bucket = state.storage.tokenBucket.get(key);
    
    // Refill tokens based on time passed
    const timePassed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = timePassed * refillRate;
    bucket.tokens = Math.min(bucketSize, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    const allowed = bucket.tokens >= 1;
    
    if (allowed) {
      bucket.tokens -= 1;
    }
    
    // Calculate retry after based on when next token will be available
    const retryAfter = allowed ? 0 : Math.ceil((1 - bucket.tokens) / refillRate);
    
    return {
      allowed,
      limit: routeConfig.maxRequests,
      remaining: Math.floor(bucket.tokens),
      resetTime: now + (routeConfig.windowMs * (1 - bucket.tokens / bucketSize)),
      retryAfter
    };
  };

  /**
   * Check rate limit for a client
   * @param {string} key - Client identifier
   * @param {string} pathname - Request pathname
   * @returns {Object} Rate limit result
   */
  const checkRateLimit = (key, pathname) => {
    const routeConfig = getRouteConfig(pathname);
    
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
        return checkFixedWindow(key, routeConfig);
      case 'sliding-window':
        return checkSlidingWindow(key, routeConfig);
      case 'token-bucket':
        return checkTokenBucket(key, routeConfig);
      default:
        console.warn(`Unknown rate limiting algorithm: ${routeConfig.algorithm}`);
        return checkSlidingWindow(key, routeConfig);
    }
  };

  /**
   * Update statistics
   * @param {string} key - Client identifier
   * @param {string} pathname - Request pathname
   * @param {boolean} allowed - Whether request was allowed
   */
  const updateStatistics = (key, pathname, allowed) => {
    if (!state.config.enableMonitoring) return;
    
    state.stats.totalRequests++;
    state.stats.uniqueClients.add(key);
    
    if (!allowed) {
      state.stats.blockedRequests++;
      state.stats.violationsByClient.set(key, 
        (state.stats.violationsByClient.get(key) || 0) + 1
      );
    }
    
    // Track by endpoint
    state.stats.requestsByEndpoint.set(pathname,
      (state.stats.requestsByEndpoint.get(pathname) || 0) + 1
    );
  };

  /**
   * Log rate limit violation
   * @param {string} key - Client identifier
   * @param {string} pathname - Request pathname
   * @param {Object} result - Rate limit result
   * @param {Request} request - HTTP request
   */
  const logViolation = (key, pathname, result, request) => {
    if (!state.config.logViolations) return;
    
    const logData = {
      timestamp: new Date().toISOString(),
      client: key,
      endpoint: pathname,
      limit: result.limit,
      retryAfter: result.retryAfter,
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin')
    };
    
    console.warn('🚦 Rate limit exceeded:', JSON.stringify(logData));
  };

  /**
   * Create rate limit headers
   * @param {Object} result - Rate limit result
   * @returns {Object} Headers object
   */
  const createRateLimitHeaders = (result) => {
    if (!state.config.headers) return {};
    
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
   * Main rate limiting middleware
   * @param {Request} request - HTTP request
   * @param {Function} next - Next middleware function
   * @returns {Response} Response with rate limiting applied
   */
  const rateLimitMiddleware = async (request, next) => {
    const pathname = new URL(request.url).pathname;
    const key = state.config.keyGenerator(request);
    
    // Check rate limit
    const result = checkRateLimit(key, pathname);
    
    // Update statistics
    updateStatistics(key, pathname, result.allowed);
    
    // Handle blocked requests
    if (!result.allowed) {
      logViolation(key, pathname, result, request);
      
      const headers = {
        'Content-Type': 'application/json',
        ...createRateLimitHeaders(result)
      };
      
      return new Response(JSON.stringify({
        error: true,
        message: state.config.message,
        retryAfter: result.retryAfter,
        limit: result.limit,
        timestamp: Date.now()
      }), {
        status: state.config.statusCode,
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

  /**
   * Add route-specific rate limit
   * @param {string} pattern - Route pattern
   * @param {Object} limits - Rate limit configuration
   */
  const addRouteLimit = (pattern, limits) => {
    state.config.routeLimits.set(pattern, limits);
    console.log(`🚦 Added route rate limit: ${pattern} -> ${limits.maxRequests}/${limits.windowMs}ms`);
  };

  /**
   * Remove rate limit data for a client
   * @param {string} key - Client identifier
   */
  const resetClient = (key) => {
    state.storage.fixedWindow.delete(key);
    state.storage.slidingWindow.delete(key);
    state.storage.tokenBucket.delete(key);
    console.log(`🧹 Reset rate limit data for client: ${key}`);
  };

  /**
   * Get rate limiting statistics
   * @returns {Object} Rate limiting statistics
   */
  const getStatistics = () => {
    const uptime = Date.now() - state.stats.startTime;
    
    return {
      totalRequests: state.stats.totalRequests,
      blockedRequests: state.stats.blockedRequests,
      blockRate: state.stats.totalRequests > 0 ? 
        state.stats.blockedRequests / state.stats.totalRequests : 0,
      uniqueClients: state.stats.uniqueClients.size,
      requestRate: state.stats.totalRequests / Math.max(uptime / 1000 / 60, 1), // requests per minute
      topViolators: Array.from(state.stats.violationsByClient.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      topEndpoints: Array.from(state.stats.requestsByEndpoint.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      storageSize: {
        fixedWindow: state.storage.fixedWindow.size,
        slidingWindow: state.storage.slidingWindow.size,
        tokenBucket: state.storage.tokenBucket.size
      },
      uptime,
      timestamp: Date.now()
    };
  };

  /**
   * Clean up old rate limit data
   */
  const cleanup = () => {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean fixed window storage
    for (const [key, record] of state.storage.fixedWindow.entries()) {
      if (now > record.resetTime + state.config.windowMs) {
        state.storage.fixedWindow.delete(key);
        cleaned++;
      }
    }
    
    // Clean sliding window storage
    for (const [key, record] of state.storage.slidingWindow.entries()) {
      record.requests = record.requests.filter(
        timestamp => timestamp > now - state.config.windowMs
      );
      if (record.requests.length === 0) {
        state.storage.slidingWindow.delete(key);
        cleaned++;
      }
    }
    
    // Clean token bucket storage (remove buckets with full tokens and no recent activity)
    for (const [key, bucket] of state.storage.tokenBucket.entries()) {
      if (bucket.tokens >= state.config.maxRequests && 
          now - bucket.lastRefill > state.config.windowMs * 2) {
        state.storage.tokenBucket.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old rate limit records`);
    }
  };

  /**
   * Get health status
   * @returns {Object} Health information
   */
  const getHealthStatus = () => {
    const stats = getStatistics();
    const isHealthy = stats.blockRate < 0.1; // Less than 10% blocked

    return {
      status: isHealthy ? 'healthy' : 'warning',
      blockRate: Math.round(stats.blockRate * 100),
      totalRequests: stats.totalRequests,
      blockedRequests: stats.blockedRequests,
      issues: isHealthy ? [] : ['High block rate - potential abuse detected']
    };
  };

  // Set up periodic cleanup
  const cleanupInterval = setInterval(cleanup, state.config.windowMs);

  return {
    // Core middleware
    rateLimitMiddleware,
    
    // Management
    addRouteLimit,
    resetClient,
    cleanup,
    
    // Monitoring
    getStatistics,
    getHealthStatus,
    
    // Configuration
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
      console.log('🔧 Rate limiting configuration updated');
    },
    getConfig: () => ({ ...state.config }),
    
    // Utilities
    checkRateLimit: (key, pathname) => checkRateLimit(key, pathname),
    
    // Cleanup
    destroy: () => {
      clearInterval(cleanupInterval);
      console.log('🧹 Rate limiting middleware destroyed');
    }
  };
};