/**
 * @fileoverview Garbage Collection for Resource Pool
 * 
 * Handles cleanup and memory management for resource pools including
 * canvas elements, WebGL contexts, image buffers, and typed arrays.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js'

/**
 * WebGL context information
 */
interface WebGLContextInfo {
  canvas: HTMLCanvasElement;
  context: WebGLRenderingContext | WebGL2RenderingContext;
  inUse: boolean;
  created: number;
  type: 'webgl' | 'webgl2';
}

/**
 * Resource pool state
 */
interface ResourcePoolState {
  canvasPool: HTMLCanvasElement[];
  webglContextPool: Map<string, WebGLContextInfo[]>;
  imageBufferPool: Map<string, ImageData[]>;
  typedArrayPool: Map<string, TypedArray[]>;
  metricsData: {
    memoryPressure: number;
    [key: string]: number | string;
  };
  gcTimer: NodeJS.Timeout | null;
}

/**
 * Pool configuration
 */
interface PoolConfig {
  maxCanvasElements: number;
  maxWebGLContexts: number;
  maxImageBuffers: number;
  maxTypedArrays: number;
  gcInterval: number;
}

/**
 * Canvas manager interface
 */
interface CanvasManager {
  returnCanvas: (canvas: HTMLCanvasElement) => void;
}

/**
 * Garbage collector interface
 */
interface GarbageCollector {
  updateMemoryPressure: () => void;
  performGarbageCollection: () => void;
  startGarbageCollection: () => void;
  cleanup: () => void;
}

/**
 * Type for typed arrays
 */
type TypedArray = 
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

/**
 * Creates a garbage collector for resource pool management
 */
export const createGarbageCollector = (
  state: ResourcePoolState, 
  poolConfig: PoolConfig, 
  canvasManager: CanvasManager
): GarbageCollector => {
  
  const updateMemoryPressure = (): void => {
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
  
  const performGarbageCollection = (): void => {
    try {
      const now = Date.now();
      const maxAge = poolConfig.gcInterval * 2; // Resources older than 2x GC interval
      
      // Clean old WebGL contexts
      for (const [type, contextPool] of state.webglContextPool.entries()) {
        const freshContexts = contextPool.filter(info => {
          if (!info.inUse && (now - info.created) > maxAge) {
            canvasManager.returnCanvas(info.canvas);
            return false;
          }
          return true;
        });
        state.webglContextPool.set(type, freshContexts);
      }
      
      // Trim pools to reasonable sizes
      state.canvasPool.splice(Math.floor(poolConfig.maxCanvasElements * 0.7));
      
      // Force garbage collection if available
      if ((globalThis as any).gc && typeof (globalThis as any).gc === 'function') {
        (globalThis as any).gc();
      }
      
      // Update memory pressure metric
      updateMemoryPressure();
      
    } catch (error) {
      handleError(
        `Error during garbage collection: ${(error as Error).message}`,
        ErrorCategory.MEMORY,
        ErrorSeverity.WARNING
      );
    }
  };
  
  const startGarbageCollection = (): void => {
    if (state.gcTimer) return;
    
    state.gcTimer = setInterval(() => {
      performGarbageCollection();
    }, poolConfig.gcInterval);
  };
  
  const cleanup = (): void => {
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
  
  return {
    updateMemoryPressure,
    performGarbageCollection,
    startGarbageCollection,
    cleanup
  };
};

/**
 * Advanced garbage collection utilities
 */
export const GarbageCollectionUtils = {
  /**
   * Calculate memory usage estimate
   */
  calculateMemoryUsage: (state: ResourcePoolState): number => {
    let totalBytes = 0;
    
    // Canvas elements (estimate 4 bytes per pixel for RGBA)
    totalBytes += state.canvasPool.reduce((sum, canvas) => {
      return sum + (canvas.width * canvas.height * 4);
    }, 0);
    
    // WebGL contexts (estimate 1MB per context)
    const totalContexts = Array.from(state.webglContextPool.values())
      .reduce((sum, pool) => sum + pool.length, 0);
    totalBytes += totalContexts * 1024 * 1024;
    
    // Image buffers
    totalBytes += Array.from(state.imageBufferPool.values())
      .reduce((sum, pool) => {
        return sum + pool.reduce((bufferSum, buffer) => {
          return bufferSum + (buffer.width * buffer.height * 4);
        }, 0);
      }, 0);
    
    // Typed arrays
    totalBytes += Array.from(state.typedArrayPool.values())
      .reduce((sum, pool) => {
        return sum + pool.reduce((arraySum, array) => {
          return arraySum + array.byteLength;
        }, 0);
      }, 0);
    
    return totalBytes;
  },

  /**
   * Get garbage collection statistics
   */
  getGCStats: (state: ResourcePoolState): {
    canvasCount: number;
    contextCount: number;
    imageBufferCount: number;
    typedArrayCount: number;
    memoryPressure: number;
    estimatedMemoryUsage: number;
  } => {
    return {
      canvasCount: state.canvasPool.length,
      contextCount: Array.from(state.webglContextPool.values())
        .reduce((sum, pool) => sum + pool.length, 0),
      imageBufferCount: Array.from(state.imageBufferPool.values())
        .reduce((sum, pool) => sum + pool.length, 0),
      typedArrayCount: Array.from(state.typedArrayPool.values())
        .reduce((sum, pool) => sum + pool.length, 0),
      memoryPressure: state.metricsData.memoryPressure,
      estimatedMemoryUsage: GarbageCollectionUtils.calculateMemoryUsage(state)
    };
  },

  /**
   * Recommend garbage collection based on thresholds
   */
  shouldPerformGC: (
    state: ResourcePoolState, 
    config: PoolConfig,
    thresholds: {
      memoryPressure: number;
      memoryUsageBytes: number;
      itemCount: number;
    } = {
      memoryPressure: 0.8,
      memoryUsageBytes: 100 * 1024 * 1024, // 100MB
      itemCount: 1000
    }
  ): boolean => {
    const stats = GarbageCollectionUtils.getGCStats(state);
    const totalItems = stats.canvasCount + stats.contextCount + 
                      stats.imageBufferCount + stats.typedArrayCount;
    
    return (
      stats.memoryPressure >= thresholds.memoryPressure ||
      stats.estimatedMemoryUsage >= thresholds.memoryUsageBytes ||
      totalItems >= thresholds.itemCount
    );
  }
};

// Export types for external use
export type { 
  ResourcePoolState, 
  PoolConfig, 
  CanvasManager, 
  GarbageCollector,
  WebGLContextInfo,
  TypedArray 
};
