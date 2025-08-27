/**
 * Image processing cache and metrics management
 */

export const createProcessingCache = (config = {}) => {
  const state = {
    cache: new Map(),
    metrics: {
      processedFrames: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    },
    config: {
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 50,
      enableMetrics: config.enableMetrics !== false
    }
  };

  const generateCacheKey = (operation, params) => {
    return `${operation}_${JSON.stringify(params)}`;
  };

  const getCached = (operation, params) => {
    if (!state.config.enableCaching) return null;
    
    const key = generateCacheKey(operation, params);
    const cached = state.cache.get(key);
    
    if (cached) {
      state.metrics.cacheHits++;
      // Move to end (LRU)
      state.cache.delete(key);
      state.cache.set(key, cached);
      return cached.data;
    }
    
    state.metrics.cacheMisses++;
    return null;
  };

  const setCached = (operation, params, result) => {
    if (!state.config.enableCaching) return;
    
    const key = generateCacheKey(operation, params);
    
    // Implement LRU eviction
    if (state.cache.size >= state.config.cacheSize) {
      const firstKey = state.cache.keys().next().value;
      state.cache.delete(firstKey);
    }
    
    state.cache.set(key, {
      data: result,
      timestamp: Date.now()
    });
  };

  const recordProcessingTime = (startTime, endTime) => {
    if (!state.config.enableMetrics) return;
    
    const processingTime = endTime - startTime;
    state.metrics.processedFrames++;
    state.metrics.totalProcessingTime += processingTime;
    state.metrics.averageProcessingTime = 
      state.metrics.totalProcessingTime / state.metrics.processedFrames;
  };

  const getMetrics = () => ({
    ...state.metrics,
    cacheSize: state.cache.size,
    cacheHitRate: state.metrics.cacheHits + state.metrics.cacheMisses > 0 
      ? state.metrics.cacheHits / (state.metrics.cacheHits + state.metrics.cacheMisses)
      : 0
  });

  const clearCache = () => {
    state.cache.clear();
  };

  const resetMetrics = () => {
    state.metrics = {
      processedFrames: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };
  };

  return {
    getCached,
    setCached,
    recordProcessingTime,
    getMetrics,
    clearCache,
    resetMetrics
  };
};