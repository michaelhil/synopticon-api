/**
 * Garbage Collection for Resource Pool
 * Handles cleanup and memory management
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js';

export const createGarbageCollector = (state, poolConfig, canvasManager) => {
  const updateMemoryPressure = () => {
    const totalPooledItems = 
      state.canvasPool.length +
      Array.from(state.webglContextPool.values()).reduce((sum, pool) => sum + pool.length, 0) +
      Array.from(state.imageBufferPool.values()).reduce((sum, pool) => sum + pool.length, 0) +
      Array.from(state.typedArrayPool.values()).reduce((sum, pool) => sum + pool.length, 0);
    
    const maxItems = 
      poolConfig.maxCanvasElements +
      poolConfig.maxWebGLContexts * 2 + // Estimate for different context types
      poolConfig.maxImageBuffers * 5 +  // Estimate for different buffer sizes
      poolConfig.maxTypedArrays * 10;   // Estimate for different array types
    
    state.metricsData.memoryPressure = Math.min(1.0, totalPooledItems / maxItems);
  };
  
  const performGarbageCollection = () => {
    try {
      const now = Date.now();
      const maxAge = poolConfig.gcInterval * 2; // Resources older than 2x GC interval
      
      // Clean old WebGL contexts
      for (const [type, contextPool] of state.webglContextPool.entries()) {
        const freshContexts = contextPool.filter(info => {
          if (!info.inUse && (now - info.created) > maxAge) {
            canvasManager.returnCanvas(info.canvas);
            return false;
          }
          return true;
        });
        state.webglContextPool.set(type, freshContexts);
      }
      
      // Trim pools to reasonable sizes
      state.canvasPool.splice(Math.floor(poolConfig.maxCanvasElements * 0.7));
      
      // Force garbage collection if available
      if (globalThis.gc && typeof globalThis.gc === 'function') {
        globalThis.gc();
      }
      
      // Update memory pressure metric
      updateMemoryPressure();
      
    } catch (error) {
      handleError(
        `Error during garbage collection: ${error.message}`,
        ErrorCategory.MEMORY,
        ErrorSeverity.WARNING
      );
    }
  };
  
  const startGarbageCollection = () => {
    if (state.gcTimer) return;
    
    state.gcTimer = setInterval(() => {
      performGarbageCollection();
    }, poolConfig.gcInterval);
  };
  
  const cleanup = () => {
    // Stop garbage collection
    if (state.gcTimer) {
      clearInterval(state.gcTimer);
      state.gcTimer = null;
    }
    
    // Clear all pools
    state.canvasPool.length = 0;
    state.webglContextPool.clear();
    state.imageBufferPool.clear();
    state.typedArrayPool.clear();
    
    // Reset metrics
    Object.keys(state.metricsData).forEach(key => {
      if (typeof state.metricsData[key] === 'number') {
        state.metricsData[key] = 0;
      }
    });
  };
  
  return {
    updateMemoryPressure,
    performGarbageCollection,
    startGarbageCollection,
    cleanup
  };
};