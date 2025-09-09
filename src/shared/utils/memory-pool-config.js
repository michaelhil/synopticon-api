/**
 * Configuration management for enhanced memory pool
 */

export const createMemoryPoolConfig = (config = {}) => ({
  maxPoolSize: config.maxPoolSize || 50,
  maxObjectAge: config.maxObjectAge || 60000, // 1 minute
  baseCleanupInterval: config.cleanupInterval || 10000, // 10 seconds
  adaptiveCleanup: config.adaptiveCleanup !== false, // Enable adaptive cleanup
  enableTracking: config.enableTracking !== false,
  enableMetrics: config.enableMetrics !== false,
  memoryPressureThreshold: config.memoryPressureThreshold || 100, // MB
  maxMemoryPressureThreshold: config.maxMemoryPressureThreshold || 150, // MB
  ...config
});

export const createMemoryPoolState = (config) => ({
  // Configuration
  config,
  
  // Object pools by type and size
  pools: {
    arrays: new Map(), // 'Float32Array_1024' -> array[]
    objects: new Map(), // 'FaceResult' -> object[]
    buffers: new Map(), // 'ImageData_640_480' -> buffer[]
    canvases: new Map(), // '640x480' -> canvas[]
    contexts: new Map() // 'canvas2d' -> context[]
  },
  
  // Active tracking
  activeObjects: new WeakSet(),
  objectMetadata: new WeakMap(),
  
  // Usage statistics
  stats: {
    allocations: 0,
    deallocations: 0,
    reuseHits: 0,
    memoryLeaks: 0,
    poolSizes: {},
    created: Date.now(),
    lastCleanup: Date.now()
  },
  
  // Adaptive cleanup state
  adaptiveState: {
    averagePoolUsage: 0,
    lastUsageCheck: Date.now(),
    usageHistory: [],
    currentInterval: config.baseCleanupInterval,
    cleanupEfficiency: 1.0 // ratio of objects cleaned vs total pool size
  },
  
  // Cleanup timer
  cleanupTimer: null,
  
  // Factory functions for different object types
  factories: new Map()
});
