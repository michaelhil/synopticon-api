/**
 * Statistics and monitoring for rate limiting
 */

export const createRateLimitStats = (enableMonitoring = true, logViolations = false) => {
  const stats = {
    totalRequests: 0,
    blockedRequests: 0,
    uniqueClients: new Set(),
    violationsByClient: new Map(),
    requestsByEndpoint: new Map(),
    startTime: Date.now()
  };

  /**
   * Update statistics
   * @param {string} key - Client identifier
   * @param {string} pathname - Request pathname
   * @param {boolean} allowed - Whether request was allowed
   */
  const updateStatistics = (key, pathname, allowed) => {
    if (!enableMonitoring) return;
    
    stats.totalRequests++;
    stats.uniqueClients.add(key);
    
    if (!allowed) {
      stats.blockedRequests++;
      stats.violationsByClient.set(key, 
        (stats.violationsByClient.get(key) || 0) + 1
      );
    }
    
    // Track by endpoint
    stats.requestsByEndpoint.set(pathname,
      (stats.requestsByEndpoint.get(pathname) || 0) + 1
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
    if (!logViolations) return;
    
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
   * Get rate limiting statistics
   * @returns {Object} Rate limiting statistics
   */
  const getStatistics = () => {
    const uptime = Date.now() - stats.startTime;
    
    return {
      totalRequests: stats.totalRequests,
      blockedRequests: stats.blockedRequests,
      blockRate: stats.totalRequests > 0 ? 
        stats.blockedRequests / stats.totalRequests : 0,
      uniqueClients: stats.uniqueClients.size,
      requestRate: stats.totalRequests / Math.max(uptime / 1000 / 60, 1), // requests per minute
      topViolators: Array.from(stats.violationsByClient.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      topEndpoints: Array.from(stats.requestsByEndpoint.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      uptime,
      timestamp: Date.now()
    };
  };

  /**
   * Get health status
   * @returns {Object} Health information
   */
  const getHealthStatus = () => {
    const statistics = getStatistics();
    const isHealthy = statistics.blockRate < 0.1; // Less than 10% blocked

    return {
      status: isHealthy ? 'healthy' : 'warning',
      blockRate: Math.round(statistics.blockRate * 100),
      totalRequests: statistics.totalRequests,
      blockedRequests: statistics.blockedRequests,
      issues: isHealthy ? [] : ['High block rate - potential abuse detected']
    };
  };

  return {
    updateStatistics,
    logViolation,
    getStatistics,
    getHealthStatus
  };
};
