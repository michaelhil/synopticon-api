/**
 * @fileoverview Stream Synchronization Engine - Main Export
 * 
 * Comprehensive stream synchronization system enabling precise temporal alignment
 * of multimodal data streams with multiple synchronization strategies and
 * real-time quality monitoring.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// Core synchronization components
export { createSynchronizationEngine } from './sync-engine.js';
export { createMultiStreamCoordinator } from './multi-stream-coordinator.js';

// Temporal alignment algorithms
export { createTemporalAligner, createAdaptiveTemporalAligner, SynchronizationStrategy } from './temporal-aligners.js';

// Metrics and monitoring
export { createSyncMetrics, createAdvancedSyncMetrics, MetricsUtils, StrategySpecificMetrics } from './sync-metrics.js';

// Type definitions
export type * from './types.js';

// Re-export strategy constants for convenience
export { SynchronizationStrategy as Strategy } from './types.js';

/**
 * Convenience factory for creating a complete synchronization system
 * with default configuration suitable for most use cases
 */
export const createSyncSystem = (config: {
  strategy?: string;
  tolerance?: number;
  bufferSize?: number;
  processingInterval?: number;
} = {}) => {
  const coordinator = createMultiStreamCoordinator({
    processingInterval: config.processingInterval || 33, // ~30 FPS
    syncConfig: {
      strategy: config.strategy as any || SynchronizationStrategy.BUFFER_BASED,
      tolerance: config.tolerance || 50,
      bufferSize: config.bufferSize || 1000,
      windowMs: 5000
    }
  });

  return {
    coordinator,
    syncEngine: coordinator.getSyncEngine(),
    
    // Simplified interface
    addStream: coordinator.addStream,
    start: coordinator.start,
    stop: coordinator.stop,
    getStats: coordinator.getStatistics,
    healthCheck: coordinator.healthCheck
  };
};

/**
 * Quick setup for common synchronization scenarios
 */
export const SyncPresets = {
  /**
   * High-precision synchronization for laboratory/research environments
   */
  research: () => createSyncSystem({
    strategy: SynchronizationStrategy.HARDWARE_TIMESTAMP,
    tolerance: 1,
    bufferSize: 2000,
    processingInterval: 16 // 60 FPS
  }),

  /**
   * Real-time synchronization for interactive applications
   */
  realtime: () => createSyncSystem({
    strategy: SynchronizationStrategy.BUFFER_BASED,
    tolerance: 33,
    bufferSize: 500,
    processingInterval: 33 // 30 FPS
  }),

  /**
   * Low-latency synchronization for responsive systems
   */
  lowLatency: () => createSyncSystem({
    strategy: SynchronizationStrategy.SOFTWARE_TIMESTAMP,
    tolerance: 10,
    bufferSize: 200,
    processingInterval: 16 // 60 FPS
  }),

  /**
   * Event-driven synchronization for trigger-based systems
   */
  eventDriven: () => createSyncSystem({
    strategy: SynchronizationStrategy.EVENT_DRIVEN,
    tolerance: 100,
    bufferSize: 1000,
    processingInterval: 50 // 20 FPS
  }),

  /**
   * Robust synchronization for unreliable networks/systems
   */
  robust: () => createSyncSystem({
    strategy: SynchronizationStrategy.BUFFER_BASED,
    tolerance: 100,
    bufferSize: 3000,
    processingInterval: 100 // 10 FPS
  })
};

/**
 * Utility functions for synchronization system setup and management
 */
export const SyncUtils = {
  /**
   * Calculate optimal processing interval based on stream requirements
   */
  calculateOptimalInterval: (streamFrequencies: number[], targetLatency = 50): number => {
    if (streamFrequencies.length === 0) return 33; // Default 30 FPS
    
    const maxFreq = Math.max(...streamFrequencies);
    const idealInterval = 1000 / (maxFreq * 2); // Nyquist-inspired
    
    return Math.max(16, Math.min(targetLatency, idealInterval));
  },

  /**
   * Validate synchronization configuration
   */
  validateConfig: (config: any): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    
    if (config.tolerance && config.tolerance <= 0) {
      issues.push('Tolerance must be positive');
    }
    
    if (config.bufferSize && config.bufferSize < 10) {
      issues.push('Buffer size too small (minimum 10)');
    }
    
    if (config.processingInterval && (config.processingInterval < 1 || config.processingInterval > 1000)) {
      issues.push('Processing interval must be 1-1000ms');
    }

    if (config.strategy && !Object.values(SynchronizationStrategy).includes(config.strategy)) {
      issues.push('Invalid synchronization strategy');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  },

  /**
   * Generate performance recommendations
   */
  generateRecommendations: (stats: any): string[] => {
    const recommendations: string[] = [];
    
    if (stats.performance?.successRate < 0.9) {
      recommendations.push('Consider increasing tolerance or buffer size');
    }
    
    if (stats.performance?.averageProcessingTime > stats.coordinator?.processingInterval * 0.8) {
      recommendations.push('Increase processing interval or optimize stream processing');
    }
    
    if (stats.synchronization?.quality < 0.7) {
      recommendations.push('Switch to higher precision synchronization strategy');
    }
    
    if (stats.errors?.errorRate > 0.1) {
      recommendations.push('Investigate stream stability and error sources');
    }
    
    if (stats.synchronization?.latency > 100) {
      recommendations.push('Reduce buffer size or switch to lower-latency strategy');
    }
    
    return recommendations;
  },

  /**
   * Format synchronization statistics for display
   */
  formatStats: (stats: any): string => {
    const lines = [
      `📊 Synchronization Statistics`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Status: ${stats.coordinator?.isActive ? '✅ Active' : '❌ Inactive'}`,
      `Streams: ${stats.coordinator?.streamCount || 0}`,
      `Uptime: ${(stats.coordinator?.uptime || 0).toFixed(1)}s`,
      ``,
      `📈 Performance`,
      `Success Rate: ${((stats.performance?.successRate || 0) * 100).toFixed(1)}%`,
      `Avg Processing: ${(stats.performance?.averageProcessingTime || 0).toFixed(2)}ms`,
      `Target FPS: ${stats.coordinator?.targetFps || 'N/A'}`,
      ``,
      `🎯 Synchronization`,
      `Quality: ${((stats.synchronization?.quality || 0) * 100).toFixed(0)}%`,
      `Latency: ${(stats.synchronization?.latency || 0).toFixed(1)}ms`,
      `Jitter: ${(stats.synchronization?.jitter || 0).toFixed(1)}ms`,
      ``,
      `⚠️ Errors`,
      `Total: ${stats.errors?.errorCount || 0}`,
      `Rate: ${((stats.errors?.errorRate || 0) * 100).toFixed(2)}%`
    ];
    
    return lines.join('\n')

  },

  /**
   * Create stream data validator
   */
  createStreamValidator: () => {
    return {
      validateStreamData: (data: any): { valid: boolean; issues: string[] } => {
        const issues: string[] = [];
        
        if (!data.streamId) {
          issues.push('Missing streamId');
        }
        
        if (typeof data.timestamp !== 'number' && !data.timestamp) {
          issues.push('Missing or invalid timestamp');
        }
        
        if (data.timestamp && data.timestamp < 0) {
          issues.push('Negative timestamp not allowed');
        }
        
        if (data.timestamp && data.timestamp > Date.now() + 60000) {
          issues.push('Future timestamp detected (more than 1 minute ahead)');
        }
        
        return {
          valid: issues.length === 0,
          issues
        };
      }
    };
  }
};

/**
 * Debug utilities for synchronization system
 */
export const SyncDebug = {
  /**
   * Create debug logger for synchronization events
   */
  createLogger: (prefix = 'SYNC') => ({
    logSync: (alignmentResults: Map<string, any>, metrics: any) => {
      console.log(`[${prefix}] Sync completed:`, {
        streamCount: alignmentResults.size,
        quality: metrics.quality,
        latency: metrics.latency
      });
    },
    
    logError: (error: Error) => {
      console.error(`[${prefix}] Sync error:`, error.message);
    },
    
    logQuality: (metrics: any) => {
      const quality = (metrics.quality * 100).toFixed(0);
      const status = metrics.quality > 0.8 ? '✅' : metrics.quality > 0.6 ? '⚠️' : '❌';
      console.log(`[${prefix}] Quality ${status} ${quality}%`);
    }
  }),

  /**
   * Create performance monitor
   */
  createMonitor: () => {
    const startTime = Date.now();
    let syncCount = 0;
    let errorCount = 0;
    
    return {
      onSync: () => { syncCount++; },
      onError: () => { errorCount++; },
      getReport: () => {
        const uptime = (Date.now() - startTime) / 1000;
        const syncRate = syncCount / uptime;
        const errorRate = errorCount / Math.max(syncCount, 1);
        
        return {
          uptime,
          syncCount,
          errorCount,
          syncRate: syncRate.toFixed(2),
          errorRate: (errorRate * 100).toFixed(2)
        };
      }
    };
  }
};

// Version and build information
export const SYNC_VERSION = '1.0.0';
export const BUILD_INFO = {
  version: SYNC_VERSION,
  strategies: Object.keys(SynchronizationStrategy).length,
  features: [
    'Hardware timestamp alignment',
    'Software timestamp with drift compensation',
    'Buffer-based windowing',
    'Event-driven synchronization',
    'Quality monitoring',
    'Performance analytics',
    'Multi-stream coordination'
  ],
  compatibility: {
    browser: true,
    node: true,
    webWorkers: true,
    realtime: true
  }
};