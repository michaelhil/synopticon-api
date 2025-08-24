/**
 * Enhanced Memory Pooling System
 * Optimized for speech analysis and face detection workflows
 * Following functional programming patterns with factory functions
 */

// Create enhanced memory pool manager factory
export const createEnhancedMemoryPool = (config = {}) => {
  const state = {
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
    
    // Configuration
    config: {
      maxPoolSize: config.maxPoolSize || 50,
      maxObjectAge: config.maxObjectAge || 60000, // 1 minute
      cleanupInterval: config.cleanupInterval || 10000, // 10 seconds
      enableTracking: config.enableTracking !== false,
      enableMetrics: config.enableMetrics !== false,
      memoryPressureThreshold: config.memoryPressureThreshold || 100, // MB
      ...config
    },
    
    // Cleanup timer
    cleanupTimer: null,
    
    // Factory functions for different object types
    factories: new Map()
  };

  // Initialize the memory pool
  const initialize = () => {
    console.log('🔧 Initializing enhanced memory pool...');
    
    // Register default factories
    registerDefaultFactories();
    
    // Start cleanup timer
    if (state.config.cleanupInterval > 0) {
      state.cleanupTimer = setInterval(performCleanup, state.config.cleanupInterval);
    }
    
    // Monitor memory pressure if available
    if (typeof performance !== 'undefined' && performance.memory) {
      setInterval(checkMemoryPressure, 5000);
    }
    
    console.log('✅ Enhanced memory pool initialized');
    return true;
  };

  // Register default object factories
  const registerDefaultFactories = () => {
    // Float32Array factory
    state.factories.set('Float32Array', (size) => new Float32Array(size));
    
    // Uint8Array factory
    state.factories.set('Uint8Array', (size) => new Uint8Array(size));
    
    // Canvas factory
    state.factories.set('Canvas', (width, height) => {
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      }
      return null;
    });
    
    // ImageData factory
    state.factories.set('ImageData', (width, height) => {
      if (typeof ImageData !== 'undefined') {
        return new ImageData(width, height);
      }
      return null;
    });
    
    // Face result factory
    state.factories.set('FaceResult', () => ({
      id: null,
      bbox: { x: 0, y: 0, width: 0, height: 0 },
      landmarks: [],
      confidence: 0,
      pose3DOF: null,
      age: { value: null, confidence: 0 },
      gender: { value: null, confidence: 0 },
      emotion: { value: null, confidence: 0 },
      timestamp: 0,
      _pooled: true
    }));
    
    // Transcript result factory
    state.factories.set('TranscriptResult', () => ({
      text: '',
      confidence: 0,
      timestamp: 0,
      isFinal: false,
      participantId: null,
      _pooled: true
    }));
    
    // Analysis result factory
    state.factories.set('AnalysisResult', () => ({
      prompt: '',
      result: '',
      confidence: 0,
      timestamp: 0,
      sessionId: null,
      _pooled: true
    }));
  };

  // Register custom factory
  const registerFactory = (type, factory) => {
    state.factories.set(type, factory);
  };

  // Acquire object from pool
  const acquire = (type, ...args) => {
    const key = createPoolKey(type, args);
    const pool = state.pools.objects.get(key) || [];
    
    let obj;
    if (pool.length > 0) {
      obj = pool.pop();
      state.stats.reuseHits++;
      
      // Reset object to clean state
      if (typeof obj.reset === 'function') {
        obj.reset();
      } else {
        resetObject(obj, type);
      }
    } else {
      // Create new object
      const factory = state.factories.get(type);
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

  // Acquire typed array
  const acquireArray = (type, size) => {
    const key = `${type}_${size}`;
    const pool = state.pools.arrays.get(key) || [];
    
    let array;
    if (pool.length > 0) {
      array = pool.pop();
      state.stats.reuseHits++;
      
      // Clear array for reuse
      array.fill(0);
    } else {
      // Create new array
      const factory = state.factories.get(type);
      if (!factory) {
        switch (type) {
          case 'Float32Array':
            array = new Float32Array(size);
            break;
          case 'Uint8Array':
            array = new Uint8Array(size);
            break;
          case 'Uint16Array':
            array = new Uint16Array(size);
            break;
          default:
            throw new Error(`Unsupported array type: ${type}`);
        }
      } else {
        array = factory(size);
      }
      
      state.stats.allocations++;
    }
    
    // Track array
    if (state.config.enableTracking) {
      state.objectMetadata.set(array, {
        type: 'Array',
        subtype: type,
        size,
        acquiredAt: Date.now(),
        poolKey: key
      });
    }
    
    return array;
  };

  // Release typed array
  const releaseArray = (array) => {
    if (!array) return;
    
    const metadata = state.objectMetadata.get(array);
    if (!metadata) {
      console.warn('Attempting to release untracked array');
      return;
    }
    
    const { poolKey } = metadata;
    const pool = state.pools.arrays.get(poolKey) || [];
    
    if (pool.length < state.config.maxPoolSize) {
      pool.push(array);
      
      if (!state.pools.arrays.has(poolKey)) {
        state.pools.arrays.set(poolKey, pool);
      }
      
      state.stats.deallocations++;
    }
    
    state.objectMetadata.delete(array);
  };

  // Acquire canvas
  const acquireCanvas = (width, height) => {
    const key = `${width}x${height}`;
    const pool = state.pools.canvases.get(key) || [];
    
    let canvas;
    if (pool.length > 0) {
      canvas = pool.pop();
      state.stats.reuseHits++;
      
      // Clear canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
    } else {
      // Create new canvas
      const factory = state.factories.get('Canvas');
      canvas = factory ? factory(width, height) : null;
      
      if (!canvas) {
        throw new Error('Canvas factory not available');
      }
      
      state.stats.allocations++;
    }
    
    return canvas;
  };

  // Release canvas
  const releaseCanvas = (canvas) => {
    if (!canvas) return;
    
    const key = `${canvas.width}x${canvas.height}`;
    const pool = state.pools.canvases.get(key) || [];
    
    if (pool.length < state.config.maxPoolSize) {
      pool.push(canvas);
      
      if (!state.pools.canvases.has(key)) {
        state.pools.canvases.set(key, pool);
      }
      
      state.stats.deallocations++;
    }
  };

  // Create pool key
  const createPoolKey = (type, args) => {
    if (args.length === 0) return type;
    return `${type}_${args.join('_')}`;
  };

  // Reset object to initial state
  const resetObject = (obj, type) => {
    switch (type) {
      case 'FaceResult':
        obj.id = null;
        obj.bbox = { x: 0, y: 0, width: 0, height: 0 };
        obj.landmarks = [];
        obj.confidence = 0;
        obj.pose3DOF = null;
        obj.age = { value: null, confidence: 0 };
        obj.gender = { value: null, confidence: 0 };
        obj.emotion = { value: null, confidence: 0 };
        obj.timestamp = 0;
        break;
        
      case 'TranscriptResult':
        obj.text = '';
        obj.confidence = 0;
        obj.timestamp = 0;
        obj.isFinal = false;
        obj.participantId = null;
        break;
        
      case 'AnalysisResult':
        obj.prompt = '';
        obj.result = '';
        obj.confidence = 0;
        obj.timestamp = 0;
        obj.sessionId = null;
        break;
        
      default:
        // Generic reset - clear enumerable properties
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && !key.startsWith('_')) {
            if (typeof obj[key] === 'number') {
              obj[key] = 0;
            } else if (typeof obj[key] === 'string') {
              obj[key] = '';
            } else if (Array.isArray(obj[key])) {
              obj[key].length = 0;
            } else if (obj[key] && typeof obj[key] === 'object') {
              obj[key] = null;
            }
          }
        }
    }
  };

  // Perform cleanup of old objects
  const performCleanup = () => {
    const now = Date.now();
    const maxAge = state.config.maxObjectAge;
    let cleanedCount = 0;
    
    // Clean up object pools
    state.pools.objects.forEach((pool, key) => {
      const before = pool.length;
      state.pools.objects.set(key, pool.filter(obj => {
        const metadata = state.objectMetadata.get(obj);
        return metadata && (now - metadata.acquiredAt) < maxAge;
      }));
      cleanedCount += before - state.pools.objects.get(key).length;
    });
    
    // Clean up array pools
    state.pools.arrays.forEach((pool, key) => {
      const before = pool.length;
      state.pools.arrays.set(key, pool.filter(array => {
        const metadata = state.objectMetadata.get(array);
        return metadata && (now - metadata.acquiredAt) < maxAge;
      }));
      cleanedCount += before - state.pools.arrays.get(key).length;
    });
    
    state.stats.lastCleanup = now;
    
    if (cleanedCount > 0) {
      console.log(`🧹 Memory pool cleanup: removed ${cleanedCount} aged objects`);
    }
  };

  // Check memory pressure
  const checkMemoryPressure = () => {
    if (typeof performance === 'undefined' || !performance.memory) return;
    
    const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
    
    if (memoryMB > state.config.memoryPressureThreshold) {
      console.warn(`⚠️ High memory usage detected: ${memoryMB.toFixed(1)}MB`);
      
      // Aggressive cleanup
      const beforeCleanup = getTotalPoolSize();
      performCleanup();
      
      // If still high, clear half of each pool
      if (memoryMB > state.config.memoryPressureThreshold * 1.2) {
        clearPools(0.5);
        console.warn(`🧹 Emergency pool clearing performed`);
      }
      
      const afterCleanup = getTotalPoolSize();
      console.log(`📊 Pool size reduced from ${beforeCleanup} to ${afterCleanup} objects`);
    }
  };

  // Clear pools (percentage to clear)
  const clearPools = (percentage = 1.0) => {
    const clearCount = Math.ceil;
    
    state.pools.objects.forEach((pool, key) => {
      const toClear = clearCount(pool.length * percentage);
      pool.splice(0, toClear);
    });
    
    state.pools.arrays.forEach((pool, key) => {
      const toClear = clearCount(pool.length * percentage);
      pool.splice(0, toClear);
    });
    
    state.pools.canvases.forEach((pool, key) => {
      const toClear = clearCount(pool.length * percentage);
      pool.splice(0, toClear);
    });
  };

  // Get total pool size
  const getTotalPoolSize = () => {
    let total = 0;
    
    state.pools.objects.forEach(pool => total += pool.length);
    state.pools.arrays.forEach(pool => total += pool.length);
    state.pools.canvases.forEach(pool => total += pool.length);
    
    return total;
  };

  // Get detailed statistics
  const getStats = () => {
    const poolSizes = {};
    
    state.pools.objects.forEach((pool, key) => {
      poolSizes[key] = { type: 'object', size: pool.length };
    });
    
    state.pools.arrays.forEach((pool, key) => {
      poolSizes[key] = { type: 'array', size: pool.length };
    });
    
    state.pools.canvases.forEach((pool, key) => {
      poolSizes[key] = { type: 'canvas', size: pool.length };
    });
    
    const efficiency = state.stats.allocations > 0 
      ? (state.stats.reuseHits / state.stats.allocations * 100).toFixed(1)
      : '0.0';
    
    return {
      ...state.stats,
      poolSizes,
      totalPoolSize: getTotalPoolSize(),
      efficiency: `${efficiency}%`,
      activeObjects: state.activeObjects ? 'tracked' : 'not tracked',
      memoryUsage: typeof performance !== 'undefined' && performance.memory
        ? `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`
        : 'not available'
    };
  };

  // Cleanup function
  const cleanup = () => {
    if (state.cleanupTimer) {
      clearInterval(state.cleanupTimer);
      state.cleanupTimer = null;
    }
    
    clearPools(1.0); // Clear all pools
    
    console.log('🧹 Enhanced memory pool cleaned up');
  };

  return {
    // Core functionality
    initialize,
    cleanup,
    
    // Object management
    acquire,
    release,
    acquireArray,
    releaseArray,
    acquireCanvas,
    releaseCanvas,
    
    // Configuration
    registerFactory,
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
    },
    
    // Monitoring
    getStats,
    performCleanup,
    clearPools,
    
    // Utilities
    createPoolKey,
    getTotalPoolSize
  };
};

// Create default memory pool instance
export const defaultMemoryPool = createEnhancedMemoryPool();