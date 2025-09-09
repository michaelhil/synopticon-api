/**
 * Stream Abstraction Layer
 * Extends pipeline concept to handle continuous data streams
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../pipeline/pipeline.js';
import type { Pipeline } from '../pipeline/pipeline.js';
import { createMemoryOptimizer } from './memory-optimization.js'
import type { MemoryOptimizer } from './memory-optimization.js'
import { createAdaptiveBatchScheduler } from './adaptive-batching.js'
import type { AdaptiveBatchScheduler, BatchProcessorInstance } from './adaptive-batching.js'

export interface StreamBufferConfig {
  maxSize?: number;
  windowMs?: number;
}

export interface TimestampedItem {
  bufferTimestamp: number;
  timestamp?: number;
  [key: string]: unknown;
}

export interface StreamBuffer {
  add: (item: any) => TimestampedItem;
  getLatest: (count?: number) => TimestampedItem[];
  getInWindow: (windowMs?: number) => TimestampedItem[];
  getClosest: (targetTimestamp: number, toleranceMs?: number) => TimestampedItem | null;
  clear: () => void;
  getSize: () => number;
  getData: () => TimestampedItem[];
}

export interface StreamProcessor {
  process: (data: any) => Promise<any>;
  [key: string]: unknown;
}

export interface StreamMetadata {
  createdAt: number;
  totalProcessed: number;
  lastProcessed: number | null;
  startedAt?: number;
  stoppedAt?: number;
  streamType?: string;
  dataTypes?: string[];
  capabilities?: string[];
  [key: string]: unknown;
}

export interface StatusChangeEvent {
  status: 'started' | 'stopped';
  stream: any;
}

export type DataCallback = (data: any) => void;
export type ErrorCallback = (error: Error) => void;
export type StatusChangeCallback = (event: StatusChangeEvent) => void;
export type UnsubscribeFunction = () => void;

export interface DataStreamConfig {
  id?: string;
  type?: string;
  sampleRate?: number;
  bufferSize?: number;
  windowMs?: number;
  processors?: StreamProcessor[];
  usePipeline?: boolean;
  pipelineConfig?: any;
  metadata?: Record<string, unknown>;
  enableMemoryOptimization?: boolean;
  enableAdaptiveBatching?: boolean;
  [key: string]: unknown;
}

export interface StreamStats {
  id: string;
  type: string;
  sampleRate: number;
  isActive: boolean;
  bufferSize: number;
  totalProcessed: number;
  uptime: number;
}

export interface DataStream {
  // Core methods
  start: () => Promise<boolean>;
  stop: () => void;
  process: (data: any) => Promise<any>;
  
  // Event handlers
  onData: (callback: DataCallback) => UnsubscribeFunction;
  onError: (callback: ErrorCallback) => UnsubscribeFunction;
  onStatusChange: (callback: StatusChangeCallback) => UnsubscribeFunction;
  
  // Getters
  getId: () => string;
  getType: () => string;
  getSampleRate: () => number;
  isActive: () => boolean;
  getBuffer: () => StreamBuffer;
  getMetadata: () => StreamMetadata;
  getStats: () => StreamStats;
  
  // Optional methods for optimized streams
  cleanup?: () => void;
  getMemoryOptimizer?: () => MemoryOptimizer;
  getBatchScheduler?: () => AdaptiveBatchScheduler;
  addBatchedData?: (items: any[]) => void;
}

export interface StreamFactory {
  register: (type: string, factory: StreamFactoryFunction) => void;
  create: (type: string, config?: DataStreamConfig) => DataStream;
  getAvailableTypes: () => string[];
}

export type StreamFactoryFunction = (config: DataStreamConfig) => DataStream;

// Stream buffer factory for temporal data management
export const createStreamBuffer = (config: StreamBufferConfig = {}): StreamBuffer => {
  const state = {
    maxSize: config.maxSize ?? 1000,
    data: [] as TimestampedItem[],
    windowMs: config.windowMs ?? 1000
  };

  const add = (item: any): TimestampedItem => {
    const timestampedItem: TimestampedItem = {
      ...item,
      bufferTimestamp: performance.now()
    };

    state.data.push(timestampedItem);

    // Remove old items beyond max size
    if (state.data.length > state.maxSize) {
      state.data = state.data.slice(-state.maxSize);
    }

    // Remove items outside time window
    const cutoff = performance.now() - state.windowMs;
    state.data = state.data.filter(item => item.bufferTimestamp > cutoff);

    return timestampedItem;
  };

  const getLatest = (count: number = 1): TimestampedItem[] => {
    return state.data.slice(-count);
  };

  const getInWindow = (windowMs: number = state.windowMs): TimestampedItem[] => {
    const cutoff = performance.now() - windowMs;
    return state.data.filter(item => item.bufferTimestamp > cutoff);
  };

  const getClosest = (targetTimestamp: number, toleranceMs: number = 50): TimestampedItem | null => {
    let closest: TimestampedItem | null = null;
    let minDiff = Infinity;

    for (const item of state.data) {
      const itemTimestamp = item.timestamp ?? item.bufferTimestamp;
      const diff = Math.abs(itemTimestamp - targetTimestamp);
      if (diff < minDiff && diff <= toleranceMs) {
        minDiff = diff;
        closest = item;
      }
    }

    return closest;
  };

  const clear = (): void => {
    state.data = [];
  };

  const getSize = (): number => state.data.length;

  return {
    add,
    getLatest,
    getInWindow, 
    getClosest,
    clear,
    getSize,
    getData: () => [...state.data] // Return copy for immutability
  };
};

interface DataStreamState {
  id: string;
  type: string;
  sampleRate: number;
  buffer: StreamBuffer;
  pipeline: Pipeline | null;
  processors: StreamProcessor[];
  isActive: boolean;
  metadata: StreamMetadata;
  callbacks: {
    onData: DataCallback[];
    onError: ErrorCallback[];
    onStatusChange: StatusChangeCallback[];
  };
}

// Data stream factory following your functional patterns
export const createDataStream = (config: DataStreamConfig = {}): DataStream => {
  const state: DataStreamState = {
    id: config.id ?? crypto.randomUUID(),
    type: config.type ?? 'generic',
    sampleRate: config.sampleRate ?? 30,
    buffer: createStreamBuffer({
      maxSize: config.bufferSize ?? 1000,
      windowMs: config.windowMs ?? 5000
    }),
    pipeline: null,
    processors: config.processors ?? [],
    isActive: false,
    metadata: {
      ...config.metadata,
      createdAt: Date.now(),
      totalProcessed: 0,
      lastProcessed: null
    },
    callbacks: {
      onData: [],
      onError: [],
      onStatusChange: []
    }
  };

  // Initialize pipeline if processors provided (except for simple test processors)
  if (config.processors && config.processors.length > 0 && config.usePipeline !== false) {
    try {
      state.pipeline = createPipeline({
        processors: config.processors,
        ...config.pipelineConfig
      });
    } catch (error) {
      // If pipeline creation fails, use simple processor chain
      console.warn('Pipeline creation failed, using simple processor chain:', error);
    }
  }

  const start = async (): Promise<boolean> => {
    if (state.isActive) return true;

    try {
      // Initialize pipeline if it exists
      if (state.pipeline && state.pipeline.initialize) {
        await state.pipeline.initialize(config.pipelineConfig || {});
      }

      state.isActive = true;
      state.metadata.startedAt = Date.now();
      
      // Notify status change
      state.callbacks.onStatusChange.forEach(cb => {
        try {
          cb({ status: 'started', stream: state });
        } catch (error) {
          console.warn('Status change callback error:', error);
        }
      });

      return true;
    } catch (error) {
      state.callbacks.onError.forEach(cb => {
        try {
          cb(error as Error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      });
      throw error;
    }
  };

  const stop = (): void => {
    if (!state.isActive) return;

    state.isActive = false;
    state.metadata.stoppedAt = Date.now();

    // Cleanup pipeline if it has cleanup method
    if (state.pipeline && state.pipeline.cleanup) {
      try {
        state.pipeline.cleanup();
      } catch (error) {
        console.warn('Pipeline cleanup error:', error);
      }
    }

    // Notify status change
    state.callbacks.onStatusChange.forEach(cb => {
      try {
        cb({ status: 'stopped', stream: state });
      } catch (error) {
        console.warn('Status change callback error:', error);
      }
    });
  };

  const process = async (data: any): Promise<any> => {
    if (!state.isActive) {
      throw new Error(`Stream ${state.id} is not active`);
    }

    const startTime = performance.now();
    
    try {
      // Add stream metadata to data
      const enrichedData = {
        ...data,
        timestamp: data.timestamp || Date.now(),
        streamId: state.id,
        streamType: state.type,
        sampleRate: state.sampleRate
      };

      let result = enrichedData;

      // Process through pipeline if available
      if (state.pipeline) {
        result = await state.pipeline.process(enrichedData);
      } else if (state.processors && state.processors.length > 0) {
        // Simple processor chain for testing
        for (const processor of state.processors) {
          if (processor.process) {
            result = await processor.process(result);
          }
        }
      }

      // Add processing metadata
      const finalResult = {
        ...result,
        processingTime: performance.now() - startTime,
        streamId: state.id,
        streamType: state.type
      };

      // Add to buffer
      state.buffer.add(finalResult);

      // Update metadata
      state.metadata.totalProcessed++;
      state.metadata.lastProcessed = Date.now();

      // Notify data callbacks
      state.callbacks.onData.forEach(cb => {
        try {
          cb(finalResult);
        } catch (error) {
          console.warn('Data callback error:', error);
        }
      });

      return finalResult;

    } catch (error) {
      // Notify error callbacks
      state.callbacks.onError.forEach(cb => {
        try {
          cb(error as Error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      });
      throw error;
    }
  };

  // Event listener pattern
  const onData = (callback: DataCallback): UnsubscribeFunction => {
    state.callbacks.onData.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = state.callbacks.onData.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onData.splice(index, 1);
      }
    };
  };

  const onError = (callback: ErrorCallback): UnsubscribeFunction => {
    state.callbacks.onError.push(callback);
    
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onError.splice(index, 1);
      }
    };
  };

  const onStatusChange = (callback: StatusChangeCallback): UnsubscribeFunction => {
    state.callbacks.onStatusChange.push(callback);
    
    return () => {
      const index = state.callbacks.onStatusChange.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onStatusChange.splice(index, 1);
      }
    };
  };

  // Getters following functional patterns
  const getId = (): string => state.id;
  const getType = (): string => state.type;
  const getSampleRate = (): number => state.sampleRate;
  const isActive = (): boolean => state.isActive;
  const getBuffer = (): StreamBuffer => state.buffer;
  const getMetadata = (): StreamMetadata => ({ ...state.metadata }); // Return copy
  const getStats = (): StreamStats => ({
    id: state.id,
    type: state.type,
    sampleRate: state.sampleRate,
    isActive: state.isActive,
    bufferSize: state.buffer.getSize(),
    totalProcessed: state.metadata.totalProcessed,
    uptime: state.metadata.startedAt ? Date.now() - state.metadata.startedAt : 0
  });

  return {
    // Core methods
    start,
    stop,
    process,
    
    // Event handlers
    onData,
    onError,
    onStatusChange,
    
    // Getters
    getId,
    getType,
    getSampleRate,
    isActive,
    getBuffer,
    getMetadata,
    getStats
  };
};

// Stream factory registry for different stream types
export const createStreamFactory = (): StreamFactory => {
  const streamTypes = new Map<string, StreamFactoryFunction>();
  
  const register = (type: string, factory: StreamFactoryFunction): void => {
    streamTypes.set(type, factory);
  };

  const create = (type: string, config: DataStreamConfig = {}): DataStream => {
    const factory = streamTypes.get(type);
    if (!factory) {
      throw new Error(`Unknown stream type: ${type}`);
    }
    
    return factory({
      ...config,
      type
    });
  };

  const getAvailableTypes = (): string[] => Array.from(streamTypes.keys());

  return {
    register,
    create,
    getAvailableTypes
  };
};

// Default stream factory instance
export const streamFactory = createStreamFactory();

// Register basic stream types
streamFactory.register('generic', createDataStream);
streamFactory.register('video', (config) => createDataStream({ 
  ...config, 
  sampleRate: 30,
  bufferSize: 60 
}));
streamFactory.register('audio', (config) => createDataStream({ 
  ...config, 
  sampleRate: 16000,
  bufferSize: 1600 
}));
streamFactory.register('sensor', (config) => createDataStream({ 
  ...config, 
  sampleRate: 100,
  bufferSize: 500 
}));

// Eye tracking stream with high-frequency data support and optimizations
streamFactory.register('eyetracking', (config) => {
  const optimizedConfig: DataStreamConfig = {
    ...config, 
    sampleRate: 200, // 200Hz for eye tracking
    bufferSize: 2000, // Larger buffer for high-frequency data
    windowMs: 10000, // 10 second window for eye tracking
    enableMemoryOptimization: config.enableMemoryOptimization !== false,
    enableAdaptiveBatching: config.enableAdaptiveBatching !== false,
    metadata: {
      ...config.metadata,
      streamType: 'eyetracking',
      dataTypes: ['gaze', 'eye_state', 'imu', 'events'],
      capabilities: ['real_time_streaming', 'semantic_enhancement', 'device_control', 'memory_optimization', 'adaptive_batching']
    }
  };

  const stream = createDataStream(optimizedConfig) as DataStream & {
    cleanup?: () => void;
    getMemoryOptimizer?: () => MemoryOptimizer;
    getBatchScheduler?: () => AdaptiveBatchScheduler;
    addBatchedData?: (items: any[]) => void;
  };

  // Add memory optimization if enabled
  if (optimizedConfig.enableMemoryOptimization) {
    const memoryOptimizer = createMemoryOptimizer({
      memoryPressureThreshold: 0.85
    });
    
    // Start memory monitoring
    memoryOptimizer.startMonitoring();
    
    // Extend stream with memory optimization
    const originalCleanup = stream.cleanup || (() => {});
    stream.cleanup = () => {
      memoryOptimizer.cleanup();
      originalCleanup();
    };
    
    stream.getMemoryOptimizer = () => memoryOptimizer;
  }

  // Add adaptive batching if enabled
  if (optimizedConfig.enableAdaptiveBatching) {
    const batchScheduler = createAdaptiveBatchScheduler({
      strategy: 'quality_aware',
      targetLatency: 25, // 25ms for eye tracking
      maxBatchSize: 15,
      minBatchSize: 1,
      baseInterval: 5 // 5ms base interval for 200Hz
    });
    
    // Create batch processor for stream data
    const batchProcessor = batchScheduler.createBatchProcessor(async (items: any[]) => {
      return Promise.all(items.map(async item => {
        // Process each item through existing stream pipeline
        return await stream.process(item);
      }));
    });
    
    stream.getBatchScheduler = () => batchScheduler;
    stream.addBatchedData = (items: any[]) => batchProcessor.addToQueue(items);
  }

  return stream;
});