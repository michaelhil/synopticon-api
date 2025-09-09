/**
 * Adaptive cleanup and memory pressure management for memory pool
 */

export const createCleanupManager = (state) => {

  // Check memory pressure and trigger cleanup if needed
  const checkMemoryPressure = () => {
    if (typeof performance === 'undefined' || !performance.memory) {
      return;
    }

    const memoryInfo = performance.memory;
    const usedMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
    
    if (usedMB > state.config.maxMemoryPressureThreshold) {
      console.warn(`⚠️ High memory pressure detected: ${usedMB.toFixed(1)}MB`);
      forceCleanup();
    } else if (usedMB > state.config.memoryPressureThreshold) {
      cleanup();
    }
  };

  // Adaptive cleanup based on pool usage patterns
  const adaptiveCleanup = () => {
    const now = Date.now();
    
    // Calculate current pool usage
    let totalPoolSize = 0;
    const totalActiveSize = 0;
    
    for (const [type, pools] of Object.entries(state.pools)) {
      for (const pool of pools.values()) {
        totalPoolSize += pool.length;
      }
    }
    
    // Update usage history
    state.adaptiveState.usageHistory.push({
      timestamp: now,
      totalPoolSize,
      activeObjects: state.activeObjects ? 0 : totalActiveSize // WeakSet size not available
    });
    
    // Keep only last 10 usage records
    if (state.adaptiveState.usageHistory.length > 10) {
      state.adaptiveState.usageHistory.shift();
    }
    
    // Calculate average pool usage
    const recentUsage = state.adaptiveState.usageHistory.slice(-5);
    state.adaptiveState.averagePoolUsage = recentUsage.reduce((sum, record) => 
      sum + record.totalPoolSize, 0
    ) / recentUsage.length;
    
    // Adjust cleanup interval based on usage
    const highUsage = state.adaptiveState.averagePoolUsage > state.config.maxPoolSize * 0.7;
    const lowUsage = state.adaptiveState.averagePoolUsage < state.config.maxPoolSize * 0.3;
    
    if (highUsage) {
      // Increase cleanup frequency
      state.adaptiveState.currentInterval = Math.max(
        state.config.baseCleanupInterval * 0.5,
        1000
      );
    } else if (lowUsage) {
      // Decrease cleanup frequency
      state.adaptiveState.currentInterval = Math.min(
        state.config.baseCleanupInterval * 2,
        60000
      );
    }
    
    // Perform cleanup
    const cleaned = cleanup();
    
    // Update cleanup efficiency
    if (totalPoolSize > 0) {
      state.adaptiveState.cleanupEfficiency = cleaned / totalPoolSize;
    }
  };

  // Standard cleanup routine
  const cleanup = () => {
    const now = Date.now();
    const maxAge = state.config.maxObjectAge;
    let totalCleaned = 0;
    
    // Clean arrays pool
    for (const [key, pool] of state.pools.arrays.entries()) {
      const originalSize = pool.length;
      
      // Remove old arrays (we can't track age of individual arrays without metadata)
      if (originalSize > state.config.maxPoolSize * 0.8) {
        const toRemove = Math.floor(originalSize * 0.3);
        pool.splice(0, toRemove);
        totalCleaned += toRemove;
      }
    }
    
    // Clean objects pool
    for (const [key, pool] of state.pools.objects.entries()) {
      const originalSize = pool.length;
      
      // Filter out objects that are too old or exceed pool size
      const filteredPool = pool.filter((obj, index) => {
        const metadata = state.objectMetadata.get(obj);
        if (!metadata) return index < state.config.maxPoolSize;
        
        const age = now - metadata.acquiredAt;
        return age < maxAge && index < state.config.maxPoolSize;
      });
      
      const cleaned = originalSize - filteredPool.length;
      if (cleaned > 0) {
        state.pools.objects.set(key, filteredPool);
        totalCleaned += cleaned;
      }
    }
    
    // Clean other pool types similarly
    ['buffers', 'canvases', 'contexts'].forEach(poolType => {
      for (const [key, pool] of state.pools[poolType].entries()) {
        const originalSize = pool.length;
        if (originalSize > state.config.maxPoolSize) {
          const toKeep = state.config.maxPoolSize;
          pool.splice(toKeep);
          totalCleaned += (originalSize - toKeep);
        }
      }
    });
    
    state.stats.lastCleanup = now;
    
    if (totalCleaned > 0) {
      console.log(`🧹 Memory pool cleanup: removed ${totalCleaned} objects`);
    }
    
    return totalCleaned;
  };

  // Force aggressive cleanup
  const forceCleanup = () => {
    let totalCleaned = 0;
    
    // Aggressively reduce all pools
    for (const [type, pools] of Object.entries(state.pools)) {
      for (const [key, pool] of pools.entries()) {
        const originalSize = pool.length;
        const targetSize = Math.floor(state.config.maxPoolSize * 0.5);
        
        if (originalSize > targetSize) {
          pool.splice(targetSize);
          totalCleaned += (originalSize - targetSize);
        }
      }
    }
    
    console.log(`🔥 Force cleanup completed: removed ${totalCleaned} objects`);
    return totalCleaned;
  };

  // Start adaptive cleanup timer
  const startAdaptiveCleanup = () => {
    if (state.cleanupTimer) {
      clearInterval(state.cleanupTimer);
    }
    
    const runCleanup = () => {
      if (state.config.adaptiveCleanup) {
        adaptiveCleanup();
      } else {
        cleanup();
      }
      
      // Schedule next cleanup with current interval
      state.cleanupTimer = setTimeout(runCleanup, state.adaptiveState.currentInterval);
    };
    
    // Start initial cleanup
    runCleanup();
  };

  // Stop cleanup timer
  const stopCleanup = () => {
    if (state.cleanupTimer) {
      clearTimeout(state.cleanupTimer);
      state.cleanupTimer = null;
    }
  };

  return {
    checkMemoryPressure,
    cleanup,
    forceCleanup,
    startAdaptiveCleanup,
    stopCleanup,
    getCleanupStats: () => ({
      lastCleanup: state.stats.lastCleanup,
      currentInterval: state.adaptiveState.currentInterval,
      cleanupEfficiency: state.adaptiveState.cleanupEfficiency,
      averagePoolUsage: state.adaptiveState.averagePoolUsage
    })
  };
};
