/**
 * Memory Optimization Module
 * Enhanced implementation with canvas pooling and buffer management
 */

import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface MemoryThresholds {
  warning: number;
  critical: number;
}

export interface PoolStats {
  canvasHits: number;
  canvasMisses: number;
  bufferHits: number;
  bufferMisses: number;
  totalAllocated: number;
  totalReused: number;
}

export interface PoolSizeInfo {
  size: string | number;
  count: number;
}

export interface HitRate {
  canvas: number;
  buffer: number;
}

export interface PoolingStats extends PoolStats {
  canvasPoolSizes: PoolSizeInfo[];
  bufferPoolSizes: PoolSizeInfo[];
  hitRate: HitRate;
  reuseRate: number;
}

export interface MockCanvas {
  width: number;
  height: number;
  getContext: (type?: string) => MockCanvasContext;
}

export interface MockCanvasContext {
  createImageData: (width: number, height: number) => ImageData;
  putImageData: (...args: any[]) => void;
  getImageData: (x: number, y: number, width: number, height: number) => ImageData;
  clearRect?: (x: number, y: number, width: number, height: number) => void;
}

export interface OptimizedBuffer {
  data: any[];
  maxSize: number;
  streamId: string;
  add: (item: any) => void;
  clear: () => void;
  getSize: () => number;
}

export interface MemoryOptimizerConfig {
  memoryPressureThreshold?: number;
}

export interface MemoryOptimizer {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  createOptimizedBuffer: (streamId: string, maxSize: number) => OptimizedBuffer;
  getCanvas: (width: number, height: number) => HTMLCanvasElement | MockCanvas;
  returnCanvas: (canvas: HTMLCanvasElement | MockCanvas) => void;
  getBuffer: (size: number) => ArrayBuffer;
  returnBuffer: (buffer: ArrayBuffer) => void;
  cleanup: () => void;
  getMemoryStats: () => MemoryUsage;
  getPoolingStats: () => PoolingStats;
  isMonitoring: () => boolean;
}

interface MemoryOptimizerState {
  isMonitoring: boolean;
  memoryUsage: MemoryUsage;
  thresholds: MemoryThresholds;
  canvasPool: Map<string, (HTMLCanvasElement | MockCanvas)[]>;
  bufferPool: Map<number, ArrayBuffer[]>;
  poolStats: PoolStats;
  monitoringInterval?: NodeJS.Timeout;
}

export const createMemoryOptimizer = (config: MemoryOptimizerConfig = {}): MemoryOptimizer => {
  const state: MemoryOptimizerState = {
    isMonitoring: false,
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    },
    thresholds: {
      warning: config.memoryPressureThreshold ?? 0.8,
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

  const startMonitoring = (): void => {
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
          heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
          pressure: `${Math.round(pressureRatio * 100)}%`
        });
        performAggressiveCleanup();
      } else if (pressureRatio > state.thresholds.warning) {
        console.warn('🟡 Memory pressure warning:', {
          heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
          pressure: `${Math.round(pressureRatio * 100)}%`
        });
        performMildCleanup();
      }
    }, 30000);
  };

  const stopMonitoring = (): void => {
    if (!state.isMonitoring) return;
    
    state.isMonitoring = false;
    if (state.monitoringInterval) {
      clearInterval(state.monitoringInterval);
      state.monitoringInterval = undefined;
    }
  };

  const updateMemoryStats = (): void => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      state.memoryUsage = process.memoryUsage();
    }
  };

  const performMildCleanup = (): void => {
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
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }
  };

  const performAggressiveCleanup = (): void => {
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
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
      setTimeout(() => (global as any).gc(), 100);
    }
  };

  // Canvas pooling for image processing
  const getCanvas = (width: number, height: number): HTMLCanvasElement | MockCanvas => {
    const size = `${width}x${height}`;
    const pool = state.canvasPool.get(size) || [];
    
    if (pool.length > 0) {
      state.poolStats.canvasHits++;
      state.poolStats.totalReused++;
      return pool.pop()!;
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
    const mockCanvas: MockCanvas = {
      width,
      height,
      getContext: (): MockCanvasContext => ({
        createImageData: (w: number, h: number): ImageData => ({ 
          data: new Uint8ClampedArray(w * h * 4), 
          width: w, 
          height: h,
          colorSpace: 'srgb'
        } as ImageData),
        putImageData: () => {},
        getImageData: (): ImageData => ({ 
          data: new Uint8ClampedArray(width * height * 4), 
          width, 
          height,
          colorSpace: 'srgb'
        } as ImageData)
      })
    };
    
    return mockCanvas;
  };

  const returnCanvas = (canvas: HTMLCanvasElement | MockCanvas): void => {
    const size = `${canvas.width}x${canvas.height}`;
    const pool = state.canvasPool.get(size) || [];
    
    // Limit pool size to prevent memory leaks
    if (pool.length < 5) {
      // Clear canvas before returning to pool
      const ctx = canvas.getContext && canvas.getContext('2d') as CanvasRenderingContext2D | MockCanvasContext;
      if (ctx && 'clearRect' in ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      pool.push(canvas);
      state.canvasPool.set(size, pool);
    }
  };

  // Buffer pooling for data processing
  const getBuffer = (size: number): ArrayBuffer => {
    const pool = state.bufferPool.get(size) || [];
    
    if (pool.length > 0) {
      state.poolStats.bufferHits++;
      state.poolStats.totalReused++;
      const buffer = pool.pop()!;
      new Uint8Array(buffer).fill(0); // Clear buffer data
      return buffer;
    }
    
    state.poolStats.bufferMisses++;
    state.poolStats.totalAllocated++;
    
    return new ArrayBuffer(size);
  };

  const returnBuffer = (buffer: ArrayBuffer): void => {
    const size = buffer.byteLength;
    const pool = state.bufferPool.get(size) || [];
    
    // Limit pool size to prevent memory leaks
    if (pool.length < 10) {
      pool.push(buffer);
      state.bufferPool.set(size, pool);
    }
  };

  const createOptimizedBuffer = (streamId: string, maxSize: number): OptimizedBuffer => {
    const bufferState = {
      data: [] as any[],
      maxSize,
      streamId
    };
    
    return {
      data: bufferState.data,
      maxSize: bufferState.maxSize,
      streamId: bufferState.streamId,
      add: (item: any) => {
        bufferState.data.push(item);
        if (bufferState.data.length > maxSize) {
          bufferState.data = bufferState.data.slice(-maxSize);
        }
      },
      clear: () => {
        bufferState.data = [];
      },
      getSize: () => bufferState.data.length
    };
  };

  const cleanup = (): void => {
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

  const getMemoryStats = (): MemoryUsage => {
    updateMemoryStats();
    return state.memoryUsage;
  };

  const getPoolingStats = (): PoolingStats => {
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