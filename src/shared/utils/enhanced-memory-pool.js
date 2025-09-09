/**
 * Enhanced Memory Pool Manager
 * 
 * Provides intelligent object pooling and reuse for better memory management
 * and garbage collection performance in intensive applications.
 * 
 * Features:
 * - Typed array pooling (Float32Array, Uint8Array, etc.)
 * - Canvas and ImageData pooling for graphics operations
 * - Generic object pooling with custom factories
 * - Adaptive cleanup based on usage patterns
 * - Memory pressure monitoring and response
 * - Comprehensive usage statistics and metrics
 * 
 * Performance Benefits:
 * - Reduces garbage collection pressure by reusing objects
 * - Eliminates frequent allocations/deallocations
 * - Adaptive cleanup prevents memory bloat
 * - Memory pressure monitoring prevents out-of-memory conditions
 * 
 * @example
 * ```javascript
 * import { createEnhancedMemoryPool } from './enhanced-memory-pool.js';
 * 
 * const memoryPool = createEnhancedMemoryPool({
 *   maxPoolSize: 100,
 *   adaptiveCleanup: true,
 *   enableMetrics: true
 * });
 * 
 * memoryPool.initialize();
 * 
 * // Use typed arrays
 * const array = memoryPool.acquireFloat32Array(1024);
 * // ... use array
 * memoryPool.releaseArray(array);
 * 
 * // Use custom objects
 * const result = memoryPool.acquire('FaceResult', { faces: [] });
 * // ... use result
 * memoryPool.release(result);
 * ```
 */

import { createMemoryPoolConfig, createMemoryPoolState } from './memory-pool-config.js';
import { createFactoryManager } from './memory-pool-factories.js';
import { createArrayManager } from './memory-pool-arrays.js';
import { createCleanupManager } from './memory-pool-cleanup.js';

// Create enhanced memory pool manager factory
export const createEnhancedMemoryPool = (config = {}) => {
  const poolConfig = createMemoryPoolConfig(config);
  const state = createMemoryPoolState(poolConfig);
  
  // Create managers
  const factoryManager = createFactoryManager(state);
  const arrayManager = createArrayManager(state, factoryManager);
  const cleanupManager = createCleanupManager(state);

  // Initialize the memory pool
  const initialize = () => {
    console.log('🔧 Initializing enhanced memory pool...');
    
    // Register default factories
    factoryManager.registerDefaultFactories();
    
    // Start adaptive cleanup timer
    if (state.config.baseCleanupInterval > 0) {
      cleanupManager.startAdaptiveCleanup();
    }
    
    // Monitor memory pressure if available
    if (typeof performance !== 'undefined' && performance.memory) {
      setInterval(cleanupManager.checkMemoryPressure, 5000);
    }
    
    console.log('✅ Enhanced memory pool initialized');
    return true;
  };

  // Acquire object from pool
  const acquire = (type, ...args) => {
    const key = args.length > 0 ? `${type}_${args.join('_')}` : type;
    const pool = state.pools.objects.get(key) || [];
    
    let obj;
    if (pool.length > 0) {
      obj = pool.pop();
      state.stats.reuseHits++;
    } else {
      // Create new object
      const factory = factoryManager.getFactory(type);
      if (!factory) {
        throw new Error(`No factory registered for type: ${type}`);
      }
      
      obj = factory(...args);
      state.stats.allocations++;
    }
    
    // Track object
    if (state.config.enableTracking) {
      state.activeObjects.add(obj);
      state.objectMetadata.set(obj, {
        type,
        args,
        acquiredAt: Date.now(),
        poolKey: key
      });
    }
    
    return obj;
  };

  // Release object back to pool
  const release = (obj) => {
    if (!obj) return;
    
    const metadata = state.objectMetadata.get(obj);
    if (!metadata) {
      console.warn('Attempting to release untracked object');
      return;
    }
    
    const { poolKey } = metadata;
    const pool = state.pools.objects.get(poolKey) || [];
    
    // Check pool size limit
    if (pool.length < state.config.maxPoolSize) {
      pool.push(obj);
      
      if (!state.pools.objects.has(poolKey)) {
        state.pools.objects.set(poolKey, pool);
      }
      
      state.stats.deallocations++;
    }
    
    // Remove from tracking
    if (state.config.enableTracking) {
      state.activeObjects.delete(obj);
      state.objectMetadata.delete(obj);
    }
  };

  // Acquire canvas element
  const acquireCanvas = (width, height) => {
    const key = `${width}x${height}`;
    const pool = state.pools.canvases.get(key) || [];
    
    let canvas;
    if (pool.length > 0) {
      canvas = pool.pop();
      state.stats.reuseHits++;
      
      // Reset canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      // Create new canvas
      const factory = factoryManager.getFactory('Canvas');
      canvas = factory ? factory(width, height) : null;
      
      if (!canvas) {
        throw new Error('Canvas not available in this environment');
      }
      
      state.stats.allocations++;
    }
    
    // Track canvas
    if (state.config.enableTracking) {
      state.objectMetadata.set(canvas, {
        type: 'Canvas',
        width,
        height,
        acquiredAt: Date.now(),
        poolKey: key
      });
    }
    
    return canvas;
  };

  // Release canvas back to pool
  const releaseCanvas = (canvas) => {
    if (!canvas) return;
    
    const metadata = state.objectMetadata.get(canvas);
    if (!metadata) {
      console.warn('Attempting to release untracked canvas');
      return;
    }
    
    const { poolKey } = metadata;
    const pool = state.pools.canvases.get(poolKey) || [];
    
    // Check pool size limit
    if (pool.length < state.config.maxPoolSize) {
      pool.push(canvas);
      
      if (!state.pools.canvases.has(poolKey)) {
        state.pools.canvases.set(poolKey, pool);
      }
      
      state.stats.deallocations++;
    }
    
    // Remove from tracking
    if (state.config.enableTracking) {
      state.objectMetadata.delete(canvas);
    }
  };

  // Get comprehensive statistics
  const getStatistics = () => {
    // Update pool sizes in stats
    state.stats.poolSizes = {};
    
    for (const [type, pools] of Object.entries(state.pools)) {
      state.stats.poolSizes[type] = {};
      for (const [key, pool] of pools.entries()) {
        state.stats.poolSizes[type][key] = pool.length;
      }
    }
    
    return {
      ...state.stats,
      pools: { ...state.stats.poolSizes },
      cleanup: cleanupManager.getCleanupStats(),
      configuration: state.config,
      runtime: Date.now() - state.stats.created
    };
  };

  // Update pool configuration
  const updateConfiguration = (newConfig) => {
    Object.assign(state.config, newConfig);
    console.log('🔧 Memory pool configuration updated');
  };

  // Reset all pools and statistics
  const reset = () => {
    // Clear all pools
    for (const pools of Object.values(state.pools)) {
      pools.clear();
    }
    
    // Reset statistics
    state.stats.allocations = 0;
    state.stats.deallocations = 0;
    state.stats.reuseHits = 0;
    state.stats.memoryLeaks = 0;
    state.stats.poolSizes = {};
    state.stats.lastCleanup = Date.now();
    
    console.log('🧹 Memory pool reset completed');
  };

  // Cleanup and destroy pool
  const cleanup = () => {
    cleanupManager.stopCleanup();
    
    // Clear all pools
    for (const pools of Object.values(state.pools)) {
      pools.clear();
    }
    
    // Clear factories
    state.factories.clear();
    
    console.log('🧹 Enhanced memory pool cleaned up');
  };

  return {
    // Core functionality
    initialize,
    acquire,
    release,
    
    // Typed arrays
    acquireArray: arrayManager.acquireArray,
    releaseArray: arrayManager.releaseArray,
    acquireFloat32Array: arrayManager.acquireFloat32Array,
    acquireUint8Array: arrayManager.acquireUint8Array,
    
    // Canvas management
    acquireCanvas,
    releaseCanvas,
    
    // Factory management
    registerFactory: factoryManager.registerFactory,
    getRegisteredTypes: factoryManager.getRegisteredTypes,
    
    // Cleanup management
    cleanup: cleanupManager.cleanup,
    forceCleanup: cleanupManager.forceCleanup,
    
    // Information and statistics
    getStatistics,
    getArrayPoolStats: arrayManager.getArrayPoolStats,
    
    // Configuration and maintenance
    updateConfiguration,
    getConfiguration: () => ({ ...state.config }),
    reset,
    
    // Lifecycle
    cleanup
  };
};
