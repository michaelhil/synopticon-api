/**
 * @fileoverview Buffer-Based Aligner Implementation
 * 
 * Provides alignment using adaptive buffering strategies for variable 
 * latency streams with dynamic buffer sizing and quality optimization.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { SynchronizationStrategy } from '../strategies/sync-strategies.js';
import { createSyncMetrics, type EnhancedSyncMetrics } from '../metrics/sync-metrics.js';

// ==========================================
// Type Definitions
// ==========================================

/**
 * Buffer-based aligner configuration
 */
export interface BufferBasedAlignerConfig {
  /** Initial buffer size */
  bufferSize?: number;
  /** Maximum buffer latency in milliseconds */
  maxBufferLatency?: number;
  /** Enable adaptive buffer sizing */
  adaptiveBuffering?: boolean;
  /** Latency threshold for adjustments */
  latencyThreshold?: number;
  /** Minimum confidence threshold */
  confidenceThreshold?: number;
}

/**
 * Stream buffer data structure
 */
export interface StreamBuffer {
  /** Stream identifier */
  id: string;
  /** Buffered samples */
  samples: BufferedSample[];
  /** Historical latency measurements */
  latencyHistory: number[];
  /** Average latency */
  avgLatency: number;
  /** Whether this is the reference stream */
  isReference: boolean;
  /** Last buffer flush timestamp */
  lastFlush: number;
}

/**
 * Buffered sample with metadata
 */
export interface BufferedSample {
  /** Original stream data */
  [key: string]: any;
  /** Stream identifier */
  streamId: string;
  /** Original timestamp */
  timestamp: number;
  /** Arrival time at buffer */
  arrivalTime: number;
  /** Calculated latency */
  latency: number;
}

/**
 * Buffer metrics tracking
 */
export interface BufferMetrics {
  /** Total samples buffered */
  totalBuffered: number;
  /** Number of dropped samples */
  droppedSamples: number;
  /** Average buffer latency */
  avgLatency: number;
  /** Maximum observed latency */
  maxLatency: number;
}

/**
 * Stream data input
 */
export interface StreamData {
  /** Stream identifier */
  streamId: string;
  /** Data timestamp */
  timestamp: number;
  /** Additional stream-specific data */
  [key: string]: any;
}

/**
 * Alignment result from buffer-based aligner
 */
export interface BufferAlignmentResult {
  /** Aligned timestamp */
  alignedTimestamp: number;
  /** Alignment confidence (0.0 - 1.0) */
  confidence: number;
  /** Synchronization offset */
  offset: number;
  /** Current buffer size */
  bufferSize: number;
  /** Calculated optimal buffer size */
  optimalBufferSize: number;
  /** Average latency */
  latency: number;
  /** Strategy used */
  strategy: SynchronizationStrategy.BUFFER_BASED;
}

/**
 * Buffer statistics
 */
export interface BufferStatistics extends BufferMetrics {
  /** Number of active streams */
  activeStreams: number;
  /** Reference stream identifier */
  referenceStream: string | null;
  /** Total buffer size across all streams */
  totalBufferSize: number;
  /** Average buffer size */
  avgBufferSize: number;
}

/**
 * Buffer-based aligner interface
 */
export interface BufferBasedAligner {
  /** Align stream data using buffer-based strategy */
  align(streamData: StreamData): BufferAlignmentResult;
  /** Get current alignment quality metrics */
  getQuality(): EnhancedSyncMetrics;
  /** Get buffer statistics */
  getStats(): BufferStatistics;
  /** Flush old samples from buffers */
  flushBuffers(): void;
  /** Clean up resources */
  cleanup(): Promise<void>;
  /** Strategy identifier */
  strategy: SynchronizationStrategy.BUFFER_BASED;
}

// ==========================================
// Internal State Interface
// ==========================================

/**
 * Internal aligner state
 */
interface BufferAlignerState {
  /** Stream buffers map */
  streamBuffers: Map<string, StreamBuffer>;
  /** Reference stream identifier */
  referenceStream: string | null;
  /** Buffer performance metrics */
  bufferMetrics: BufferMetrics;
}

// ==========================================
// Buffer-Based Aligner Factory
// ==========================================

/**
 * Creates buffer-based aligner for variable latency stream synchronization
 * 
 * @param config - Aligner configuration options
 * @returns Buffer-based aligner instance
 */
export const createBufferBasedAligner = (config: BufferBasedAlignerConfig = {}): BufferBasedAligner => {
  const alignerConfig = {
    bufferSize: config.bufferSize ?? 100,
    maxBufferLatency: config.maxBufferLatency ?? 200, // ms
    adaptiveBuffering: config.adaptiveBuffering ?? true,
    latencyThreshold: config.latencyThreshold ?? 50,
    confidenceThreshold: config.confidenceThreshold ?? 0.75,
    ...config
  };

  const state: BufferAlignerState = {
    streamBuffers: new Map(),
    referenceStream: null,
    bufferMetrics: {
      totalBuffered: 0,
      droppedSamples: 0,
      avgLatency: 0,
      maxLatency: 0
    }
  };

  let maintenanceInterval: NodeJS.Timeout | null = null;

  /**
   * Create new stream buffer
   */
  const createStreamBuffer = (streamId: string): StreamBuffer => ({
    id: streamId,
    samples: [],
    latencyHistory: [],
    avgLatency: 0,
    isReference: false,
    lastFlush: Date.now()
  });

  /**
   * Calculate optimal buffer size based on latency variance
   */
  const calculateOptimalBufferSize = (streamId: string): number => {
    const buffer = state.streamBuffers.get(streamId);
    if (!buffer || buffer.latencyHistory.length < 10) {
      return alignerConfig.bufferSize;
    }

    // Calculate variance in latency
    const recentLatency = buffer.latencyHistory.slice(-20);
    const avgLatency = recentLatency.reduce((sum, l) => sum + l, 0) / recentLatency.length;
    const variance = recentLatency.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) / recentLatency.length;

    // Adaptive buffer size based on latency variance
    const adaptiveSize = Math.ceil(alignerConfig.bufferSize * (1 + Math.sqrt(variance) / 100));
    return Math.min(adaptiveSize, alignerConfig.bufferSize * 2);
  };

  /**
   * Align stream data using buffer-based strategy
   */
  const align = (streamData: StreamData): BufferAlignmentResult => {
    const { streamId, timestamp } = streamData;
    const now = Date.now();

    // Initialize stream buffer if needed
    if (!state.streamBuffers.has(streamId)) {
      const buffer = createStreamBuffer(streamId);
      state.streamBuffers.set(streamId, buffer);

      // Set first stream as reference if no reference exists
      if (!state.referenceStream) {
        state.referenceStream = streamId;
        buffer.isReference = true;
      }
    }

    const buffer = state.streamBuffers.get(streamId)!;
    const latency = now - timestamp;

    // Update latency tracking
    buffer.latencyHistory.push(latency);
    if (buffer.latencyHistory.length > 50) {
      buffer.latencyHistory.splice(0, 10);
    }
    buffer.avgLatency = buffer.latencyHistory.reduce((sum, l) => sum + l, 0) / buffer.latencyHistory.length;

    // Add sample to buffer
    const bufferedSample: BufferedSample = {
      ...streamData,
      streamId,
      timestamp,
      arrivalTime: now,
      latency
    };
    
    buffer.samples.push(bufferedSample);

    // Update global metrics
    state.bufferMetrics.totalBuffered++;
    state.bufferMetrics.avgLatency = (state.bufferMetrics.avgLatency + latency) / 2;
    state.bufferMetrics.maxLatency = Math.max(state.bufferMetrics.maxLatency, latency);

    // Determine optimal buffer size
    const optimalBufferSize = alignerConfig.adaptiveBuffering
      ? calculateOptimalBufferSize(streamId)
      : alignerConfig.bufferSize;

    // Keep buffer within limits
    if (buffer.samples.length > optimalBufferSize) {
      const dropped = buffer.samples.splice(0, buffer.samples.length - optimalBufferSize);
      state.bufferMetrics.droppedSamples += dropped.length;
    }

    // Find alignment point
    let alignedTimestamp = timestamp;
    let confidence = alignerConfig.confidenceThreshold;

    if (buffer.samples.length > 2) {
      // Use median timestamp for alignment stability
      const recentTimestamps = buffer.samples.slice(-5).map(s => s.timestamp).sort((a, b) => a - b);
      const medianIndex = Math.floor(recentTimestamps.length / 2);
      alignedTimestamp = recentTimestamps[medianIndex];

      // Adjust confidence based on buffer stability
      const timestampVariance = recentTimestamps.reduce((sum, ts) => {
        return sum + Math.pow(ts - alignedTimestamp, 2);
      }, 0) / recentTimestamps.length;

      confidence = Math.max(0.3, alignerConfig.confidenceThreshold - (timestampVariance / 10000));
    }

    // Calculate synchronization offset
    const referenceBuffer = state.streamBuffers.get(state.referenceStream || '');
    let syncOffset = 0;

    if (referenceBuffer && referenceBuffer.samples.length > 0 && !buffer.isReference) {
      const referenceTime = referenceBuffer.samples[referenceBuffer.samples.length - 1]?.timestamp || 0;
      syncOffset = alignedTimestamp - referenceTime;
    }

    return {
      alignedTimestamp,
      confidence,
      offset: syncOffset,
      bufferSize: buffer.samples.length,
      optimalBufferSize,
      latency: buffer.avgLatency,
      strategy: SynchronizationStrategy.BUFFER_BASED
    };
  };

  /**
   * Flush old samples from buffers
   */
  const flushBuffers = (): void => {
    const now = Date.now();
    const flushThreshold = alignerConfig.maxBufferLatency;

    for (const [streamId, buffer] of state.streamBuffers) {
      const initialSize = buffer.samples.length;
      buffer.samples = buffer.samples.filter(sample =>
        (now - sample.arrivalTime) < flushThreshold
      );

      const flushed = initialSize - buffer.samples.length;
      if (flushed > 0) {
        state.bufferMetrics.droppedSamples += flushed;
      }

      buffer.lastFlush = now;
    }
  };

  /**
   * Get current alignment quality metrics
   */
  const getQuality = (): EnhancedSyncMetrics => {
    const totalBufferSize = Array.from(state.streamBuffers.values())
      .reduce((sum, buffer) => sum + buffer.samples.length, 0);

    const avgBufferSize = totalBufferSize / Math.max(1, state.streamBuffers.size);
    const bufferEfficiency = Math.min(1, avgBufferSize / alignerConfig.bufferSize);

    return createSyncMetrics({
      quality: bufferEfficiency * 0.75, // Buffer-based is inherently less precise
      latency: state.bufferMetrics.avgLatency / 10, // Convert to relative scale
      jitter: Math.min(state.bufferMetrics.maxLatency / 100, 1),
      droppedSamples: state.bufferMetrics.droppedSamples,
      alignmentAccuracy: avgBufferSize,
      bufferUtilization: bufferEfficiency
    });
  };

  /**
   * Get comprehensive buffer statistics
   */
  const getStats = (): BufferStatistics => {
    const totalBufferSize = Array.from(state.streamBuffers.values())
      .reduce((sum, buffer) => sum + buffer.samples.length, 0);
    
    const avgBufferSize = totalBufferSize / Math.max(1, state.streamBuffers.size);

    return {
      ...state.bufferMetrics,
      activeStreams: state.streamBuffers.size,
      referenceStream: state.referenceStream,
      totalBufferSize,
      avgBufferSize
    };
  };

  /**
   * Clean up aligner resources
   */
  const cleanup = async (): Promise<void> => {
    if (maintenanceInterval) {
      clearInterval(maintenanceInterval);
      maintenanceInterval = null;
    }
    
    state.streamBuffers.clear();
    state.referenceStream = null;
    state.bufferMetrics = {
      totalBuffered: 0,
      droppedSamples: 0,
      avgLatency: 0,
      maxLatency: 0
    };
  };

  // Initialize periodic buffer maintenance
  maintenanceInterval = setInterval(flushBuffers, alignerConfig.maxBufferLatency / 2);

  return {
    align,
    getQuality,
    getStats,
    flushBuffers,
    cleanup,
    strategy: SynchronizationStrategy.BUFFER_BASED
  };
};

// ==========================================
// Utility Functions
// ==========================================

/**
 * Calculate buffer health score based on metrics
 */
export const calculateBufferHealth = (stats: BufferStatistics): {
  score: number;
  health: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
} => {
  const issues: string[] = [];
  let score = 1.0;

  // Check buffer efficiency
  const bufferEfficiency = stats.avgBufferSize / Math.max(stats.totalBufferSize, 1);
  if (bufferEfficiency < 0.5) {
    score *= 0.8;
    issues.push('Low buffer efficiency');
  }

  // Check drop rate
  const dropRate = stats.droppedSamples / Math.max(stats.totalBuffered, 1);
  if (dropRate > 0.1) {
    score *= 0.7;
    issues.push('High sample drop rate');
  }

  // Check latency
  if (stats.avgLatency > 100) {
    score *= 0.9;
    issues.push('High average latency');
  }

  // Check latency variance
  const latencyVariance = stats.maxLatency - stats.avgLatency;
  if (latencyVariance > 50) {
    score *= 0.85;
    issues.push('High latency variance');
  }

  let health: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 0.9) health = 'excellent';
  else if (score >= 0.75) health = 'good';
  else if (score >= 0.6) health = 'fair';
  else health = 'poor';

  return { score, health, issues };
};

/**
 * Get buffer size recommendations based on stream characteristics
 */
export const getBufferSizeRecommendations = (stats: BufferStatistics): {
  recommended: number;
  min: number;
  max: number;
  reasoning: string[];
} => {
  const reasoning: string[] = [];
  let recommended = 100; // Default

  // Adjust based on latency
  if (stats.avgLatency > 50) {
    recommended = Math.ceil(recommended * 1.5);
    reasoning.push('Increased for high latency streams');
  }

  // Adjust based on drop rate
  const dropRate = stats.droppedSamples / Math.max(stats.totalBuffered, 1);
  if (dropRate > 0.05) {
    recommended = Math.ceil(recommended * 1.3);
    reasoning.push('Increased due to high drop rate');
  }

  // Adjust based on number of streams
  if (stats.activeStreams > 5) {
    recommended = Math.ceil(recommended * 1.2);
    reasoning.push('Increased for multiple active streams');
  }

  const min = Math.ceil(recommended * 0.5);
  const max = Math.ceil(recommended * 2);

  return { recommended, min, max, reasoning };
};

/**
 * Analyze buffer performance patterns
 */
export const analyzeBufferPatterns = (stats: BufferStatistics): {
  pattern: 'stable' | 'growing' | 'shrinking' | 'oscillating' | 'unknown';
  trend: number;
  recommendations: string[];
} => {
  const recommendations: string[] = [];
  
  // Basic pattern analysis (would need historical data for full implementation)
  let pattern: 'stable' | 'growing' | 'shrinking' | 'oscillating' | 'unknown' = 'unknown';
  let trend = 0;

  // Simple heuristics based on current state
  if (stats.avgBufferSize < 10) {
    pattern = 'shrinking';
    trend = -1;
    recommendations.push('Consider increasing buffer size');
  } else if (stats.avgBufferSize > 80) {
    pattern = 'growing';
    trend = 1;
    recommendations.push('Monitor for potential memory issues');
  } else {
    pattern = 'stable';
    trend = 0;
    recommendations.push('Buffer size appears optimal');
  }

  // Check for performance issues
  if (stats.droppedSamples > 0) {
    recommendations.push('Investigate cause of dropped samples');
  }

  if (stats.maxLatency > stats.avgLatency * 2) {
    recommendations.push('High latency spikes detected - consider adaptive buffering');
  }

  return { pattern, trend, recommendations };
};