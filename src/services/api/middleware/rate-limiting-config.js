/**
 * Configuration management for rate limiting
 */

export const createRateLimitConfig = (config = {}) => {
  const rateLimitConfig = {
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
  };

  /**
   * Get rate limit configuration for specific route
   * @param {string} pathname - Request pathname
   * @returns {Object} Route-specific rate limit config
   */
  const getRouteConfig = (pathname) => {
    // Check for exact match first
    if (rateLimitConfig.routeLimits.has(pathname)) {
      return { ...rateLimitConfig, ...rateLimitConfig.routeLimits.get(pathname) };
    }
    
    // Check for pattern matches
    for (const [pattern, routeConfig] of rateLimitConfig.routeLimits.entries()) {
      if (pattern.includes('*') || pattern.includes('/')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (regex.test(pathname)) {
          return { ...rateLimitConfig, ...routeConfig };
        }
      }
    }
    
    return rateLimitConfig;
  };

  /**
   * Add route-specific rate limit
   * @param {string} pattern - Route pattern
   * @param {Object} limits - Rate limit configuration
   */
  const addRouteLimit = (pattern, limits) => {
    rateLimitConfig.routeLimits.set(pattern, limits);
    console.log(`🚦 Added route rate limit: ${pattern} -> ${limits.maxRequests}/${limits.windowMs}ms`);
  };

  /**
   * Update configuration
   * @param {Object} updates - Configuration updates
   */
  const updateConfig = (updates) => {
    Object.assign(rateLimitConfig, updates);
    console.log('🔧 Rate limiting configuration updated');
  };

  return {
    getRouteConfig,
    addRouteLimit,
    updateConfig,
    getConfig: () => ({ ...rateLimitConfig })
  };
};