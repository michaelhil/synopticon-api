/**
 * Memory Pool Statistics and Monitoring
 */

export const updatePoolStatistics = (stats, pools) => {
  // Update pool sizes
  stats.poolSizes = {};
  for (const [poolType, poolMap] of Object.entries(pools)) {
    stats.poolSizes[poolType] = {};
    for (const [key, pool] of poolMap) {
      stats.poolSizes[poolType][key] = pool.length;
    }
  }
};

export const recordAllocation = (stats) => {
  stats.allocations++;
};

export const recordDeallocation = (stats) => {
  stats.deallocations++;
};

export const recordReuseHit = (stats) => {
  stats.reuseHits++;
};

export const recordMemoryLeak = (stats) => {
  stats.memoryLeaks++;
};

export const calculateEfficiencyMetrics = (stats) => {
  const total = stats.allocations + stats.deallocations;
  const reuseRate = total > 0 ? stats.reuseHits / total : 0;
  const leakRate = stats.allocations > 0 ? stats.memoryLeaks / stats.allocations : 0;
  
  return {
    reuseRate: Math.round(reuseRate * 100) / 100,
    leakRate: Math.round(leakRate * 100) / 100,
    totalOperations: total,
    uptime: Date.now() - stats.created
  };
};

export const checkMemoryPressureLevel = (config) => {
  if (typeof performance === 'undefined' || !performance.memory) {
    return { level: 'unknown', usage: 0 };
  }
  
  const memoryInfo = performance.memory;
  const usedMB = memoryInfo.usedJSHeapSize / (1024 * 1024);
  
  let level = 'low';
  if (usedMB > config.maxMemoryPressureThreshold) {
    level = 'critical';
  } else if (usedMB > config.memoryPressureThreshold) {
    level = 'high';
  }
  
  return {
    level,
    usage: Math.round(usedMB),
    limit: memoryInfo.jsHeapSizeLimit / (1024 * 1024),
    total: memoryInfo.totalJSHeapSize / (1024 * 1024)
  };
};

export const updateAdaptiveState = (adaptiveState, cleanupEfficiency) => {
  const now = Date.now();
  const timeDelta = now - adaptiveState.lastUsageCheck;
  
  // Update cleanup efficiency
  adaptiveState.cleanupEfficiency = cleanupEfficiency;
  
  // Update usage history
  adaptiveState.usageHistory.push({
    timestamp: now,
    efficiency: cleanupEfficiency
  });
  
  // Keep only last 10 measurements
  if (adaptiveState.usageHistory.length > 10) {
    adaptiveState.usageHistory.shift();
  }
  
  // Calculate average efficiency
  const avgEfficiency = adaptiveState.usageHistory.reduce((sum, item) => sum + item.efficiency, 0) / adaptiveState.usageHistory.length;
  adaptiveState.averagePoolUsage = avgEfficiency;
  
  // Adjust cleanup interval based on efficiency
  if (avgEfficiency > 0.8) {
    // High efficiency - pools are being used well, cleanup less frequently
    adaptiveState.currentInterval = Math.min(adaptiveState.currentInterval * 1.2, 30000);
  } else if (avgEfficiency < 0.3) {
    // Low efficiency - pools are not being reused, cleanup more frequently
    adaptiveState.currentInterval = Math.max(adaptiveState.currentInterval * 0.8, 1000);
  }
  
  adaptiveState.lastUsageCheck = now;
};

export const getMemoryPoolSummary = (stats, pools, adaptiveState) => {
  const efficiency = calculateEfficiencyMetrics(stats);
  const memoryPressure = checkMemoryPressureLevel({ 
    memoryPressureThreshold: 100, 
    maxMemoryPressureThreshold: 150 
  });
  
  const totalPooledObjects = Object.values(pools).reduce((total, poolMap) => {
    return total + Array.from(poolMap.values()).reduce((sum, pool) => sum + pool.length, 0);
  }, 0);
  
  return {
    efficiency,
    memoryPressure,
    totalPooledObjects,
    adaptiveInterval: adaptiveState.currentInterval,
    averageEfficiency: adaptiveState.averagePoolUsage,
    stats: { ...stats },
    uptime: Date.now() - stats.created
  };
};