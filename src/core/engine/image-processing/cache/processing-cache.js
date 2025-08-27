/**
 * Image Processing Cache
 * LRU cache for processed image results with smart eviction policies
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../../../shared/utils/error-handler.js';

/**
 * Creates processing cache with LRU eviction
 */
export const createProcessingCache = (config = {}) => {
  const cacheConfig = {
    maxSize: config.cacheSize || 50,
    maxMemoryMB: config.maxMemoryMB || 100,
    ttlMs: config.ttlMs || 300000, // 5 minutes default TTL
    enableMetrics: config.enableMetrics !== false,
    enableCompression: config.enableCompression || false,
    ...config
  };

  const state = {
    cache: new Map(),
    accessOrder: [], // For LRU tracking
    memoryUsage: 0,
    metrics: {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      avgHitTime: 0,
      memoryPressureEvictions: 0
    }
  };

  // Generate cache key from operation and parameters
  const generateCacheKey = (operation, params) => {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    return `${operation}:${paramString}`;
  };

  // Estimate memory usage of ImageData
  const estimateImageDataSize = (imageData) => {
    if (!imageData || !imageData.data) return 0;
    // ImageData size = width * height * 4 bytes (RGBA) + overhead
    return imageData.data.length + 64; // 64 bytes estimated overhead
  };

  // Update access order for LRU
  const updateAccessOrder = (key) => {
    const index = state.accessOrder.indexOf(key);
    if (index > -1) {
      state.accessOrder.splice(index, 1);
    }
    state.accessOrder.push(key);
  };

  // Evict least recently used item
  const evictLRU = () => {
    if (state.accessOrder.length === 0) return false;
    
    const keyToEvict = state.accessOrder.shift();
    const entry = state.cache.get(keyToEvict);
    
    if (entry) {
      state.memoryUsage -= entry.size;
      state.cache.delete(keyToEvict);
      state.metrics.evictions++;
      return true;
    }
    
    return false;
  };

  // Evict expired entries
  const evictExpired = () => {
    const now = Date.now();
    let evictedCount = 0;
    
    for (const [key, entry] of state.cache.entries()) {
      if (now - entry.timestamp > cacheConfig.ttlMs) {
        state.cache.delete(key);
        state.memoryUsage -= entry.size;
        
        const accessIndex = state.accessOrder.indexOf(key);
        if (accessIndex > -1) {
          state.accessOrder.splice(accessIndex, 1);
        }
        
        evictedCount++;
      }
    }
    
    if (evictedCount > 0) {
      state.metrics.evictions += evictedCount;
    }
    
    return evictedCount;
  };

  // Enforce cache size and memory limits
  const enforceMemoryLimits = () => {
    const maxMemoryBytes = cacheConfig.maxMemoryMB * 1024 * 1024;
    
    // Evict expired entries first
    evictExpired();
    
    // Evict LRU entries if over memory limit
    while (state.memoryUsage > maxMemoryBytes && state.cache.size > 0) {
      if (!evictLRU()) break;
      state.metrics.memoryPressureEvictions++;
    }
    
    // Evict LRU entries if over count limit
    while (state.cache.size > cacheConfig.maxSize) {
      if (!evictLRU()) break;
    }
  };

  // Compress ImageData (simple implementation)
  const compressImageData = (imageData) => {
    if (!cacheConfig.enableCompression) return imageData;
    
    // Simple compression: store only unique colors and their positions
    // This is a basic implementation - real compression would use better algorithms
    const { data, width, height } = imageData;
    const colorMap = new Map();
    const positions = [];
    
    for (let i = 0; i < data.length; i += 4) {
      const color = (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
      
      if (!colorMap.has(color)) {
        colorMap.set(color, colorMap.size);
      }
      
      positions.push(colorMap.get(color));
    }
    
    return {
      compressed: true,
      width,
      height,
      colorMap: Array.from(colorMap.keys()),
      positions: new Uint16Array(positions)
    };
  };

  // Decompress ImageData
  const decompressImageData = (compressed) => {
    if (!compressed.compressed) return compressed;
    
    const { width, height, colorMap, positions } = compressed;
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < positions.length; i++) {
      const color = colorMap[positions[i]];
      const pixelIndex = i * 4;
      
      data[pixelIndex] = (color >> 24) & 0xFF;     // R
      data[pixelIndex + 1] = (color >> 16) & 0xFF; // G
      data[pixelIndex + 2] = (color >> 8) & 0xFF;  // B
      data[pixelIndex + 3] = color & 0xFF;         // A
    }
    
    return new ImageData(data, width, height);
  };

  const getCached = (operation, params) => {
    const startTime = performance.now();
    const key = generateCacheKey(operation, params);
    
    state.metrics.totalRequests++;
    
    const entry = state.cache.get(key);
    
    if (!entry) {
      state.metrics.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > cacheConfig.ttlMs) {
      state.cache.delete(key);
      state.memoryUsage -= entry.size;
      
      const accessIndex = state.accessOrder.indexOf(key);
      if (accessIndex > -1) {
        state.accessOrder.splice(accessIndex, 1);
      }
      
      state.metrics.misses++;
      return null;
    }
    
    // Update access order and metrics
    updateAccessOrder(key);
    state.metrics.hits++;
    
    if (cacheConfig.enableMetrics) {
      const hitTime = performance.now() - startTime;
      state.metrics.avgHitTime = 
        (state.metrics.avgHitTime * (state.metrics.hits - 1) + hitTime) / state.metrics.hits;
    }
    
    // Decompress if needed
    return decompressImageData(entry.data);
  };

  const setCached = (operation, params, imageData) => {
    try {
      const key = generateCacheKey(operation, params);
      
      // Compress data if enabled
      const dataToStore = compressImageData(imageData);
      const size = estimateImageDataSize(imageData);
      
      const entry = {
        data: dataToStore,
        timestamp: Date.now(),
        size,
        accessCount: 1
      };
      
      // Remove existing entry if present
      if (state.cache.has(key)) {
        const oldEntry = state.cache.get(key);
        state.memoryUsage -= oldEntry.size;
      }
      
      // Add new entry
      state.cache.set(key, entry);
      state.memoryUsage += size;
      updateAccessOrder(key);
      
      // Enforce limits
      enforceMemoryLimits();
      
    } catch (error) {
      console.warn('Cache set operation failed:', error.message);
    }
  };

  const clear = () => {
    state.cache.clear();
    state.accessOrder = [];
    state.memoryUsage = 0;
    
    // Reset metrics except configuration-dependent ones
    const { hits, misses, evictions, totalRequests, avgHitTime, memoryPressureEvictions } = state.metrics;
    state.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      avgHitTime: 0,
      memoryPressureEvictions: 0
    };
  };

  const getMetrics = () => {
    const hitRate = state.metrics.totalRequests > 0 
      ? state.metrics.hits / state.metrics.totalRequests 
      : 0;
    
    return {
      ...state.metrics,
      hitRate,
      currentSize: state.cache.size,
      maxSize: cacheConfig.maxSize,
      memoryUsageMB: state.memoryUsage / (1024 * 1024),
      maxMemoryMB: cacheConfig.maxMemoryMB,
      memoryUtilization: state.memoryUsage / (cacheConfig.maxMemoryMB * 1024 * 1024)
    };
  };

  const getStats = () => ({
    ...getMetrics(),
    oldestEntryAge: state.accessOrder.length > 0 
      ? Date.now() - (state.cache.get(state.accessOrder[0])?.timestamp || Date.now())
      : 0,
    newestEntryAge: state.accessOrder.length > 0 
      ? Date.now() - (state.cache.get(state.accessOrder[state.accessOrder.length - 1])?.timestamp || Date.now())
      : 0,
    compressionEnabled: cacheConfig.enableCompression
  });

  // Periodic maintenance
  const performMaintenance = () => {
    evictExpired();
    enforceMemoryLimits();
  };

  // Set up periodic maintenance if TTL is enabled
  let maintenanceInterval = null;
  if (cacheConfig.ttlMs > 0) {
    maintenanceInterval = setInterval(performMaintenance, Math.min(cacheConfig.ttlMs / 2, 60000));
  }

  const cleanup = async () => {
    if (maintenanceInterval) {
      clearInterval(maintenanceInterval);
      maintenanceInterval = null;
    }
    clear();
  };

  const recordProcessingTime = (startTime, endTime) => {
    // This method is called by the main processor for metrics consistency
    // No-op in cache, but maintained for interface compatibility
  };

  return {
    getCached,
    setCached,
    clear,
    getMetrics,
    getStats,
    performMaintenance,
    recordProcessingTime,
    cleanup
  };
};