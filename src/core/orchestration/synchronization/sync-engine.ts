/**
 * @fileoverview Synchronization Engine Core
 * 
 * Main synchronization engine coordinating multiple data streams with
 * temporal alignment, quality monitoring, and event-driven callbacks.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createStreamBuffer } from '../../state/streams.js';
import { createTemporalAligner } from './temporal-aligners.js';
import { createSyncMetrics } from './sync-metrics.js';
import type {
  SynchronizationEngine,
  SynchronizationEngineConfig,
  SynchronizationStrategy,
  StreamData,
  AlignmentResult,
  SyncMetrics,
  StreamInfo,
  SyncCallbacks,
  DataStream,
  SynchronizedStreamData,
  TemporalAligner,
  SynchronizationEngineFactory
} from './types.js';

/**
 * Main synchronization engine factory
 */
export const createSynchronizationEngine: SynchronizationEngineFactory = (config = {}) => {
  const state = {
    strategy: config.strategy || SynchronizationStrategy.BUFFER_BASED,
    tolerance: config.tolerance || 50, // 50ms default tolerance
    aligner: null as TemporalAligner | null,
    streams: new Map<string, StreamInfo>(),
    syncMetrics: createSyncMetrics(),
    callbacks: {
      onSync: [],
      onQualityChange: [],
      onError: []
    } as SyncCallbacks,
    isRunning: false
  };

  // Initialize the appropriate aligner
  state.aligner = createTemporalAligner(state.strategy);

  /**
   * Add stream to synchronization engine
   */
  const addStream = (streamId: string, stream: DataStream): void => {
    state.streams.set(streamId, {
      stream,
      buffer: createStreamBuffer({ 
        maxSize: config.bufferSize || 1000,
        windowMs: config.windowMs || 5000 
      }),
      lastTimestamp: null,
      metrics: createSyncMetrics()
    });

    console.log(`📡 Stream ${streamId} added to synchronization engine`);
  };

  /**
   * Remove stream from synchronization engine
   */
  const removeStream = (streamId: string): void => {
    const streamInfo = state.streams.get(streamId);
    if (streamInfo) {
      state.streams.delete(streamId);
      console.log(`📡 Stream ${streamId} removed from synchronization engine`);
    }
  };

  /**
   * Synchronize all streams to target timestamp
   */
  const synchronizeStreams = async (targetTimestamp = Date.now()): Promise<Map<string, AlignmentResult>> => {
    if (state.streams.size === 0 || !state.aligner) {
      return new Map();
    }

    try {
      const streamBuffers = new Map<string, any>();
      for (const [streamId, streamInfo] of state.streams) {
        streamBuffers.set(streamId, streamInfo.buffer);
      }

      let alignmentResults: Map<string, AlignmentResult>;
      
      if (state.aligner.findBestAlignment) {
        // Buffer-based alignment
        alignmentResults = state.aligner.findBestAlignment(streamBuffers, targetTimestamp);
      } else {
        // Direct alignment for other strategies
        alignmentResults = new Map();
        for (const [streamId, streamInfo] of state.streams) {
          const latest = streamInfo.buffer.getLatest(1)[0];
          if (latest) {
            const result = state.aligner.align(latest);
            if (Array.isArray(result)) {
              // Handle multiple results case
              if (result.length > 0) {
                alignmentResults.set(streamId, result[0]);
              }
            } else {
              alignmentResults.set(streamId, result);
            }
          }
        }
      }

      // Update sync metrics
      state.syncMetrics = state.aligner.getQuality(alignmentResults);
      
      // Notify sync callbacks
      for (const callback of state.callbacks.onSync) {
        try {
          callback(alignmentResults, state.syncMetrics);
        } catch (error) {
          console.warn('Sync callback error:', error);
        }
      }

      return alignmentResults;
      
    } catch (error) {
      // Notify error callbacks
      for (const callback of state.callbacks.onError) {
        try {
          callback(error as Error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      }
      throw error;
    }
  };

  /**
   * Process incoming stream data and trigger synchronization
   */
  const processStreamData = async (streamId: string, data: StreamData): Promise<Map<string, AlignmentResult>> => {
    const streamInfo = state.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not registered`);
    }

    try {
      // Add data to stream buffer
      const bufferedData = streamInfo.buffer.add({
        ...data,
        streamId,
        timestamp: data.timestamp || Date.now()
      });
      
      streamInfo.lastTimestamp = bufferedData.timestamp!;

      // Update stream-specific metrics
      streamInfo.metrics = createSyncMetrics({
        quality: streamInfo.metrics.quality,
        latency: Date.now() - bufferedData.timestamp!,
        lastUpdate: Date.now()
      });

      // Trigger synchronization if we have multiple streams
      if (state.streams.size > 1 && state.isRunning) {
        return await synchronizeStreams(bufferedData.timestamp);
      }

      // Single stream case - return direct mapping
      return new Map([[streamId, { 
        data: bufferedData, 
        alignedTimestamp: bufferedData.timestamp!,
        confidence: 1.0,
        offset: 0
      }]]);

    } catch (error) {
      console.error(`Error processing stream data for ${streamId}:`, error);
      
      // Notify error callbacks
      for (const callback of state.callbacks.onError) {
        try {
          callback(error as Error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      }

      throw error;
    }
  };

  /**
   * Start synchronization engine
   */
  const start = (): void => {
    state.isRunning = true;
    console.log('🔄 Synchronization engine started');
  };

  /**
   * Stop synchronization engine
   */
  const stop = (): void => {
    state.isRunning = false;
    console.log('⏹️ Synchronization engine stopped');
  };

  /**
   * Register callback for synchronization events
   */
  const onSync = (callback: (alignmentResults: Map<string, AlignmentResult>, syncMetrics: SyncMetrics) => void): (() => void) => {
    state.callbacks.onSync.push(callback);
    return () => {
      const index = state.callbacks.onSync.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onSync.splice(index, 1);
      }
    };
  };

  /**
   * Register callback for quality changes
   */
  const onQualityChange = (callback: (metrics: SyncMetrics) => void): (() => void) => {
    state.callbacks.onQualityChange.push(callback);
    return () => {
      const index = state.callbacks.onQualityChange.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onQualityChange.splice(index, 1);
      }
    };
  };

  /**
   * Register callback for errors
   */
  const onError = (callback: (error: Error) => void): (() => void) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) {
        state.callbacks.onError.splice(index, 1);
      }
    };
  };

  /**
   * Backward compatibility alias for onSynchronizedData
   * Transforms the onSync callback signature to match expected syncedStreams format
   */
  const onSynchronizedData = (callback: (syncedStreams: SynchronizedStreamData[]) => void): (() => void) => {
    return onSync((alignmentResults, syncMetrics) => {
      const syncedStreams: SynchronizedStreamData[] = [];
      
      for (const [streamId, alignmentData] of alignmentResults.entries()) {
        const streamType = streamId.includes('-') ? streamId.split('-')[0] : streamId;
        
        syncedStreams.push({
          streamId,
          streamType,
          timestamp: alignmentData.data?.timestamp || alignmentData.alignedTimestamp || Date.now(),
          data: alignmentData.data,
          confidence: alignmentData.confidence || 1.0,
          syncMetrics
        });
      }
      
      try {
        callback(syncedStreams);
      } catch (error) {
        console.warn('Synchronized data callback error:', error);
      }
    });
  };

  /**
   * Get current synchronization strategy
   */
  const getStrategy = () => state.strategy;

  /**
   * Get current synchronization metrics
   */
  const getMetrics = (): SyncMetrics => ({ ...state.syncMetrics });

  /**
   * Get number of registered streams
   */
  const getStreamCount = (): number => state.streams.size;

  /**
   * Check if engine is running
   */
  const isRunning = (): boolean => state.isRunning;

  /**
   * Get comprehensive statistics for debugging
   */
  const getStats = () => ({
    streamCount: state.streams.size,
    strategy: state.strategy,
    tolerance: state.tolerance,
    isRunning: state.isRunning,
    metrics: { ...state.syncMetrics },
    streamDetails: Array.from(state.streams.entries()).map(([id, info]) => ({
      streamId: id,
      lastTimestamp: info.lastTimestamp,
      bufferSize: info.buffer.size,
      metrics: { ...info.metrics }
    }))
  });

  /**
   * Advanced synchronization with custom parameters
   */
  const advancedSync = async (options: {
    targetTimestamp?: number;
    tolerance?: number;
    strategy?: string;
    includeMetadata?: boolean;
  } = {}) => {
    const targetTimestamp = options.targetTimestamp || Date.now();
    const tolerance = options.tolerance || state.tolerance;
    
    const results = await synchronizeStreams(targetTimestamp);
    
    if (options.includeMetadata) {
      // Add detailed metadata to results
      for (const [streamId, result] of results) {
        const streamInfo = state.streams.get(streamId);
        if (streamInfo) {
          (result as any).metadata = {
            streamMetrics: streamInfo.metrics,
            bufferSize: streamInfo.buffer.size,
            lastUpdate: streamInfo.lastTimestamp,
            tolerance
          };
        }
      }
    }
    
    return results;
  };

  /**
   * Flush all stream buffers
   */
  const flushBuffers = (): void => {
    for (const [streamId, streamInfo] of state.streams) {
      streamInfo.buffer.clear();
      console.log(`🧹 Buffer flushed for stream ${streamId}`);
    }
  };

  /**
   * Update synchronization tolerance
   */
  const updateTolerance = (newTolerance: number): void => {
    if (newTolerance > 0) {
      state.tolerance = newTolerance;
      console.log(`⚙️ Synchronization tolerance updated to ${newTolerance}ms`);
    }
  };

  return {
    // Stream management
    addStream,
    removeStream,
    
    // Synchronization
    synchronizeStreams,
    processStreamData,
    
    // Control
    start,
    stop,
    
    // Event handlers
    onSync,
    onSynchronizedData, // Backward compatibility alias
    onQualityChange, 
    onError,
    
    // Status
    getStrategy,
    getMetrics,
    getStreamCount,
    isRunning,
    
    // Statistics and debugging
    getStats,
    
    // Advanced features
    advancedSync,
    flushBuffers,
    updateTolerance
  };
};