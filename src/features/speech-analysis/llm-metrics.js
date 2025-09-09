/**
 * Performance metrics and monitoring for LLM client
 */

export const createMetricsTracker = (callbacks) => {
  const metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    cacheHits: 0,
    backendSwitches: 0,
    totalProcessingTime: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastRequestTime: 0
  };
  
  // Record successful request
  const recordSuccess = (processingTime) => {
    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.totalProcessingTime += processingTime;
    metrics.averageLatency = metrics.totalProcessingTime / metrics.successfulRequests;
    metrics.currentStreak++;
    metrics.longestStreak = Math.max(metrics.longestStreak, metrics.currentStreak);
    metrics.lastRequestTime = Date.now();
  };
  
  // Record failed request
  const recordFailure = (processingTime = 0) => {
    metrics.totalRequests++;
    metrics.failedRequests++;
    if (processingTime > 0) {
      metrics.totalProcessingTime += processingTime;
    }
    metrics.currentStreak = 0;
    metrics.lastRequestTime = Date.now();
  };
  
  // Record cache hit
  const recordCacheHit = () => {
    metrics.cacheHits++;
  };
  
  // Record backend switch
  const recordBackendSwitch = (fromBackend, toBackend, reason) => {
    metrics.backendSwitches++;
    
    // Notify callbacks if available
    if (callbacks?.onBackendSwitch) {
      callbacks.onBackendSwitch.forEach(callback => {
        try {
          callback({ from: fromBackend, to: toBackend, reason });
        } catch (error) {
          console.warn('Backend switch callback error:', error);
        }
      });
    }
  };
  
  // Get current metrics
  const getMetrics = () => ({ ...metrics });
  
  // Get performance statistics
  const getPerformanceStats = () => {
    const successRate = metrics.totalRequests > 0 
      ? metrics.successfulRequests / metrics.totalRequests 
      : 0;
    
    const cacheHitRate = metrics.totalRequests > 0 
      ? metrics.cacheHits / metrics.totalRequests 
      : 0;
    
    return {
      ...metrics,
      successRate,
      cacheHitRate,
      failureRate: 1 - successRate,
      averageLatencyMs: Math.round(metrics.averageLatency),
      requestsPerMinute: calculateRequestsPerMinute(),
      uptime: Date.now() - (metrics.lastRequestTime || Date.now())
    };
  };
  
  // Calculate requests per minute
  const calculateRequestsPerMinute = () => {
    if (metrics.totalRequests === 0) return 0;
    
    const now = Date.now();
    const uptime = now - (metrics.lastRequestTime - (metrics.totalRequests * metrics.averageLatency));
    const minutes = Math.max(uptime / 60000, 1);
    
    return Math.round(metrics.totalRequests / minutes);
  };
  
  // Reset metrics
  const reset = () => {
    Object.keys(metrics).forEach(key => {
      metrics[key] = 0;
    });
  };
  
  // Export metrics for analysis
  const exportMetrics = () => ({
    timestamp: Date.now(),
    metrics: getMetrics(),
    performance: getPerformanceStats()
  });
  
  return {
    recordSuccess,
    recordFailure,
    recordCacheHit,
    recordBackendSwitch,
    getMetrics,
    getPerformanceStats,
    reset,
    exportMetrics
  };
};
