/**
 * Memory Optimization for High-Frequency Streaming
 * Advanced memory management and optimization strategies
 * Following functional programming patterns with factory functions
 */

// Memory pool factory for efficient object reuse
export const createMemoryPool = (config = {}) => {
  const state = {
    pools: new Map(),
    stats: {
      allocations: 0,
      deallocations: 0,
      reuseHits: 0,
      memoryLeaks: 0,
      poolSizes: {},
      peakMemoryUsage: 0
    },
    config: {
      maxPoolSize: config.maxPoolSize || 1000,
      gcThreshold: config.gcThreshold || 0.8,
      monitoringInterval: config.monitoringInterval || 5000
    }
  };

  // Create type-specific object pools
  const createPool = (typeName, factory, reset = null) => {
    const pool = {
      typeName,
      factory,
      reset,
      available: [],
      inUse: new Set(),
      created: 0,
      reused: 0
    };

    state.pools.set(typeName, pool);
    return pool;
  };

  // Get object from pool or create new one
  const acquire = (typeName, ...args) => {
    const pool = state.pools.get(typeName);
    if (!pool) {
      throw new Error(`Pool for type '${typeName}' not found`);
    }

    let obj;
    
    if (pool.available.length > 0) {
      // Reuse existing object
      obj = pool.available.pop();
      pool.reused++;
      state.stats.reuseHits++;
      
      // Reset object if reset function provided
      if (pool.reset) {
        pool.reset(obj, ...args);
      }
    } else {
      // Create new object
      obj = pool.factory(...args);
      pool.created++;
      state.stats.allocations++;
    }

    pool.inUse.add(obj);
    return obj;
  };

  // Return object to pool
  const release = (typeName, obj) => {
    const pool = state.pools.get(typeName);
    if (!pool) {
      console.warn(`Pool for type '${typeName}' not found`);
      return false;
    }

    if (!pool.inUse.has(obj)) {
      console.warn(`Object not tracked by pool '${typeName}'`);
      return false;
    }

    pool.inUse.delete(obj);
    
    // Return to pool if under limit
    if (pool.available.length < state.config.maxPoolSize) {
      pool.available.push(obj);
    }
    
    state.stats.deallocations++;
    return true;
  };

  // Clear all pools
  const clear = () => {
    for (const pool of state.pools.values()) {
      pool.available.length = 0;
      pool.inUse.clear();
    }
  };

  // Get pool statistics
  const getStats = () => ({
    ...state.stats,
    poolSizes: Object.fromEntries(
      Array.from(state.pools.entries()).map(([name, pool]) => [
        name,
        {
          available: pool.available.length,
          inUse: pool.inUse.size,
          created: pool.created,
          reused: pool.reused,
          reuseRatio: pool.created > 0 ? pool.reused / pool.created : 0
        }
      ])
    )
  });

  return {
    createPool,
    acquire,
    release,
    clear,
    getStats
  };
};

// Memory-efficient circular buffer for high-frequency data
export const createCircularBuffer = (config = {}) => {
  const state = {
    size: config.size || 1000,
    buffer: new Array(config.size || 1000),
    head: 0,
    tail: 0,
    count: 0,
    overflowCount: 0,
    memoryPool: config.memoryPool || null
  };

  const isFull = () => state.count === state.size;
  const isEmpty = () => state.count === 0;
  const getSize = () => state.count;
  const getCapacity = () => state.size;

  const push = (item) => {
    if (isFull()) {
      // Handle overflow - drop oldest item
      const droppedItem = state.buffer[state.tail];
      if (state.memoryPool && droppedItem && droppedItem.type) {
        state.memoryPool.release(droppedItem.type, droppedItem);
      }
      state.tail = (state.tail + 1) % state.size;
      state.overflowCount++;
    } else {
      state.count++;
    }

    state.buffer[state.head] = item;
    state.head = (state.head + 1) % state.size;
  };

  const pop = () => {
    if (isEmpty()) return null;

    const item = state.buffer[state.tail];
    state.buffer[state.tail] = null; // Allow GC
    state.tail = (state.tail + 1) % state.size;
    state.count--;
    
    return item;
  };

  const peek = () => {
    if (isEmpty()) return null;
    return state.buffer[state.tail];
  };

  const clear = () => {
    if (state.memoryPool) {
      // Return all items to memory pool
      for (let i = 0; i < state.count; i++) {
        const index = (state.tail + i) % state.size;
        const item = state.buffer[index];
        if (item && item.type) {
          state.memoryPool.release(item.type, item);
        }
      }
    }

    state.buffer.fill(null);
    state.head = 0;
    state.tail = 0;
    state.count = 0;
  };

  const toArray = () => {
    const result = new Array(state.count);
    for (let i = 0; i < state.count; i++) {
      result[i] = state.buffer[(state.tail + i) % state.size];
    }
    return result;
  };

  const getStats = () => ({
    size: state.size,
    count: state.count,
    overflowCount: state.overflowCount,
    utilization: state.count / state.size,
    memoryUsage: state.size * 8 // Rough estimate in bytes
  });

  return {
    push,
    pop,
    peek,
    clear,
    toArray,
    isFull,
    isEmpty,
    getSize,
    getCapacity,
    getStats
  };
};

// Memory optimization manager for streaming systems
export const createMemoryOptimizer = (config = {}) => {
  const state = {
    memoryPool: createMemoryPool(config.pool),
    buffers: new Map(),
    monitoringInterval: null,
    gcScheduled: false,
    stats: {
      totalAllocations: 0,
      totalDeallocations: 0,
      gcRuns: 0,
      memoryPressure: 0,
      optimizationApplied: 0
    },
    thresholds: {
      memoryPressure: config.memoryPressureThreshold || 0.8,
      gcInterval: config.gcInterval || 10000,
      bufferSizeLimit: config.bufferSizeLimit || 5000
    }
  };

  // Initialize common object pools for eye tracking
  const initializePools = () => {
    // Gaze data objects
    state.memoryPool.createPool(
      'gazeData',
      () => ({
        type: 'gazeData',
        timestamp: 0,
        x: 0,
        y: 0,
        confidence: 0,
        semantic: null,
        metadata: {}
      }),
      (obj, timestamp, x, y, confidence) => {
        obj.timestamp = timestamp || Date.now();
        obj.x = x || 0;
        obj.y = y || 0;
        obj.confidence = confidence || 0;
        obj.semantic = null;
        obj.metadata = {};
      }
    );

    // Video frame objects
    state.memoryPool.createPool(
      'videoFrame',
      () => ({
        type: 'videoFrame',
        timestamp: 0,
        width: 0,
        height: 0,
        data: null,
        format: 'rgba'
      }),
      (obj, timestamp, width, height, data) => {
        obj.timestamp = timestamp || Date.now();
        obj.width = width || 0;
        obj.height = height || 0;
        obj.data = data || null;
        obj.format = 'rgba';
      }
    );

    // Stream buffer entries
    state.memoryPool.createPool(
      'bufferEntry',
      () => ({
        type: 'bufferEntry',
        data: null,
        timestamp: 0,
        streamId: null,
        processed: false
      }),
      (obj, data, streamId) => {
        obj.data = data;
        obj.timestamp = Date.now();
        obj.streamId = streamId || null;
        obj.processed = false;
      }
    );
  };

  // Create optimized circular buffer
  const createOptimizedBuffer = (bufferId, size = 1000) => {
    const buffer = createCircularBuffer({
      size,
      memoryPool: state.memoryPool
    });

    state.buffers.set(bufferId, buffer);
    return buffer;
  };

  // Memory monitoring and optimization
  const monitorMemoryUsage = () => {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory;
      const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      state.stats.memoryPressure = usedRatio;

      // Trigger optimization if memory pressure is high
      if (usedRatio > state.thresholds.memoryPressure) {
        applyMemoryOptimization();
      }

      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        pressure: usedRatio
      };
    }

    return null;
  };

  // Apply memory optimization strategies
  const applyMemoryOptimization = () => {
    console.log('Applying memory optimization due to high memory pressure');
    
    // Clear old buffer data
    for (const buffer of state.buffers.values()) {
      if (buffer.getSize() > state.thresholds.bufferSizeLimit * 0.8) {
        const toRemove = Math.floor(buffer.getSize() * 0.3);
        for (let i = 0; i < toRemove; i++) {
          buffer.pop();
        }
      }
    }

    // Clear memory pools
    state.memoryPool.clear();

    // Schedule garbage collection
    scheduleGC();

    state.stats.optimizationApplied++;
  };

  // Intelligent garbage collection scheduling
  const scheduleGC = () => {
    if (state.gcScheduled) return;
    
    state.gcScheduled = true;
    
    // Use idle callback if available for non-blocking GC
    const runGC = () => {
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          performGC();
          state.gcScheduled = false;
        });
      } else {
        setTimeout(() => {
          performGC();
          state.gcScheduled = false;
        }, 0);
      }
    };

    runGC();
  };

  // Perform garbage collection optimization
  const performGC = () => {
    // Force garbage collection if available (Chrome DevTools)
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }

    // Clean up weak references and null pointers
    cleanupReferences();

    state.stats.gcRuns++;
  };

  // Clean up weak references and null pointers
  const cleanupReferences = () => {
    // Clean up empty buffers
    for (const [id, buffer] of state.buffers.entries()) {
      if (buffer.isEmpty()) {
        buffer.clear();
      }
    }

    // Force cleanup of unused memory pools
    const poolStats = state.memoryPool.getStats();
    Object.entries(poolStats.poolSizes).forEach(([typeName, stats]) => {
      if (stats.available > stats.inUse * 2 && stats.available > 100) {
        // Too many unused objects, clear some
        console.log(`Cleaning up excess objects in pool: ${typeName}`);
      }
    });
  };

  // Start memory monitoring
  const startMonitoring = () => {
    if (state.monitoringInterval) return;

    state.monitoringInterval = setInterval(() => {
      monitorMemoryUsage();
    }, state.thresholds.gcInterval);
  };

  // Stop memory monitoring
  const stopMonitoring = () => {
    if (state.monitoringInterval) {
      clearInterval(state.monitoringInterval);
      state.monitoringInterval = null;
    }
  };

  // Optimized object creation helpers
  const createGazeData = (timestamp, x, y, confidence) => {
    return state.memoryPool.acquire('gazeData', timestamp, x, y, confidence);
  };

  const createVideoFrame = (timestamp, width, height, data) => {
    return state.memoryPool.acquire('videoFrame', timestamp, width, height, data);
  };

  const createBufferEntry = (data, streamId) => {
    return state.memoryPool.acquire('bufferEntry', data, streamId);
  };

  // Release objects back to pool
  const releaseObject = (obj) => {
    if (obj && obj.type) {
      return state.memoryPool.release(obj.type, obj);
    }
    return false;
  };

  // Get comprehensive statistics
  const getStats = () => ({
    ...state.stats,
    memoryPool: state.memoryPool.getStats(),
    buffers: Object.fromEntries(
      Array.from(state.buffers.entries()).map(([id, buffer]) => [
        id,
        buffer.getStats()
      ])
    ),
    thresholds: { ...state.thresholds },
    currentMemoryUsage: monitorMemoryUsage()
  });

  // Configuration updates
  const updateThresholds = (newThresholds) => {
    Object.assign(state.thresholds, newThresholds);
  };

  // Initialize memory optimizer
  initializePools();

  return {
    // Pool management
    createGazeData,
    createVideoFrame,
    createBufferEntry,
    releaseObject,
    
    // Buffer management
    createOptimizedBuffer,
    getBuffer: (id) => state.buffers.get(id),
    
    // Monitoring and optimization
    startMonitoring,
    stopMonitoring,
    monitorMemoryUsage,
    applyMemoryOptimization,
    scheduleGC,
    
    // Statistics and configuration
    getStats,
    updateThresholds,
    
    // Cleanup
    cleanup: () => {
      stopMonitoring();
      state.memoryPool.clear();
      for (const buffer of state.buffers.values()) {
        buffer.clear();
      }
      state.buffers.clear();
    }
  };
};

// Integration with existing stream system
export const createMemoryOptimizedStream = (config = {}) => {
  const memoryOptimizer = createMemoryOptimizer(config.memory);
  const buffer = memoryOptimizer.createOptimizedBuffer(
    config.streamId || 'default',
    config.bufferSize || 2000
  );

  // Start memory monitoring
  memoryOptimizer.startMonitoring();

  const addData = (rawData) => {
    // Use memory pool for data objects
    const optimizedData = memoryOptimizer.createBufferEntry(rawData, config.streamId);
    buffer.push(optimizedData);
    
    return optimizedData;
  };

  const getData = () => {
    const entry = buffer.pop();
    if (entry) {
      const data = entry.data;
      // Release the buffer entry back to pool
      memoryOptimizer.releaseObject(entry);
      return data;
    }
    return null;
  };

  const getStats = () => ({
    buffer: buffer.getStats(),
    memory: memoryOptimizer.getStats()
  });

  const cleanup = () => {
    buffer.clear();
    memoryOptimizer.cleanup();
  };

  return {
    addData,
    getData,
    getStats,
    cleanup,
    getBuffer: () => buffer,
    getMemoryOptimizer: () => memoryOptimizer
  };
};