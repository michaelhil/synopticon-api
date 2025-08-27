/**
 * Stream Abstraction Layer
 * Extends pipeline concept to handle continuous data streams
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../pipeline/pipeline.ts';
import { createMemoryOptimizer } from './memory-optimization.js';
import { createAdaptiveBatchScheduler } from './adaptive-batching.js';

// Stream buffer factory for temporal data management
export const createStreamBuffer = (config = {}) => {
  const state = {
    maxSize: config.maxSize || 1000,
    data: [],
    windowMs: config.windowMs || 1000
  };

  const add = (item) => {
    const timestampedItem = {
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

  const getLatest = (count = 1) => {
    return state.data.slice(-count);
  };

  const getInWindow = (windowMs = state.windowMs) => {
    const cutoff = performance.now() - windowMs;
    return state.data.filter(item => item.bufferTimestamp > cutoff);
  };

  const getClosest = (targetTimestamp, toleranceMs = 50) => {
    let closest = null;
    let minDiff = Infinity;

    for (const item of state.data) {
      const diff = Math.abs(item.timestamp - targetTimestamp);
      if (diff < minDiff && diff <= toleranceMs) {
        minDiff = diff;
        closest = item;
      }
    }

    return closest;
  };

  const clear = () => {
    state.data = [];
  };

  const getSize = () => state.data.length;

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

// Data stream factory following your functional patterns
export const createDataStream = (config = {}) => {
  const state = {
    id: config.id || crypto.randomUUID(),
    type: config.type || 'generic',
    sampleRate: config.sampleRate || 30,
    buffer: createStreamBuffer({
      maxSize: config.bufferSize || 1000,
      windowMs: config.windowMs || 5000
    }),
    pipeline: null,
    processors: config.processors || [],
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

  const start = async () => {
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
          cb(error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      });
      throw error;
    }
  };

  const stop = () => {
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

  const process = async (data) => {
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
          cb(error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      });
      throw error;
    }
  };

  // Event listener pattern
  const onData = (callback) => {
    state.callbacks.onData.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = state.callbacks.onData.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onData.splice(index, 1);
      }
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onError.splice(index, 1);
      }
    };
  };

  const onStatusChange = (callback) => {
    state.callbacks.onStatusChange.push(callback);
    
    return () => {
      const index = state.callbacks.onStatusChange.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onStatusChange.splice(index, 1);
      }
    };
  };

  // Getters following functional patterns
  const getId = () => state.id;
  const getType = () => state.type;
  const getSampleRate = () => state.sampleRate;
  const isActive = () => state.isActive;
  const getBuffer = () => state.buffer;
  const getMetadata = () => ({ ...state.metadata }); // Return copy
  const getStats = () => ({
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
export const createStreamFactory = () => {
  const streamTypes = new Map();
  
  const register = (type, factory) => {
    streamTypes.set(type, factory);
  };

  const create = (type, config = {}) => {
    const factory = streamTypes.get(type);
    if (!factory) {
      throw new Error(`Unknown stream type: ${type}`);
    }
    
    return factory({
      ...config,
      type
    });
  };

  const getAvailableTypes = () => Array.from(streamTypes.keys());

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
streamFactory.register('video', (_type, config) => createDataStream({ 
  ...config, 
  sampleRate: 30,
  bufferSize: 60 
}));
streamFactory.register('audio', (_type, config) => createDataStream({ 
  ...config, 
  sampleRate: 16000,
  bufferSize: 1600 
}));
streamFactory.register('sensor', (_type, config) => createDataStream({ 
  ...config, 
  sampleRate: 100,
  bufferSize: 500 
}));

// Eye tracking stream with high-frequency data support and optimizations
streamFactory.register('eyetracking', (_type, config) => {
  const optimizedConfig = {
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

  const stream = createDataStream(optimizedConfig);

  // Add memory optimization if enabled
  if (optimizedConfig.enableMemoryOptimization) {
    const memoryOptimizer = createMemoryOptimizer({
      pool: { maxPoolSize: 500 },
      memoryPressureThreshold: 0.85,
      gcInterval: 15000
    });
    
    // Override buffer with optimized version
    const originalBuffer = stream.getBuffer();
    const optimizedBuffer = memoryOptimizer.createOptimizedBuffer(
      stream.getId(),
      optimizedConfig.bufferSize
    );
    
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
    const batchProcessor = batchScheduler.createBatchProcessor(async (items) => {
      return Promise.all(items.map(async item => {
        // Process each item through existing stream pipeline
        return await stream.process(item);
      }));
    });
    
    stream.getBatchScheduler = () => batchScheduler;
    stream.addBatchedData = (items) => batchProcessor.addToQueue(items);
  }

  return stream;
});