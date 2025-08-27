/**
 * Resource Pool Metrics
 * Handles metrics collection and reporting for resource pools
 */

export const createMetricsManager = (state, poolConfig, garbageCollector) => {
  const getMetrics = () => {
    if (!poolConfig.enableMetrics) {
      return { enabled: false };
    }
    
    garbageCollector.updateMemoryPressure();
    
    return {
      ...state.metricsData,
      poolSizes: {
        canvas: state.canvasPool.length,
        webglContexts: Array.from(state.webglContextPool.values()).reduce((sum, pool) => sum + pool.length, 0),
        imageBuffers: Array.from(state.imageBufferPool.values()).reduce((sum, pool) => sum + pool.length, 0),
        typedArrays: Array.from(state.typedArrayPool.values()).reduce((sum, pool) => sum + pool.length, 0)
      },
      config: poolConfig,
      enabled: true
    };
  };
  
  return { getMetrics };
};