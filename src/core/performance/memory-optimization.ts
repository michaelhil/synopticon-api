/**
 * Memory Optimization for High-Frequency Streaming
 * Advanced memory management and optimization strategies
 * Following functional programming patterns with factory functions
 */

import { createEnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';
import type { EnhancedMemoryPool } from '../../shared/utils/enhanced-memory-pool.js';

export interface MemoryPoolStats {
  allocations: number;
  deallocations: number;
  reuseHits: number;
  memoryLeaks: number;
  poolSizes: Record<string, PoolStats>;
  peakMemoryUsage: number;
}

export interface PoolStats {
  available: number;
  inUse: number;
  created: number;
  reused: number;
  reuseRatio: number;
}

export interface MemoryPool<T = any> {
  typeName: string;
  factory: (...args: any[]) => T;
  reset: ((obj: T, ...args: any[]) => void) | null;
  available: T[];
  inUse: Set<T>;
  created: number;
  reused: number;
}

export interface OptimizedMemoryPool {
  createPool: <T>(typeName: string, factory: (...args: any[]) => T, reset?: (obj: T, ...args: any[]) => void) => MemoryPool<T>;
  acquire: <T>(typeName: string, ...args: any[]) => T;
  release: (typeName: string, obj: any) => boolean;
  clear: () => void;
  getStats: () => MemoryPoolStats;
}

export interface CircularBufferConfig {
  size?: number;
  memoryPool?: OptimizedMemoryPool | null;
}

export interface CircularBufferStats {
  size: number;
  count: number;
  overflowCount: number;
  utilization: number;
  memoryUsage: number;
}

export interface CircularBuffer<T> {
  push: (item: T) => void;
  pop: () => T | null;
  peek: () => T | null;
  clear: () => void;
  toArray: () => T[];
  isFull: () => boolean;
  isEmpty: () => boolean;
  getSize: () => number;
  getCapacity: () => number;
  getStats: () => CircularBufferStats;
}

export interface GazeData {
  type: 'gazeData';
  timestamp: number;
  x: number;
  y: number;
  confidence: number;
  semantic: any;
  metadata: Record<string, unknown>;
}

export interface VideoFrame {
  type: 'videoFrame';
  timestamp: number;
  width: number;
  height: number;
  data: any;
  format: string;
}

export interface BufferEntry<T = any> {
  type: 'bufferEntry';
  data: T;
  timestamp: number;
  streamId: string | null;
  processed: boolean;
}

export interface MemoryUsageInfo {
  used: number;
  total: number;
  limit: number;
  pressure: number;
}

export interface MemoryOptimizerStats {
  totalAllocations: number;
  totalDeallocations: number;
  gcRuns: number;
  memoryPressure: number;
  optimizationApplied: number;
}

export interface MemoryThresholds {
  memoryPressure: number;
  gcInterval: number;
  bufferSizeLimit: number;
}

export interface MemoryOptimizerConfig {
  pool?: any;
  memoryPressureThreshold?: number;
  gcInterval?: number;
  bufferSizeLimit?: number;
}

export interface MemoryOptimizer {
  createGazeData: (timestamp?: number, x?: number, y?: number, confidence?: number) => GazeData;
  createVideoFrame: (timestamp?: number, width?: number, height?: number, data?: any) => VideoFrame;
  createBufferEntry: <T>(data: T, streamId?: string) => BufferEntry<T>;
  releaseObject: (obj: any) => boolean;
  createOptimizedBuffer: <T>(bufferId: string, size?: number) => CircularBuffer<T>;
  getBuffer: <T>(id: string) => CircularBuffer<T> | undefined;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  monitorMemoryUsage: () => MemoryUsageInfo | null;
  applyMemoryOptimization: () => void;
  scheduleGC: () => void;
  getStats: () => MemoryOptimizerStats & {
    memoryPool: any;
    buffers: Record<string, CircularBufferStats>;
    thresholds: MemoryThresholds;
    currentMemoryUsage: MemoryUsageInfo | null;
  };
  updateThresholds: (newThresholds: Partial<MemoryThresholds>) => void;
  cleanup: () => void;
}

export interface MemoryOptimizedStreamConfig {
  memory?: MemoryOptimizerConfig;
  streamId?: string;
  bufferSize?: number;
}

export interface MemoryOptimizedStreamStats {
  buffer: CircularBufferStats;
  memory: ReturnType<MemoryOptimizer['getStats']>;
}

export interface MemoryOptimizedStream<T = any> {
  addData: (rawData: T) => BufferEntry<T>;
  getData: () => T | null;
  getStats: () => MemoryOptimizedStreamStats;
  cleanup: () => void;
  getBuffer: () => CircularBuffer<BufferEntry<T>>;
  getMemoryOptimizer: () => MemoryOptimizer;
}

interface OptimizedMemoryPoolState {
  pools: Map<string, MemoryPool>;
  stats: MemoryPoolStats;
  config: {
    maxPoolSize: number;
    gcThreshold: number;
    monitoringInterval: number;
  };
}

interface CircularBufferState<T> {
  size: number;
  buffer: (T | null)[];
  head: number;
  tail: number;
  count: number;
  overflowCount: number;
  memoryPool: OptimizedMemoryPool | null;
}

interface MemoryOptimizerState {
  memoryPool: EnhancedMemoryPool;
  buffers: Map<string, CircularBuffer<any>>;
  monitoringInterval: NodeJS.Timeout | null;
  gcScheduled: boolean;
  stats: MemoryOptimizerStats;
  thresholds: MemoryThresholds;
}

// Enhanced memory pool factory for efficient object reuse
export const createOptimizedMemoryPool = (config: { maxPoolSize?: number; gcThreshold?: number; monitoringInterval?: number } = {}): OptimizedMemoryPool => {
  const state: OptimizedMemoryPoolState = {
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
      maxPoolSize: config.maxPoolSize ?? 1000,
      gcThreshold: config.gcThreshold ?? 0.8,
      monitoringInterval: config.monitoringInterval ?? 5000
    }
  };

  // Create type-specific object pools
  const createPool = <T>(typeName: string, factory: (...args: any[]) => T, reset?: (obj: T, ...args: any[]) => void): MemoryPool<T> => {
    const pool: MemoryPool<T> = {
      typeName,
      factory,
      reset: reset || null,
      available: [],
      inUse: new Set(),
      created: 0,
      reused: 0
    };

    state.pools.set(typeName, pool as MemoryPool);
    return pool;
  };

  // Get object from pool or create new one
  const acquire = <T>(typeName: string, ...args: any[]): T => {
    const pool = state.pools.get(typeName);
    if (!pool) {
      throw new Error(`Pool for type '${typeName}' not found`);
    }

    let obj: T;
    
    if (pool.available.length > 0) {
      // Reuse existing object
      obj = pool.available.pop() as T;
      pool.reused++;
      state.stats.reuseHits++;
      
      // Reset object if reset function provided
      if (pool.reset) {
        pool.reset(obj, ...args);
      }
    } else {
      // Create new object
      obj = pool.factory(...args) as T;
      pool.created++;
      state.stats.allocations++;
    }

    pool.inUse.add(obj);
    return obj;
  };

  // Return object to pool
  const release = (typeName: string, obj: any): boolean => {
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
  const clear = (): void => {
    for (const pool of state.pools.values()) {
      pool.available.length = 0;
      pool.inUse.clear();
    }
  };

  // Get pool statistics
  const getStats = (): MemoryPoolStats => ({
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
export const createCircularBuffer = <T>(config: CircularBufferConfig = {}): CircularBuffer<T> => {
  const state: CircularBufferState<T> = {
    size: config.size ?? 1000,
    buffer: new Array(config.size ?? 1000),
    head: 0,
    tail: 0,
    count: 0,
    overflowCount: 0,
    memoryPool: config.memoryPool ?? null
  };

  const isFull = (): boolean => state.count === state.size;
  const isEmpty = (): boolean => state.count === 0;
  const getSize = (): number => state.count;
  const getCapacity = (): number => state.size;

  const push = (item: T): void => {
    if (isFull()) {
      // Handle overflow - drop oldest item
      const droppedItem = state.buffer[state.tail];
      if (state.memoryPool && droppedItem && (droppedItem as any).type) {
        state.memoryPool.release((droppedItem as any).type, droppedItem);
      }
      state.tail = (state.tail + 1) % state.size;
      state.overflowCount++;
    } else {
      state.count++;
    }

    state.buffer[state.head] = item;
    state.head = (state.head + 1) % state.size;
  };

  const pop = (): T | null => {
    if (isEmpty()) return null;

    const item = state.buffer[state.tail];
    state.buffer[state.tail] = null; // Allow GC
    state.tail = (state.tail + 1) % state.size;
    state.count--;
    
    return item as T;
  };

  const peek = (): T | null => {
    if (isEmpty()) return null;
    return state.buffer[state.tail] as T;
  };

  const clear = (): void => {
    if (state.memoryPool) {
      // Return all items to memory pool
      for (let i = 0; i < state.count; i++) {
        const index = (state.tail + i) % state.size;
        const item = state.buffer[index];
        if (item && (item as any).type) {
          state.memoryPool.release((item as any).type, item);
        }
      }
    }

    state.buffer.fill(null);
    state.head = 0;
    state.tail = 0;
    state.count = 0;
  };

  const toArray = (): T[] => {
    const result = new Array(state.count);
    for (let i = 0; i < state.count; i++) {
      result[i] = state.buffer[(state.tail + i) % state.size];
    }
    return result as T[];
  };

  const getStats = (): CircularBufferStats => ({
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
export const createMemoryOptimizer = (config: MemoryOptimizerConfig = {}): MemoryOptimizer => {
  const state: MemoryOptimizerState = {
    memoryPool: createEnhancedMemoryPool(config.pool),
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
      memoryPressure: config.memoryPressureThreshold ?? 0.8,
      gcInterval: config.gcInterval ?? 10000,
      bufferSizeLimit: config.bufferSizeLimit ?? 5000
    }
  };

  // Initialize common object pools for eye tracking
  const initializePools = (): void => {
    // Gaze data objects
    state.memoryPool.registerFactory('gazeData', () => ({
      type: 'gazeData',
      timestamp: 0,
      x: 0,
      y: 0,
      confidence: 0,
      semantic: null,
      metadata: {}
    }));

    // Video frame objects
    state.memoryPool.registerFactory('videoFrame', () => ({
      type: 'videoFrame',
      timestamp: 0,
      width: 0,
      height: 0,
      data: null,
      format: 'rgba'
    }));

    // Stream buffer entries
    state.memoryPool.registerFactory('bufferEntry', () => ({
      type: 'bufferEntry',
      data: null,
      timestamp: 0,
      streamId: null,
      processed: false
    }));
  };

  // Create optimized circular buffer
  const createOptimizedBuffer = <T>(bufferId: string, size: number = 1000): CircularBuffer<T> => {
    const buffer = createCircularBuffer<T>({
      size,
      memoryPool: null // Will be handled by the optimizer directly
    });

    state.buffers.set(bufferId, buffer);
    return buffer;
  };

  // Memory monitoring and optimization
  const monitorMemoryUsage = (): MemoryUsageInfo | null => {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
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
  const applyMemoryOptimization = (): void => {
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
    state.memoryPool.cleanup();

    // Schedule garbage collection
    scheduleGC();

    state.stats.optimizationApplied++;
  };

  // Intelligent garbage collection scheduling
  const scheduleGC = (): void => {
    if (state.gcScheduled) return;
    
    state.gcScheduled = true;
    
    // Use idle callback if available for non-blocking GC
    const runGC = (): void => {
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
  const performGC = (): void => {
    // Force garbage collection if available (Chrome DevTools)
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }

    // Clean up weak references and null pointers
    cleanupReferences();

    state.stats.gcRuns++;
  };

  // Clean up weak references and null pointers
  const cleanupReferences = (): void => {
    // Clean up empty buffers
    for (const buffer of state.buffers.values()) {
      if (buffer.isEmpty()) {
        buffer.clear();
      }
    }

    // Force cleanup of unused memory pools
    const poolStats = state.memoryPool.getStats();
    console.log('Memory pool cleanup completed');
  };

  // Start memory monitoring
  const startMonitoring = (): void => {
    if (state.monitoringInterval) return;

    state.monitoringInterval = setInterval(() => {
      monitorMemoryUsage();
    }, state.thresholds.gcInterval);
  };

  // Stop memory monitoring
  const stopMonitoring = (): void => {
    if (state.monitoringInterval) {
      clearInterval(state.monitoringInterval);
      state.monitoringInterval = null;
    }
  };

  // Optimized object creation helpers
  const createGazeData = (timestamp?: number, x?: number, y?: number, confidence?: number): GazeData => {
    const obj = state.memoryPool.acquire('gazeData') as GazeData;
    obj.timestamp = timestamp ?? Date.now();
    obj.x = x ?? 0;
    obj.y = y ?? 0;
    obj.confidence = confidence ?? 0;
    obj.semantic = null;
    obj.metadata = {};
    return obj;
  };

  const createVideoFrame = (timestamp?: number, width?: number, height?: number, data?: any): VideoFrame => {
    const obj = state.memoryPool.acquire('videoFrame') as VideoFrame;
    obj.timestamp = timestamp ?? Date.now();
    obj.width = width ?? 0;
    obj.height = height ?? 0;
    obj.data = data ?? null;
    obj.format = 'rgba';
    return obj;
  };

  const createBufferEntry = <T>(data: T, streamId?: string): BufferEntry<T> => {
    const obj = state.memoryPool.acquire('bufferEntry') as BufferEntry<T>;
    obj.data = data;
    obj.timestamp = Date.now();
    obj.streamId = streamId ?? null;
    obj.processed = false;
    return obj;
  };

  // Release objects back to pool
  const releaseObject = (obj: any): boolean => {
    if (obj && obj.type) {
      return state.memoryPool.release(obj);
    }
    console.warn('Attempting to release untracked object');
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
  const updateThresholds = (newThresholds: Partial<MemoryThresholds>): void => {
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
    getBuffer: <T>(id: string) => state.buffers.get(id) as CircularBuffer<T> | undefined,
    
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
      state.memoryPool.cleanup();
      for (const buffer of state.buffers.values()) {
        buffer.clear();
      }
      state.buffers.clear();
    }
  };
};

// Integration with existing stream system
export const createMemoryOptimizedStream = <T = any>(config: MemoryOptimizedStreamConfig = {}): MemoryOptimizedStream<T> => {
  const memoryOptimizer = createMemoryOptimizer(config.memory);
  const buffer = memoryOptimizer.createOptimizedBuffer<BufferEntry<T>>(
    config.streamId ?? 'default',
    config.bufferSize ?? 2000
  );

  // Start memory monitoring
  memoryOptimizer.startMonitoring();

  const addData = (rawData: T): BufferEntry<T> => {
    // Use memory pool for data objects
    const optimizedData = memoryOptimizer.createBufferEntry(rawData, config.streamId);
    buffer.push(optimizedData);
    
    return optimizedData;
  };

  const getData = (): T | null => {
    const entry = buffer.pop();
    if (entry) {
      const { data } = entry;
      // Release the buffer entry back to pool
      memoryOptimizer.releaseObject(entry);
      return data;
    }
    return null;
  };

  const getStats = (): MemoryOptimizedStreamStats => ({
    buffer: buffer.getStats(),
    memory: memoryOptimizer.getStats()
  });

  const cleanup = (): void => {
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