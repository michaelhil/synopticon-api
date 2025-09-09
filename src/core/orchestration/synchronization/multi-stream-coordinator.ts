/**
 * @fileoverview Multi-Stream Coordinator
 * 
 * High-level coordination system for managing multiple synchronized data streams
 * with automatic processing intervals, lifecycle management, and error handling.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createSynchronizationEngine } from './sync-engine.js';
import type {
  MultiStreamCoordinator,
  MultiStreamCoordinatorConfig,
  MultiStreamCoordinatorFactory,
  DataStream,
  SynchronizationEngine,
  StreamData,
  AlignmentResult,
  SyncMetrics
} from './types.js';

/**
 * Multi-stream coordinator factory for high-level stream management
 */
export const createMultiStreamCoordinator: MultiStreamCoordinatorFactory = (config = {}) => {
  const state = {
    syncEngine: createSynchronizationEngine(config.syncConfig),
    streams: new Map<string, DataStream>(),
    processingInterval: config.processingInterval || 33, // ~30 FPS
    intervalId: null as NodeJS.Timeout | number | null,
    isActive: false,
    
    // Performance tracking
    stats: {
      totalProcessingCycles: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageProcessingTime: 0,
      lastProcessingTime: 0,
      startTime: 0
    },

    // Error handling
    errorCount: 0,
    maxErrors: 10,
    errorWindow: 60000 // 1 minute
  };

  /**
   * Add stream to coordination system
   */
  const addStream = async (stream: DataStream): Promise<void> => {
    const streamId = stream.getId();
    
    try {
      // Register stream
      state.streams.set(streamId, stream);
      state.syncEngine.addStream(streamId, stream);

      // Listen to stream data and forward to sync engine
      stream.onData(async (data: StreamData) => {
        if (state.isActive) {
          try {
            await state.syncEngine.processStreamData(streamId, data);
            
            // Update success stats
            state.stats.successfulSyncs++;
          } catch (error) {
            console.warn(`Sync processing error for stream ${streamId}:`, error);
            
            // Update error stats
            state.stats.failedSyncs++;
            state.errorCount++;
            
            // Handle excessive errors
            if (state.errorCount > state.maxErrors) {
              console.error(`Too many sync errors (${state.errorCount}), stopping coordinator`);
              await stop();
            }
          }
        }
      });

      console.log(`🎯 Stream ${streamId} added to multi-stream coordinator`);
    } catch (error) {
      console.error(`Failed to add stream ${streamId}:`, error);
      throw error;
    }
  };

  /**
   * Remove stream from coordination system
   */
  const removeStream = (streamId: string): void => {
    const stream = state.streams.get(streamId);
    if (stream) {
      try {
        // Stop the stream
        stream.stop();
        
        // Remove from maps
        state.streams.delete(streamId);
        state.syncEngine.removeStream(streamId);
        
        console.log(`🎯 Stream ${streamId} removed from multi-stream coordinator`);
      } catch (error) {
        console.warn(`Error removing stream ${streamId}:`, error);
      }
    }
  };

  /**
   * Start coordination system
   */
  const start = async (): Promise<void> => {
    try {
      console.log('🚀 Starting multi-stream coordinator...');
      
      // Reset stats
      state.stats.startTime = Date.now();
      state.stats.totalProcessingCycles = 0;
      state.stats.successfulSyncs = 0;
      state.stats.failedSyncs = 0;
      state.errorCount = 0;

      // Start all streams
      const streamStartPromises = Array.from(state.streams.values()).map(async (stream) => {
        try {
          await stream.start();
          console.log(`✅ Stream ${stream.getId()} started`);
        } catch (error) {
          console.error(`❌ Failed to start stream ${stream.getId()}:`, error);
          throw error;
        }
      });

      await Promise.all(streamStartPromises);

      // Start synchronization engine
      state.syncEngine.start();
      state.isActive = true;

      // Start processing interval with performance tracking
      state.intervalId = setInterval(async () => {
        const cycleStartTime = performance.now();
        
        try {
          state.stats.totalProcessingCycles++;
          
          // Perform synchronization
          const alignmentResults = await state.syncEngine.synchronizeStreams();
          
          // Update processing time stats
          const processingTime = performance.now() - cycleStartTime;
          state.stats.lastProcessingTime = processingTime;
          
          // Calculate rolling average
          const alpha = 0.1; // Smoothing factor
          state.stats.averageProcessingTime = state.stats.averageProcessingTime === 0 
            ? processingTime 
            : state.stats.averageProcessingTime * (1 - alpha) + processingTime * alpha;
          
          // Performance monitoring
          if (processingTime > state.processingInterval * 0.8) {
            console.warn(`⚠️ Sync processing taking ${processingTime.toFixed(2)}ms, approaching interval limit`);
          }
          
        } catch (error) {
          console.warn('Sync interval error:', error);
          state.stats.failedSyncs++;
          state.errorCount++;
        }
      }, state.processingInterval);

      console.log(`✅ Multi-stream coordinator started with ${state.streams.size} streams`);
      console.log(`⏱️ Processing interval: ${state.processingInterval}ms (~${Math.round(1000/state.processingInterval)}fps)`);
      
    } catch (error) {
      console.error('Failed to start multi-stream coordinator:', error);
      await stop(); // Cleanup on failure
      throw error;
    }
  };

  /**
   * Stop coordination system
   */
  const stop = async (): Promise<void> => {
    try {
      console.log('🛑 Stopping multi-stream coordinator...');

      // Stop processing interval
      if (state.intervalId) {
        clearInterval(state.intervalId as NodeJS.Timeout);
        state.intervalId = null;
      }

      // Stop synchronization engine
      state.syncEngine.stop();
      state.isActive = false;

      // Stop all streams
      const streamStopPromises = Array.from(state.streams.values()).map(async (stream) => {
        try {
          await stream.stop();
          console.log(`🔴 Stream ${stream.getId()} stopped`);
        } catch (error) {
          console.warn(`Warning stopping stream ${stream.getId()}:`, error);
        }
      });

      await Promise.allSettled(streamStopPromises); // Use allSettled to handle individual failures

      // Log final statistics
      const totalTime = Date.now() - state.stats.startTime;
      const uptime = totalTime / 1000;
      const successRate = state.stats.totalProcessingCycles > 0 
        ? (state.stats.successfulSyncs / state.stats.totalProcessingCycles * 100).toFixed(1)
        : '0';

      console.log('📊 Multi-stream coordinator statistics:');
      console.log(`   Uptime: ${uptime.toFixed(1)}s`);
      console.log(`   Processing cycles: ${state.stats.totalProcessingCycles}`);
      console.log(`   Success rate: ${successRate}%`);
      console.log(`   Average processing time: ${state.stats.averageProcessingTime.toFixed(2)}ms`);
      
      console.log('✅ Multi-stream coordinator stopped');
      
    } catch (error) {
      console.error('Error stopping multi-stream coordinator:', error);
    }
  };

  /**
   * Get synchronization engine for advanced control
   */
  const getSyncEngine = (): SynchronizationEngine => state.syncEngine;

  /**
   * Get all registered streams
   */
  const getStreams = (): Map<string, DataStream> => new Map(state.streams);

  /**
   * Check if coordinator is active
   */
  const isActive = (): boolean => state.isActive;

  /**
   * Get comprehensive performance statistics
   */
  const getStatistics = () => {
    const uptime = state.stats.startTime > 0 ? Date.now() - state.stats.startTime : 0;
    const syncMetrics = state.syncEngine.getMetrics();
    
    return {
      coordinator: {
        isActive: state.isActive,
        uptime: uptime / 1000,
        streamCount: state.streams.size,
        processingInterval: state.processingInterval,
        targetFps: Math.round(1000 / state.processingInterval)
      },
      performance: {
        totalProcessingCycles: state.stats.totalProcessingCycles,
        successfulSyncs: state.stats.successfulSyncs,
        failedSyncs: state.stats.failedSyncs,
        successRate: state.stats.totalProcessingCycles > 0 
          ? state.stats.successfulSyncs / state.stats.totalProcessingCycles 
          : 0,
        averageProcessingTime: state.stats.averageProcessingTime,
        lastProcessingTime: state.stats.lastProcessingTime
      },
      synchronization: {
        quality: syncMetrics.quality,
        latency: syncMetrics.latency,
        jitter: syncMetrics.jitter,
        alignmentAccuracy: syncMetrics.alignmentAccuracy
      },
      errors: {
        errorCount: state.errorCount,
        errorRate: state.stats.totalProcessingCycles > 0 
          ? state.errorCount / state.stats.totalProcessingCycles 
          : 0,
        maxErrors: state.maxErrors
      }
    };
  };

  /**
   * Update processing interval (requires restart to take effect)
   */
  const updateProcessingInterval = (newInterval: number): void => {
    if (newInterval > 0 && newInterval <= 1000) {
      state.processingInterval = newInterval;
      console.log(`⚙️ Processing interval updated to ${newInterval}ms (~${Math.round(1000/newInterval)}fps)`);
      
      if (state.isActive) {
        console.log('⚠️ Restart coordinator for interval change to take effect');
      }
    } else {
      console.warn('Invalid processing interval. Must be between 1-1000ms');
    }
  };

  /**
   * Set error handling parameters
   */
  const setErrorHandling = (maxErrors: number, windowMs: number): void => {
    state.maxErrors = maxErrors;
    state.errorWindow = windowMs;
    console.log(`⚙️ Error handling updated: max ${maxErrors} errors in ${windowMs}ms window`);
  };

  /**
   * Force synchronization cycle
   */
  const forceSynchronization = async (): Promise<Map<string, AlignmentResult>> => {
    if (!state.isActive) {
      throw new Error('Coordinator is not active');
    }
    
    try {
      const cycleStartTime = performance.now();
      const results = await state.syncEngine.synchronizeStreams();
      const processingTime = performance.now() - cycleStartTime;
      
      console.log(`🔄 Manual sync completed in ${processingTime.toFixed(2)}ms`);
      return results;
    } catch (error) {
      console.error('Manual synchronization failed:', error);
      throw error;
    }
  };

  /**
   * Health check for coordinator
   */
  const healthCheck = () => {
    const stats = getStatistics();
    const issues: string[] = [];
    
    if (!state.isActive) {
      issues.push('Coordinator is not active');
    }
    
    if (stats.performance.successRate < 0.9) {
      issues.push('Low sync success rate');
    }
    
    if (stats.performance.averageProcessingTime > state.processingInterval * 0.8) {
      issues.push('Processing time approaching interval limit');
    }
    
    if (stats.synchronization.quality < 0.7) {
      issues.push('Poor synchronization quality');
    }
    
    if (stats.errors.errorRate > 0.1) {
      issues.push('High error rate');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      stats,
      timestamp: new Date().toISOString()
    };
  };

  return {
    addStream,
    removeStream,
    start,
    stop,
    getSyncEngine,
    getStreams,
    isActive,
    
    // Extended functionality
    getStatistics,
    updateProcessingInterval,
    setErrorHandling,
    forceSynchronization,
    healthCheck
  };
};