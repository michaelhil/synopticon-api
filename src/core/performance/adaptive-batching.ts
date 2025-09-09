/**
 * Adaptive Batching Strategies for High-Frequency Streaming
 * Intelligent batching and buffering optimization for 200Hz eye tracking
 * Following functional programming patterns with factory functions
 */

export type BatchingStrategy = 'fixed' | 'time_based' | 'load_based' | 'adaptive' | 'quality_aware';

export interface AdaptiveBatchSchedulerConfig {
  strategy?: BatchingStrategy;
  targetLatency?: number;
  maxBatchSize?: number;
  minBatchSize?: number;
  baseInterval?: number;
  loadThreshold?: number;
  latencyThreshold?: number;
  adaptationRate?: number;
  batchSize?: number;
  interval?: number;
  [key: string]: unknown;
}

export interface SystemLoad {
  cpu: number;
  memory: number;
  frameRate: number;
  latency: number;
}

export interface BatchMetrics {
  processedBatches: number;
  averageBatchSize: number;
  averageLatency: number;
  droppedFrames: number;
  totalProcessingTime: number;
}

export interface AdaptiveParams {
  loadThreshold: number;
  latencyThreshold: number;
  adaptationRate: number;
}

export interface BatchDecision {
  batchSize: number;
  interval: number;
  reason: string;
  systemLoad?: SystemLoad;
  qualityMetrics?: {
    avgConfidence: number;
    qualityRatio: number;
  };
}

export interface BatchContext {
  timeSinceLastBatch?: number;
  queueSize?: number;
}

export interface BatchResult<T> {
  results: T[];
  processed: number;
  remaining: any[];
  processingTime: number;
  decision: BatchDecision;
}

export interface BatchCallbackData<T> {
  batchSize: number;
  processingTime: number;
  results: T[];
  decision: BatchDecision;
  timestamp: number;
}

export interface AdaptationCallbackData {
  decision: BatchDecision;
  context: BatchContext;
  systemLoad: SystemLoad;
  timestamp: number;
}

export interface DataItem {
  confidence?: number;
  [key: string]: unknown;
}

export type BatchProcessor<T, R> = (items: T[]) => Promise<R[]>;
export type BatchCallback<T> = (data: BatchCallbackData<T>) => void;
export type SystemLoadCallback = (load: SystemLoad) => void;
export type AdaptationCallback = (data: AdaptationCallbackData) => void;

export interface BatchProcessorInstance {
  addToQueue: (items: any | any[]) => void;
  getQueueSize: () => number;
  clearQueue: () => void;
  stop: () => void;
}

export interface PerformanceMonitor {
  updatePerformance: () => SystemLoad;
}

export interface AdaptiveBatchScheduler {
  // Core processing
  processBatch: <T, R>(items: T[], processor: BatchProcessor<T, R>) => Promise<BatchResult<R>>;
  createBatchProcessor: <T, R>(processor: BatchProcessor<T, R>) => BatchProcessorInstance;
  decideBatchStrategy: (items: any[], context?: BatchContext) => BatchDecision;
  
  // Strategy management
  switchStrategy: (newStrategy: BatchingStrategy) => boolean;
  getAvailableStrategies: () => string[];
  
  // Monitoring
  getMetrics: () => BatchMetrics & {
    systemLoad: SystemLoad;
    currentStrategy: BatchingStrategy;
    adaptiveParams: AdaptiveParams;
  };
  resetMetrics: () => void;
  getSystemLoad: () => SystemLoad;
  
  // Configuration
  setTargetLatency: (latency: number) => void;
  setBatchSizeRange: (min: number, max: number) => void;
  updateAdaptiveParams: (params: Partial<AdaptiveParams>) => void;
  
  // Event handlers
  onBatch: <T>(callback: BatchCallback<T>) => () => void;
  onSystemLoad: (callback: SystemLoadCallback) => () => void;
  onAdaptation: (callback: AdaptationCallback) => () => void;
}

interface AdaptiveBatchSchedulerState {
  strategy: BatchingStrategy;
  targetLatency: number;
  maxBatchSize: number;
  minBatchSize: number;
  baseInterval: number;
  systemLoad: SystemLoad;
  metrics: BatchMetrics;
  adaptiveParams: AdaptiveParams;
  callbacks: {
    onBatch: BatchCallback<any>[];
    onSystemLoad: SystemLoadCallback[];
    onAdaptation: AdaptationCallback[];
  };
  lastBatchTime?: number;
}

// Adaptive batch scheduler factory
export const createAdaptiveBatchScheduler = (config: AdaptiveBatchSchedulerConfig = {}): AdaptiveBatchScheduler => {
  const state: AdaptiveBatchSchedulerState = {
    strategy: config.strategy ?? 'adaptive',
    targetLatency: config.targetLatency ?? 50, // ms
    maxBatchSize: config.maxBatchSize ?? 20,
    minBatchSize: config.minBatchSize ?? 1,
    baseInterval: config.baseInterval ?? 16, // ~60fps
    systemLoad: {
      cpu: 0,
      memory: 0,
      frameRate: 60,
      latency: 0
    },
    metrics: {
      processedBatches: 0,
      averageBatchSize: 0,
      averageLatency: 0,
      droppedFrames: 0,
      totalProcessingTime: 0
    },
    adaptiveParams: {
      loadThreshold: config.loadThreshold ?? 0.8,
      latencyThreshold: config.latencyThreshold ?? 100,
      adaptationRate: config.adaptationRate ?? 0.1
    },
    callbacks: {
      onBatch: [],
      onSystemLoad: [],
      onAdaptation: []
    }
  };

  // System performance monitoring
  const createPerformanceMonitor = (): PerformanceMonitor => {
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let totalFrameTime = 0;

    const updatePerformance = (): SystemLoad => {
      const now = performance.now();
      const deltaTime = now - lastFrameTime;
      lastFrameTime = now;
      
      frameCount++;
      totalFrameTime += deltaTime;
      
      // Update frame rate every second
      if (frameCount >= 60) {
        state.systemLoad.frameRate = 1000 / (totalFrameTime / frameCount);
        frameCount = 0;
        totalFrameTime = 0;
      }

      // Estimate CPU load from frame timing
      const expectedFrameTime = 1000 / 60; // 16.67ms for 60fps
      state.systemLoad.cpu = Math.min(1.0, deltaTime / expectedFrameTime);

      // Memory usage (simplified estimate)
      if ((performance as any).memory) {
        const memInfo = (performance as any).memory;
        state.systemLoad.memory = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
      }

      return state.systemLoad;
    };

    return { updatePerformance };
  };

  const performanceMonitor = createPerformanceMonitor();

  // Batching strategy implementations
  const strategies: Record<BatchingStrategy, (items: any[], timeSinceLastBatch?: number, queueSize?: number) => BatchDecision> = {
    // Fixed-size batching
    fixed: (items: any[]): BatchDecision => ({
      batchSize: Math.min(config.batchSize ?? 10, items.length),
      interval: config.interval ?? 16,
      reason: 'fixed_strategy'
    }),

    // Time-based batching
    time_based: (items: any[], timeSinceLastBatch?: number): BatchDecision => ({
      batchSize: items.length,
      interval: Math.max(8, Math.min(32, timeSinceLastBatch ?? 16)),
      reason: 'time_based'
    }),

    // Load-based batching
    load_based: (items: any[]): BatchDecision => {
      const load = Math.max(state.systemLoad.cpu, state.systemLoad.memory);
      let batchSize: number;
      
      if (load > 0.9) {
        batchSize = Math.max(state.minBatchSize, Math.floor(items.length * 0.3));
      } else if (load > 0.7) {
        batchSize = Math.max(state.minBatchSize, Math.floor(items.length * 0.6));
      } else {
        batchSize = Math.min(state.maxBatchSize, items.length);
      }

      return {
        batchSize,
        interval: load > 0.8 ? Math.max(state.baseInterval * 1.5, 24) : state.baseInterval,
        reason: `load_based_${load > 0.9 ? 'high' : load > 0.7 ? 'medium' : 'low'}`
      };
    },

    // Adaptive strategy combining multiple factors
    adaptive: (items: any[], timeSinceLastBatch?: number, queueSize?: number): BatchDecision => {
      const systemLoad = performanceMonitor.updatePerformance();
      const load = Math.max(systemLoad.cpu, systemLoad.memory);
      const latency = state.metrics.averageLatency;
      
      // Base batch size calculation
      let batchSize = state.minBatchSize;
      let interval = state.baseInterval;
      let reason = 'adaptive';

      // Factor 1: System load
      if (load > state.adaptiveParams.loadThreshold) {
        // High load: reduce batch size, increase interval
        batchSize = Math.max(state.minBatchSize, Math.floor(items.length * 0.4));
        interval = Math.max(interval * 1.5, 24);
        reason += '_high_load';
      } else if (load < 0.4) {
        // Low load: increase batch size, maintain interval
        batchSize = Math.min(state.maxBatchSize, items.length);
        reason += '_low_load';
      } else {
        // Medium load: balanced approach
        batchSize = Math.min(state.maxBatchSize, Math.max(state.minBatchSize, 
          Math.floor(items.length * (1 - load * 0.5))));
        reason += '_balanced';
      }

      // Factor 2: Latency compensation
      if (latency > state.adaptiveParams.latencyThreshold) {
        // High latency: smaller batches, faster processing
        batchSize = Math.max(state.minBatchSize, Math.floor(batchSize * 0.7));
        interval = Math.max(8, Math.floor(interval * 0.8));
        reason += '_high_latency';
      }

      // Factor 3: Queue size pressure
      if (queueSize && queueSize > state.maxBatchSize * 2) {
        // Large queue: bigger batches to catch up
        batchSize = Math.min(state.maxBatchSize, Math.floor(queueSize * 0.3));
        interval = Math.max(8, Math.floor(interval * 0.9));
        reason += '_queue_pressure';
      }

      // Factor 4: Frame rate considerations
      if (systemLoad.frameRate < 30) {
        // Low frame rate: reduce processing load
        batchSize = Math.max(state.minBatchSize, Math.floor(batchSize * 0.6));
        interval = Math.max(interval * 1.2, 20);
        reason += '_low_fps';
      }

      return { batchSize, interval, reason, systemLoad };
    },

    // Quality-aware batching for eye tracking
    quality_aware: (items: DataItem[]): BatchDecision => {
      if (!items || items.length === 0) {
        return { batchSize: 0, interval: state.baseInterval, reason: 'no_data' };
      }

      // Analyze data quality
      const avgConfidence = items.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / items.length;
      const highQualityItems = items.filter(item => (item.confidence ?? 0) > 0.8).length;
      const qualityRatio = highQualityItems / items.length;

      let batchSize: number;
      let interval = state.baseInterval;
      let reason = 'quality_aware';

      if (qualityRatio > 0.8 && avgConfidence > 0.85) {
        // High quality data: process more efficiently
        batchSize = Math.min(state.maxBatchSize, items.length);
        interval = Math.max(12, state.baseInterval * 0.8);
        reason += '_high_quality';
      } else if (qualityRatio < 0.5 || avgConfidence < 0.6) {
        // Low quality data: smaller batches, more processing time
        batchSize = Math.max(state.minBatchSize, Math.floor(items.length * 0.6));
        interval = state.baseInterval * 1.3;
        reason += '_low_quality';
      } else {
        // Medium quality: standard processing
        batchSize = Math.min(state.maxBatchSize, Math.max(state.minBatchSize, items.length));
        reason += '_medium_quality';
      }

      return { batchSize, interval, reason, qualityMetrics: { avgConfidence, qualityRatio } };
    }
  };

  // Main batching decision engine
  const decideBatchStrategy = (items: any[], context: BatchContext = {}): BatchDecision => {
    const strategy = strategies[state.strategy] || strategies.adaptive;
    const decision = strategy(items, context.timeSinceLastBatch, context.queueSize);
    
    // Apply safety constraints
    decision.batchSize = Math.max(state.minBatchSize, 
      Math.min(state.maxBatchSize, decision.batchSize));
    decision.interval = Math.max(8, Math.min(100, decision.interval));

    // Track metrics
    state.metrics.processedBatches++;
    state.metrics.averageBatchSize = (state.metrics.averageBatchSize * (state.metrics.processedBatches - 1) + 
      decision.batchSize) / state.metrics.processedBatches;

    // Notify adaptation callbacks
    state.callbacks.onAdaptation.forEach(cb => {
      try {
        cb({ decision, context, systemLoad: state.systemLoad, timestamp: Date.now() });
      } catch (error) {
        console.warn('Adaptation callback error:', error);
      }
    });

    return decision;
  };

  // Batch processing execution
  const processBatch = async <T, R>(items: T[], processor: BatchProcessor<T, R>): Promise<BatchResult<R>> => {
    if (!items || items.length === 0) return {
      results: [],
      processed: 0,
      remaining: [],
      processingTime: 0,
      decision: { batchSize: 0, interval: state.baseInterval, reason: 'no_items' }
    };

    const startTime = performance.now();
    const context: BatchContext = {
      timeSinceLastBatch: startTime - (state.lastBatchTime || startTime),
      queueSize: items.length
    };

    const decision = decideBatchStrategy(items, context);
    const batchItems = items.slice(0, decision.batchSize);

    try {
      const results = await processor(batchItems);
      
      // Update performance metrics
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      state.metrics.totalProcessingTime += processingTime;
      state.metrics.averageLatency = (state.metrics.averageLatency * (state.metrics.processedBatches - 1) + 
        processingTime) / state.metrics.processedBatches;
      
      state.lastBatchTime = endTime;

      // Notify batch callbacks
      state.callbacks.onBatch.forEach(cb => {
        try {
          cb({
            batchSize: batchItems.length,
            processingTime,
            results,
            decision,
            timestamp: endTime
          });
        } catch (error) {
          console.warn('Batch callback error:', error);
        }
      });

      return {
        results,
        processed: batchItems.length,
        remaining: items.slice(decision.batchSize),
        processingTime,
        decision
      };

    } catch (error) {
      state.metrics.droppedFrames += batchItems.length;
      throw error;
    }
  };

  // Continuous batch processing with adaptive scheduling
  const createBatchProcessor = <T, R>(processor: BatchProcessor<T, R>): BatchProcessorInstance => {
    const queue: T[] = [];
    let isProcessing = false;
    let scheduledTimeout: NodeJS.Timeout | null = null;

    const processQueue = async (): Promise<void> => {
      if (isProcessing || queue.length === 0) return;

      isProcessing = true;
      
      try {
        const result = await processBatch(queue.slice(), processor);
        
        // Remove processed items from queue
        queue.splice(0, result.processed);
        
        // Schedule next processing based on adaptive interval
        if (queue.length > 0) {
          scheduledTimeout = setTimeout(processQueue, result.decision.interval);
        }
      } catch (error) {
        console.error('Batch processing error:', error);
      } finally {
        isProcessing = false;
      }
    };

    const addToQueue = (items: T | T[]): void => {
      if (Array.isArray(items)) {
        queue.push(...items);
      } else {
        queue.push(items);
      }

      // Trigger processing if not already scheduled
      if (!isProcessing && !scheduledTimeout) {
        scheduledTimeout = setTimeout(processQueue, state.baseInterval);
      }

      // Emergency queue size management
      if (queue.length > state.maxBatchSize * 5) {
        console.warn('Queue overflow, dropping oldest items');
        const itemsToRemove = queue.length - state.maxBatchSize * 3;
        queue.splice(0, itemsToRemove);
        state.metrics.droppedFrames += itemsToRemove;
      }
    };

    const getQueueSize = (): number => queue.length;
    const clearQueue = (): void => { queue.splice(0); };

    const stop = (): void => {
      if (scheduledTimeout) {
        clearTimeout(scheduledTimeout);
        scheduledTimeout = null;
      }
      isProcessing = false;
    };

    return {
      addToQueue,
      getQueueSize,
      clearQueue,
      stop
    };
  };

  // Strategy switching
  const switchStrategy = (newStrategy: BatchingStrategy): boolean => {
    if (strategies[newStrategy]) {
      const oldStrategy = state.strategy;
      state.strategy = newStrategy;
      
      console.log(`Batch strategy switched from ${oldStrategy} to ${newStrategy}`);
      return true;
    }
    return false;
  };

  // Metrics and monitoring
  const getMetrics = () => ({
    ...state.metrics,
    systemLoad: { ...state.systemLoad },
    currentStrategy: state.strategy,
    adaptiveParams: { ...state.adaptiveParams }
  });

  const resetMetrics = (): void => {
    state.metrics = {
      processedBatches: 0,
      averageBatchSize: 0,
      averageLatency: 0,
      droppedFrames: 0,
      totalProcessingTime: 0
    };
  };

  // Event handlers
  const onBatch = <T>(callback: BatchCallback<T>): (() => void) => {
    state.callbacks.onBatch.push(callback as BatchCallback<any>);
    return () => {
      const index = state.callbacks.onBatch.indexOf(callback as BatchCallback<any>);
      if (index !== -1) state.callbacks.onBatch.splice(index, 1);
    };
  };

  const onSystemLoad = (callback: SystemLoadCallback): (() => void) => {
    state.callbacks.onSystemLoad.push(callback);
    return () => {
      const index = state.callbacks.onSystemLoad.indexOf(callback);
      if (index !== -1) state.callbacks.onSystemLoad.splice(index, 1);
    };
  };

  const onAdaptation = (callback: AdaptationCallback): (() => void) => {
    state.callbacks.onAdaptation.push(callback);
    return () => {
      const index = state.callbacks.onAdaptation.indexOf(callback);
      if (index !== -1) state.callbacks.onAdaptation.splice(index, 1);
    };
  };

  return {
    // Core processing
    processBatch,
    createBatchProcessor,
    decideBatchStrategy,
    
    // Strategy management
    switchStrategy,
    getAvailableStrategies: () => Object.keys(strategies),
    
    // Monitoring
    getMetrics,
    resetMetrics,
    getSystemLoad: () => ({ ...state.systemLoad }),
    
    // Configuration
    setTargetLatency: (latency: number) => { state.targetLatency = latency; },
    setBatchSizeRange: (min: number, max: number) => { 
      state.minBatchSize = min; 
      state.maxBatchSize = max; 
    },
    updateAdaptiveParams: (params: Partial<AdaptiveParams>) => {
      Object.assign(state.adaptiveParams, params);
    },
    
    // Event handlers
    onBatch,
    onSystemLoad,
    onAdaptation
  };
};