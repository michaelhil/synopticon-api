/**
 * Resource Pooling System
 * Provides efficient resource management for canvas, WebGL contexts, and memory buffers
 * Reduces garbage collection pressure and improves performance across all pipelines
 */

import { createResourcePoolConfig, createResourcePoolState } from './resource-pool-config.js';
import { createCanvasManager } from './resource-pool-canvas.js';
import { createWebGLManager } from './resource-pool-webgl.js';
import { createBufferManager } from './resource-pool-buffers.js';
import { createGarbageCollector } from './resource-pool-gc.js';
import { createMetricsManager } from './resource-pool-metrics.js';

// Global resource pool instance with lazy loading
let globalResourcePool = null;
let webglResourcePoolPromise = null;

/**
 * Creates a resource pool for efficient resource management
 * @param {Object} config - Pool configuration
 * @returns {Object} - Resource pool instance
 */
export const createResourcePool = (config = {}) => {
  const poolConfig = createResourcePoolConfig(config);
  const state = createResourcePoolState(poolConfig);
  
  // Create modular managers
  const canvasManager = createCanvasManager(state, poolConfig);
  const webglManager = createWebGLManager(state, poolConfig, canvasManager);
  const bufferManager = createBufferManager(state, poolConfig);
  const garbageCollector = createGarbageCollector(state, poolConfig, canvasManager);
  const metricsManager = createMetricsManager(state, poolConfig, garbageCollector);
  
  // Initialize garbage collection if enabled
  if (poolConfig.enableGarbageCollection) {
    garbageCollector.startGarbageCollection();
  }
  
  return {
    // Canvas management
    getCanvas: canvasManager.getCanvas,
    returnCanvas: canvasManager.returnCanvas,
    
    // WebGL context management
    getWebGLContext: webglManager.getWebGLContext,
    returnWebGLContext: webglManager.returnWebGLContext,
    
    // Buffer management
    getImageBuffer: bufferManager.getImageBuffer,
    returnImageBuffer: bufferManager.returnImageBuffer,
    getTypedArray: bufferManager.getTypedArray,
    returnTypedArray: bufferManager.returnTypedArray,
    
    // Lifecycle management
    startGarbageCollection: garbageCollector.startGarbageCollection,
    performGarbageCollection: garbageCollector.performGarbageCollection,
    cleanup: garbageCollector.cleanup,
    
    // Metrics and monitoring
    getMetrics: metricsManager.getMetrics,
    
    // Configuration
    getConfig: () => ({ ...poolConfig })
  };
};

/**
 * Gets the global resource pool instance with basic resources (non-WebGL)
 * @returns {Object} - Global resource pool
 */
export const getGlobalResourcePool = () => {
  if (!globalResourcePool) {
    globalResourcePool = createResourcePool({ enableWebGL: false });
  }
  return globalResourcePool;
};

/**
 * Lazy loader for WebGL resource pool - only loads when WebGL is actually needed
 * @returns {Promise<Object>} - WebGL-enabled resource pool
 */
export const getWebGLResourcePool = async () => {
  if (!webglResourcePoolPromise) {
    webglResourcePoolPromise = (async () => {
      console.log('🔄 Lazy loading WebGL resource pool...');
      
      // Check WebGL support before loading WebGL components
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        canvas.remove();
        throw new Error('WebGL not supported - cannot create WebGL resource pool');
      }
      
      // Cleanup test context
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
      canvas.remove();
      
      // Create WebGL-enabled resource pool
      const webglPool = createResourcePool({ 
        enableWebGL: true,
        maxWebGLContexts: 10,
        enableGarbageCollection: true,
        gcInterval: 30000
      });
      
      console.log('✅ WebGL resource pool lazy loaded');
      return webglPool;
    })();
  }
  
  return webglResourcePoolPromise;
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
