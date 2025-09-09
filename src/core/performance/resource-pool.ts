/**
 * Resource Pooling System
 * Provides efficient resource management for canvas, WebGL contexts, and memory buffers
 * Reduces garbage collection pressure and improves performance across all pipelines
 */

import { 
  createResourcePoolConfig, 
  createResourcePoolState,
  type ResourcePoolConfig,
  type ResourcePoolState 
} from './resource-pool-config.js'
import { createCanvasManager } from './resource-pool-canvas.js';
import { createWebGLManager } from './resource-pool-webgl.js';
import { createBufferManager } from './resource-pool-buffers.js';
import { createGarbageCollector } from './resource-pool-gc.js';
import { createMetricsManager } from './resource-pool-metrics.js';

export interface ResourcePool {
  // Canvas management
  getCanvas: (width: number, height: number) => HTMLCanvasElement;
  returnCanvas: (canvas: HTMLCanvasElement) => void;
  
  // WebGL context management
  getWebGLContext: (type: string, attributes?: WebGLContextAttributes) => WebGLRenderingContext | WebGL2RenderingContext | null;
  returnWebGLContext: (context: WebGLRenderingContext | WebGL2RenderingContext) => void;
  
  // Buffer management
  getImageBuffer: (width: number, height: number, channels: number) => Uint8Array;
  returnImageBuffer: (buffer: Uint8Array) => void;
  getTypedArray: (type: string, size: number) => Float32Array | Uint8Array | Uint16Array | Int32Array;
  returnTypedArray: (array: Float32Array | Uint8Array | Uint16Array | Int32Array) => void;
  
  // Lifecycle management
  startGarbageCollection: () => void;
  performGarbageCollection: () => void;
  cleanup: () => void;
  
  // Metrics and monitoring
  getMetrics: () => any;
  
  // Configuration
  getConfig: () => ResourcePoolConfig;
}

// Global resource pool instance
let globalResourcePool: ResourcePool | null = null;

/**
 * Creates a resource pool for efficient resource management
 */
export const createResourcePool = (config: Partial<ResourcePoolConfig> = {}): ResourcePool => {
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
 * Gets the global resource pool instance
 */
export const getGlobalResourcePool = (): ResourcePool => {
  if (!globalResourcePool) {
    globalResourcePool = createResourcePool();
  }
  return globalResourcePool;
};

/**
 * Sets a custom global resource pool
 */
export const setGlobalResourcePool = (pool: ResourcePool): void => {
  if (globalResourcePool) {
    globalResourcePool.cleanup();
  }
  globalResourcePool = pool;
};

// Export default resource pool for convenience
export default getGlobalResourcePool;
