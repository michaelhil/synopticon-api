/**
 * Resource Pooling System
 * Provides efficient resource management for canvas, WebGL contexts, and memory buffers
 * Reduces garbage collection pressure and improves performance across all pipelines
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';

// Global resource pool instance
let globalResourcePool = null;

/**
 * Creates a resource pool for efficient resource management
 * @param {Object} config - Pool configuration
 * @returns {Object} - Resource pool instance
 */
export const createResourcePool = (config = {}) => {
  const poolConfig = {
    maxCanvasElements: config.maxCanvasElements || 10,
    maxWebGLContexts: config.maxWebGLContexts || 5,
    maxImageBuffers: config.maxImageBuffers || 20,
    maxTypedArrays: config.maxTypedArrays || 50,
    enableGarbageCollection: config.enableGarbageCollection !== false,
    gcInterval: config.gcInterval || 30000, // 30 seconds
    enableMetrics: config.enableMetrics !== false,
    ...config
  };
  
  const state = {
    canvasPool: [],
    webglContextPool: new Map(), // Key: context type, Value: array of contexts
    imageBufferPool: new Map(),  // Key: size, Value: array of buffers
    typedArrayPool: new Map(),   // Key: type_size, Value: array of arrays
    metricsData: {
      canvasCreated: 0,
      canvasReused: 0,
      contextsCreated: 0,
      contextsReused: 0,
      buffersCreated: 0,
      buffersReused: 0,
      totalAllocations: 0,
      totalDeallocations: 0,
      memoryPressure: 0
    },
    isCleanupScheduled: false,
    gcTimer: null
  };
  
  // Start garbage collection timer if enabled (will be defined below)
  let gcStarted = false;
  
  /**
   * Gets a canvas element from the pool or creates a new one
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {HTMLCanvasElement} - Canvas element
   */
  const getCanvas = (width = 640, height = 480) => {
    let canvas = null;
    
    // Try to find a suitable canvas in the pool
    for (let i = 0; i < state.canvasPool.length; i++) {
      const pooledCanvas = state.canvasPool[i];
      if (pooledCanvas.width >= width && pooledCanvas.height >= height) {
        // Remove from pool and resize if needed
        canvas = state.canvasPool.splice(i, 1)[0];
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        break;
      }
    }
    
    // Create new canvas if none available
    if (!canvas) {
      if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        state.metricsData.canvasCreated++;
      } else {
        // Node.js environment - create mock canvas
        canvas = createMockCanvas(width, height);
        state.metricsData.canvasCreated++;
      }
    } else {
      state.metricsData.canvasReused++;
    }
    
    state.metricsData.totalAllocations++;
    return canvas;
  };
  
  /**
   * Returns a canvas to the pool for reuse
   * @param {HTMLCanvasElement} canvas - Canvas to return
   */
  const returnCanvas = (canvas) => {
    if (!canvas) return;
    
    try {
      // Clear canvas content
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Only pool if we haven't exceeded the limit
      if (state.canvasPool.length < poolConfig.maxCanvasElements) {
        state.canvasPool.push(canvas);
      }
      
      state.metricsData.totalDeallocations++;
    } catch (error) {
      handleError(
        `Error returning canvas to pool: ${error.message}`,
        ErrorCategory.MEMORY,
        ErrorSeverity.WARNING
      );
    }
  };
  
  /**
   * Gets a WebGL context from the pool or creates a new one
   * @param {string} type - Context type ('webgl' or 'webgl2')
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {Object} - { context, canvas } object
   */
  const getWebGLContext = (type = 'webgl2', width = 640, height = 480) => {
    const contextPool = state.webglContextPool.get(type) || [];
    let contextInfo = null;
    
    // Try to reuse existing context
    for (let i = 0; i < contextPool.length; i++) {
      const pooledInfo = contextPool[i];
      if (!pooledInfo.inUse && 
          pooledInfo.canvas.width >= width && 
          pooledInfo.canvas.height >= height) {
        contextInfo = contextPool.splice(i, 1)[0];
        contextInfo.inUse = true;
        
        // Resize canvas if needed
        if (contextInfo.canvas.width !== width || contextInfo.canvas.height !== height) {
          contextInfo.canvas.width = width;
          contextInfo.canvas.height = height;
          contextInfo.context.viewport(0, 0, width, height);
        }
        
        state.metricsData.contextsReused++;
        break;
      }
    }
    
    // Create new context if none available
    if (!contextInfo) {
      const canvas = getCanvas(width, height);
      const context = canvas.getContext(type) || canvas.getContext('webgl');
      
      if (!context) {
        returnCanvas(canvas);
        throw new Error(`Failed to create ${type} context`);
      }
      
      contextInfo = {
        context,
        canvas,
        type,
        inUse: true,
        created: Date.now()
      };
      
      state.metricsData.contextsCreated++;
    }
    
    state.metricsData.totalAllocations++;
    return contextInfo;
  };
  
  /**
   * Returns a WebGL context to the pool
   * @param {Object} contextInfo - Context info object
   */
  const returnWebGLContext = (contextInfo) => {
    if (!contextInfo) return;
    
    try {
      // Clear WebGL state
      const gl = contextInfo.context;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      contextInfo.inUse = false;
      
      // Return to pool if under limit
      const contextPool = state.webglContextPool.get(contextInfo.type) || [];
      if (contextPool.length < poolConfig.maxWebGLContexts) {
        contextPool.push(contextInfo);
        state.webglContextPool.set(contextInfo.type, contextPool);
      } else {
        // Pool full, clean up resources
        returnCanvas(contextInfo.canvas);
      }
      
      state.metricsData.totalDeallocations++;
    } catch (error) {
      handleError(
        `Error returning WebGL context to pool: ${error.message}`,
        ErrorCategory.WEBGL,
        ErrorSeverity.WARNING
      );
    }
  };
  
  /**
   * Gets an image data buffer from the pool
   * @param {number} width - Buffer width
   * @param {number} height - Buffer height
   * @param {number} channels - Number of channels (3 for RGB, 4 for RGBA)
   * @returns {Uint8Array} - Image buffer
   */
  const getImageBuffer = (width, height, channels = 4) => {
    const size = width * height * channels;
    const sizeKey = `${width}x${height}x${channels}`;
    const bufferPool = state.imageBufferPool.get(sizeKey) || [];
    
    let buffer = bufferPool.pop();
    
    if (!buffer) {
      buffer = new Uint8Array(size);
      state.metricsData.buffersCreated++;
    } else {
      // Clear buffer data
      buffer.fill(0);
      state.metricsData.buffersReused++;
    }
    
    state.metricsData.totalAllocations++;
    return buffer;
  };
  
  /**
   * Returns an image buffer to the pool
   * @param {Uint8Array} buffer - Buffer to return
   * @param {number} width - Buffer width
   * @param {number} height - Buffer height
   * @param {number} channels - Number of channels
   */
  const returnImageBuffer = (buffer, width, height, channels = 4) => {
    if (!buffer) return;
    
    const sizeKey = `${width}x${height}x${channels}`;
    const bufferPool = state.imageBufferPool.get(sizeKey) || [];
    
    if (bufferPool.length < poolConfig.maxImageBuffers) {
      bufferPool.push(buffer);
      state.imageBufferPool.set(sizeKey, bufferPool);
    }
    
    state.metricsData.totalDeallocations++;
  };
  
  /**
   * Gets a typed array from the pool
   * @param {string} type - Array type ('Float32Array', 'Int32Array', etc.)
   * @param {number} size - Array size
   * @returns {TypedArray} - Typed array
   */
  const getTypedArray = (type = 'Float32Array', size) => {
    const poolKey = `${type}_${size}`;
    const arrayPool = state.typedArrayPool.get(poolKey) || [];
    
    let array = arrayPool.pop();
    
    if (!array) {
      const ArrayConstructor = globalThis[type];
      if (!ArrayConstructor) {
        throw new Error(`Unknown typed array type: ${type}`);
      }
      array = new ArrayConstructor(size);
      state.metricsData.buffersCreated++;
    } else {
      // Clear array data
      array.fill(0);
      state.metricsData.buffersReused++;
    }
    
    state.metricsData.totalAllocations++;
    return array;
  };
  
  /**
   * Returns a typed array to the pool
   * @param {TypedArray} array - Array to return
   * @param {string} type - Array type
   */
  const returnTypedArray = (array, type) => {
    if (!array) return;
    
    const poolKey = `${type}_${array.length}`;
    const arrayPool = state.typedArrayPool.get(poolKey) || [];
    
    if (arrayPool.length < poolConfig.maxTypedArrays) {
      arrayPool.push(array);
      state.typedArrayPool.set(poolKey, arrayPool);
    }
    
    state.metricsData.totalDeallocations++;
  };
  
  /**
   * Starts garbage collection timer
   */
  const startGarbageCollection = () => {
    if (state.gcTimer) return;
    
    state.gcTimer = setInterval(() => {
      performGarbageCollection();
    }, poolConfig.gcInterval);
  };
  
  /**
   * Performs garbage collection on pooled resources
   */
  const performGarbageCollection = () => {
    try {
      const now = Date.now();
      const maxAge = poolConfig.gcInterval * 2; // Resources older than 2x GC interval
      
      // Clean old WebGL contexts
      for (const [type, contextPool] of state.webglContextPool.entries()) {
        const freshContexts = contextPool.filter(info => {
          if (!info.inUse && (now - info.created) > maxAge) {
            returnCanvas(info.canvas);
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
  
  /**
   * Updates memory pressure metric
   */
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
  
  /**
   * Creates a mock canvas for Node.js environment
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {Object} - Mock canvas object
   */
  const createMockCanvas = (width, height) => {
    return {
      width,
      height,
      getContext: (type) => {
        if (type === '2d') {
          return {
            clearRect: () => {},
            fillRect: () => {},
            drawImage: () => {},
            getImageData: () => ({ data: new Uint8Array(width * height * 4), width, height }),
            putImageData: () => {}
          };
        }
        return null;
      }
    };
  };
  
  /**
   * Gets current pool metrics
   * @returns {Object} - Pool metrics
   */
  const getMetrics = () => {
    if (!poolConfig.enableMetrics) {
      return { enabled: false };
    }
    
    updateMemoryPressure();
    
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
  
  /**
   * Clears all pools and releases resources
   */
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
  
  // Initialize garbage collection after functions are defined
  if (poolConfig.enableGarbageCollection && !gcStarted) {
    startGarbageCollection();
    gcStarted = true;
  }
  
  return {
    // Canvas management
    getCanvas,
    returnCanvas,
    
    // WebGL context management
    getWebGLContext,
    returnWebGLContext,
    
    // Buffer management
    getImageBuffer,
    returnImageBuffer,
    getTypedArray,
    returnTypedArray,
    
    // Lifecycle management
    startGarbageCollection,
    performGarbageCollection,
    cleanup,
    
    // Metrics and monitoring
    getMetrics,
    
    // Configuration
    getConfig: () => ({ ...poolConfig })
  };
};

/**
 * Gets the global resource pool instance
 * @returns {Object} - Global resource pool
 */
export const getGlobalResourcePool = () => {
  if (!globalResourcePool) {
    globalResourcePool = createResourcePool();
  }
  return globalResourcePool;
};

/**
 * Sets a custom global resource pool
 * @param {Object} pool - Resource pool instance
 */
export const setGlobalResourcePool = (pool) => {
  if (globalResourcePool) {
    globalResourcePool.cleanup();
  }
  globalResourcePool = pool;
};

// Export default resource pool for convenience
export default getGlobalResourcePool;