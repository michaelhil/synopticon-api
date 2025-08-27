/**
import { createLogger } from '../shared/utils/logger.js';

const logger = createLogger({ level: 2 });
 * Memory Optimization Module
 * Enhanced implementation with canvas pooling and buffer management
 */

export const createMemoryOptimizer = (config = {}) => {
  const state = {
    isMonitoring: false,
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    },
    thresholds: {
      warning: config.memoryPressureThreshold || 0.8,
      critical: 0.9
    },
    canvasPool: new Map(), // size -> canvas[]
    bufferPool: new Map(), // size -> buffer[]
    poolStats: {
      canvasHits: 0,
      canvasMisses: 0,
      bufferHits: 0,
      bufferMisses: 0,
      totalAllocated: 0,
      totalReused: 0
    }
  };

  const startMonitoring = () => {
    if (state.isMonitoring) return;
    
    state.isMonitoring = true;
    console.log('📊 Memory monitoring started with pooling optimization');
    
    // Monitor memory usage every 30 seconds
    state.monitoringInterval = setInterval(() => {
      updateMemoryStats();
      
      const usage = state.memoryUsage;
      const pressureRatio = usage.heapUsed / usage.heapTotal;
      
      if (pressureRatio > state.thresholds.critical) {
        console.warn('🔴 Critical memory pressure detected:', {
          heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)  }MB`,
          heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)  }MB`,
          pressure: `${Math.round(pressureRatio * 100)  }%`
        });
        performAggressiveCleanup();
      } else if (pressureRatio > state.thresholds.warning) {
        console.warn('🟡 Memory pressure warning:', {
          heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)  }MB`,
          pressure: `${Math.round(pressureRatio * 100)  }%`
        });
        performMildCleanup();
      }
    }, 30000);
  };

  const stopMonitoring = () => {
    if (!state.isMonitoring) return;
    
    state.isMonitoring = false;
    if (state.monitoringInterval) {
      clearInterval(state.monitoringInterval);
      state.monitoringInterval = null;
    }
  };

  const updateMemoryStats = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      state.memoryUsage = process.memoryUsage();
    }
  };

  const performMildCleanup = () => {
    // Trim canvas pool to 50% for each size
    for (const [size, canvases] of state.canvasPool.entries()) {
      if (canvases.length > 2) {
        const keepCount = Math.ceil(canvases.length / 2);
        state.canvasPool.set(size, canvases.slice(0, keepCount));
      }
    }
    
    // Trim buffer pool to 50%
    for (const [size, buffers] of state.bufferPool.entries()) {
      if (buffers.length > 2) {
        const keepCount = Math.ceil(buffers.length / 2);
        state.bufferPool.set(size, buffers.slice(0, keepCount));
      }
    }
    
    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  };

  const performAggressiveCleanup = () => {
    // Clear most of the pools, keeping only 1 item per size
    for (const [size, canvases] of state.canvasPool.entries()) {
      if (canvases.length > 1) {
        state.canvasPool.set(size, canvases.slice(0, 1));
      }
    }
    
    for (const [size, buffers] of state.bufferPool.entries()) {
      if (buffers.length > 1) {
        state.bufferPool.set(size, buffers.slice(0, 1));
      }
    }
    
    // Force multiple garbage collections
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
      setTimeout(() => global.gc(), 100);
    }
  };

  // Canvas pooling for image processing
  const getCanvas = (width, height) => {
    const size = `${width}x${height}`;
    const pool = state.canvasPool.get(size) || [];
    
    if (pool.length > 0) {
      state.poolStats.canvasHits++;
      state.poolStats.totalReused++;
      return pool.pop();
    }
    
    state.poolStats.canvasMisses++;
    state.poolStats.totalAllocated++;
    
    // Create new canvas (browser environment)
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    
    // Node.js environment - return a mock canvas-like object
    return {
      width,
      height,
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4), width, height })
      })
    };
  };

  const returnCanvas = (canvas) => {
    const size = `${canvas.width}x${canvas.height}`;
    const pool = state.canvasPool.get(size) || [];
    
    // Limit pool size to prevent memory leaks
    if (pool.length < 5) {
      // Clear canvas before returning to pool
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      pool.push(canvas);
      state.canvasPool.set(size, pool);
    }
  };

  // Buffer pooling for data processing
  const getBuffer = (size) => {
    const pool = state.bufferPool.get(size) || [];
    
    if (pool.length > 0) {
      state.poolStats.bufferHits++;
      state.poolStats.totalReused++;
      const buffer = pool.pop();
      buffer.fill(0); // Clear buffer data
      return buffer;
    }
    
    state.poolStats.bufferMisses++;
    state.poolStats.totalAllocated++;
    
    return new ArrayBuffer(size);
  };

  const returnBuffer = (buffer) => {
    const size = buffer.byteLength;
    const pool = state.bufferPool.get(size) || [];
    
    // Limit pool size to prevent memory leaks
    if (pool.length < 10) {
      pool.push(buffer);
      state.bufferPool.set(size, pool);
    }
  };

  const createOptimizedBuffer = (streamId, maxSize) => {
    return {
      data: [],
      maxSize,
      streamId,
      add: (item) => {
        if (state.data) {
          state.data.push(item);
          if (state.data.length > maxSize) {
            state.data = state.data.slice(-maxSize);
          }
        }
      },
      clear: () => {
        if (state.data) {
          state.data = [];
        }
      },
      getSize: () => state.data ? state.data.length : 0
    };
  };

  const cleanup = () => {
    stopMonitoring();
    
    // Clear all pools
    state.canvasPool.clear();
    state.bufferPool.clear();
    
    // Reset stats
    state.poolStats = {
      canvasHits: 0,
      canvasMisses: 0,
      bufferHits: 0,
      bufferMisses: 0,
      totalAllocated: 0,
      totalReused: 0
    };
    
    console.log('🧹 Memory optimizer cleanup completed');
  };

  const getMemoryStats = () => {
    updateMemoryStats();
    return state.memoryUsage;
  };

  const getPoolingStats = () => {
    return {
      ...state.poolStats,
      canvasPoolSizes: Array.from(state.canvasPool.entries()).map(([size, pool]) => ({ size, count: pool.length })),
      bufferPoolSizes: Array.from(state.bufferPool.entries()).map(([size, pool]) => ({ size, count: pool.length })),
      hitRate: {
        canvas: state.poolStats.canvasHits / (state.poolStats.canvasHits + state.poolStats.canvasMisses) || 0,
        buffer: state.poolStats.bufferHits / (state.poolStats.bufferHits + state.poolStats.bufferMisses) || 0
      },
      reuseRate: state.poolStats.totalReused / (state.poolStats.totalAllocated || 1)
    };
  };

  return {
    startMonitoring,
    stopMonitoring,
    createOptimizedBuffer,
    getCanvas,
    returnCanvas,
    getBuffer,
    returnBuffer,
    cleanup,
    getMemoryStats,
    getPoolingStats,
    isMonitoring: () => state.isMonitoring
  };
};

