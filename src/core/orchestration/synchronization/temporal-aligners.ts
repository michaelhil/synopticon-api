/**
 * @fileoverview Temporal Alignment Algorithms
 * 
 * Multiple synchronization strategies for precise temporal alignment of
 * multimodal data streams with hardware and software timing support.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createSyncMetrics } from './sync-metrics.js';
import type { 
  TemporalAligner, 
  TemporalAlignerFactory,
  SynchronizationStrategyType,
  SynchronizationStrategy,
  StreamData,
  AlignmentResult,
  SyncMetrics,
  StreamBuffer,
  HardwareTimestampState,
  SoftwareTimestampState,
  BufferBasedState,
  EventDrivenState,
  SyncEvent,
  LinearRegressionPoint
} from './types.js';

/**
 * Create temporal aligner based on strategy
 */
export const createTemporalAligner: TemporalAlignerFactory = (strategy = SynchronizationStrategy.BUFFER_BASED) => {
  const aligners = {
    [SynchronizationStrategy.HARDWARE_TIMESTAMP]: createHardwareTimestampAligner,
    [SynchronizationStrategy.SOFTWARE_TIMESTAMP]: createSoftwareTimestampAligner,
    [SynchronizationStrategy.BUFFER_BASED]: createBufferBasedAligner,
    [SynchronizationStrategy.EVENT_DRIVEN]: createEventDrivenAligner
  };

  const aligner = aligners[strategy];
  if (!aligner) {
    throw new Error(`Unknown synchronization strategy: ${strategy}`);
  }

  return aligner();
};

/**
 * Hardware timestamp-based alignment (highest precision)
 * Uses hardware clocks and drift compensation for microsecond accuracy
 */
const createHardwareTimestampAligner = (): TemporalAligner => {
  const state: HardwareTimestampState = {
    referenceTime: null,
    clockOffsets: new Map(), // Track clock differences per stream
    driftCompensation: new Map()
  };

  const align = (streamData: StreamData): AlignmentResult => {
    // Use hardware timestamps if available
    const hwTimestamp = streamData.hardwareTimestamp || streamData.timestamp || Date.now();
    
    if (!state.referenceTime) {
      state.referenceTime = hwTimestamp;
    }

    // Calculate offset from reference time
    const offset = hwTimestamp - state.referenceTime;
    
    // Track clock drift for this stream
    const { streamId } = streamData;
    if (!state.clockOffsets.has(streamId)) {
      state.clockOffsets.set(streamId, []);
    }
    
    const offsets = state.clockOffsets.get(streamId)!;
    offsets.push({ timestamp: Date.now(), offset });
    
    // Keep only recent offsets for drift calculation
    if (offsets.length > 100) {
      offsets.splice(0, offsets.length - 100);
    }
    
    // Calculate drift compensation
    let drift = 0;
    if (offsets.length > 10) {
      const recent = offsets.slice(-10);
      const points: LinearRegressionPoint[] = recent.map((o, i) => [i, o.offset]);
      const slope = calculateLinearSlope(points);
      drift = slope * offsets.length;
    }
    
    state.driftCompensation.set(streamId, drift);
    
    return {
      alignedTimestamp: hwTimestamp - drift,
      confidence: 0.95,
      offset: offset - drift,
      drift
    };
  };

  const getQuality = (): SyncMetrics => createSyncMetrics({
    quality: 0.95,
    latency: 1, // ~1ms precision with hardware timestamps
    jitter: 0.5,
    alignmentAccuracy: 1
  });

  return { 
    align, 
    getQuality, 
    strategy: SynchronizationStrategy.HARDWARE_TIMESTAMP 
  };
};

/**
 * Software timestamp-based alignment with NTP-style drift compensation
 * Provides good accuracy with software clocks and network time synchronization
 */
const createSoftwareTimestampAligner = (): TemporalAligner => {
  const state: SoftwareTimestampState = {
    referenceTime: null,
    clockSync: {
      offset: 0,
      drift: 0,
      lastSync: Date.now()
    }
  };

  const align = (streamData: StreamData): AlignmentResult => {
    const timestamp = streamData.timestamp || Date.now();
    
    if (!state.referenceTime) {
      state.referenceTime = timestamp;
    }

    // Apply clock synchronization
    const syncedTime = timestamp + state.clockSync.offset + 
                      (Date.now() - state.clockSync.lastSync) * state.clockSync.drift;
    
    const offset = syncedTime - state.referenceTime;
    
    return {
      alignedTimestamp: syncedTime,
      confidence: 0.8,
      offset,
      drift: state.clockSync.drift
    };
  };

  const updateClockSync = (serverTime: number, clientTime: number): void => {
    const newOffset = serverTime - clientTime;
    const timeDiff = Date.now() - state.clockSync.lastSync;
    
    if (timeDiff > 0) {
      state.clockSync.drift = (newOffset - state.clockSync.offset) / timeDiff;
    }
    
    state.clockSync.offset = newOffset;
    state.clockSync.lastSync = Date.now();
  };

  const getQuality = (): SyncMetrics => createSyncMetrics({
    quality: 0.8,
    latency: 10,
    jitter: 2,
    alignmentAccuracy: 5
  });

  const aligner: TemporalAligner = { 
    align, 
    getQuality, 
    updateClockSync,
    strategy: SynchronizationStrategy.SOFTWARE_TIMESTAMP 
  };

  return aligner;
};

/**
 * Buffer-based sliding window alignment
 * Uses temporal windows and tolerance matching for multi-stream coordination
 */
const createBufferBasedAligner = (): TemporalAligner => {
  const state: BufferBasedState = {
    windowSize: 1000, // 1 second window
    tolerance: 50, // 50ms tolerance
    referenceStream: null
  };

  const align = (streamDataArray: StreamData | StreamData[], referenceTimestamp?: number): AlignmentResult | AlignmentResult[] => {
    const dataArray = Array.isArray(streamDataArray) ? streamDataArray : [streamDataArray];
    const refTimestamp = referenceTimestamp || Date.now();
    const results: AlignmentResult[] = [];
    
    for (const streamData of dataArray) {
      const timestamp = streamData.timestamp || Date.now();
      const diff = Math.abs(timestamp - refTimestamp);
      
      // Find closest match within tolerance
      if (diff <= state.tolerance) {
        results.push({
          alignedTimestamp: refTimestamp,
          confidence: Math.max(0, 1 - diff / state.tolerance),
          offset: timestamp - refTimestamp,
          data: streamData
        });
      }
    }

    return Array.isArray(streamDataArray) ? results : results[0];
  };

  const findBestAlignment = (streamBuffers: Map<string, StreamBuffer>, targetTimestamp: number): Map<string, AlignmentResult> => {
    const aligned = new Map<string, AlignmentResult>();
    
    for (const [streamId, buffer] of streamBuffers) {
      const closest = buffer.getClosest(targetTimestamp, state.tolerance);
      if (closest) {
        const timeDiff = Math.abs(closest.timestamp! - targetTimestamp);
        aligned.set(streamId, {
          data: closest,
          alignedTimestamp: targetTimestamp,
          confidence: 1 - timeDiff / state.tolerance,
          offset: closest.timestamp! - targetTimestamp
        });
      }
    }
    
    return aligned;
  };

  const getQuality = (alignmentResults?: Map<string, AlignmentResult>): SyncMetrics => {
    if (!alignmentResults || alignmentResults.size === 0) {
      return createSyncMetrics({ quality: 0 });
    }

    const confidences = Array.from(alignmentResults.values()).map(r => r.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const maxOffset = Math.max(...Array.from(alignmentResults.values()).map(r => Math.abs(r.offset)));
    
    return createSyncMetrics({
      quality: avgConfidence,
      latency: maxOffset,
      jitter: Math.max(0, maxOffset - state.tolerance),
      alignmentAccuracy: maxOffset
    });
  };

  return { 
    align, 
    findBestAlignment,
    getQuality, 
    strategy: SynchronizationStrategy.BUFFER_BASED 
  };
};

/**
 * Event-driven synchronization (trigger-based)
 * Synchronizes streams based on external trigger events with temporal windows
 */
const createEventDrivenAligner = (): TemporalAligner => {
  const state: EventDrivenState = {
    events: [],
    eventWindow: 100, // 100ms window around events
    lastEventTime: null
  };

  const registerEvent = (eventType: string, timestamp = Date.now()): void => {
    state.events.push({ type: eventType, timestamp });
    state.lastEventTime = timestamp;
    
    // Keep only recent events
    const cutoff = timestamp - 60000; // 1 minute
    state.events = state.events.filter(e => e.timestamp > cutoff);
  };

  const align = (streamData: StreamData, eventType?: string): AlignmentResult => {
    const timestamp = streamData.timestamp || Date.now();
    
    // Find the nearest event
    let nearestEvent: SyncEvent | null = null;
    let minDistance = Infinity;
    
    for (const event of state.events) {
      if (eventType && event.type !== eventType) continue;
      
      const distance = Math.abs(timestamp - event.timestamp);
      if (distance < minDistance && distance <= state.eventWindow) {
        minDistance = distance;
        nearestEvent = event;
      }
    }

    if (nearestEvent) {
      return {
        alignedTimestamp: nearestEvent.timestamp,
        confidence: Math.max(0, 1 - minDistance / state.eventWindow),
        offset: timestamp - nearestEvent.timestamp,
        event: nearestEvent
      };
    }

    return {
      alignedTimestamp: timestamp,
      confidence: 0.1, // Low confidence without event alignment
      offset: 0,
      event: null
    };
  };

  const getQuality = (hasRecentEvent = false): SyncMetrics => createSyncMetrics({
    quality: hasRecentEvent ? 0.9 : 0.3,
    latency: hasRecentEvent ? 5 : 50,
    jitter: hasRecentEvent ? 1 : 20,
    alignmentAccuracy: hasRecentEvent ? 2 : 50
  });

  const aligner: TemporalAligner = { 
    align, 
    registerEvent,
    getQuality, 
    strategy: SynchronizationStrategy.EVENT_DRIVEN 
  };

  return aligner;
};

/**
 * Utility function to calculate linear regression slope
 * Used for drift compensation in temporal alignment
 */
const calculateLinearSlope = (points: LinearRegressionPoint[]): number => {
  const n = points.length;
  if (n < 2) return 0;

  const sumX = points.reduce((sum, [x]) => sum + x, 0);
  const sumY = points.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumX2 = points.reduce((sum, [x]) => sum + x * x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) return 0; // Avoid division by zero

  return (n * sumXY - sumX * sumY) / denominator;
};

/**
 * Advanced temporal alignment with adaptive parameters
 */
export const createAdaptiveTemporalAligner = (baseStrategy: SynchronizationStrategyType) => {
  const baseAligner = createTemporalAligner(baseStrategy);
  
  const adaptiveState = {
    performanceHistory: [] as Array<{ timestamp: number; quality: number; latency: number }>,
    adaptationEnabled: true,
    qualityThreshold: 0.8,
    adaptationRate: 0.1
  };

  const adaptiveAlign = (streamData: StreamData, context?: unknown): AlignmentResult => {
    const result = baseAligner.align(streamData, context as any);
    
    if (adaptiveState.adaptationEnabled) {
      // Track performance
      const quality = baseAligner.getQuality();
      adaptiveState.performanceHistory.push({
        timestamp: Date.now(),
        quality: quality.quality,
        latency: quality.latency
      });

      // Keep recent history
      if (adaptiveState.performanceHistory.length > 100) {
        adaptiveState.performanceHistory.shift();
      }

      // Adaptive quality adjustment
      if (quality.quality < adaptiveState.qualityThreshold) {
        result.confidence *= 0.9; // Reduce confidence for poor quality
      }
    }

    return result;
  };

  const getAdaptiveQuality = (): SyncMetrics => {
    const baseQuality = baseAligner.getQuality();
    
    if (adaptiveState.performanceHistory.length > 10) {
      const recentQuality = adaptiveState.performanceHistory
        .slice(-10)
        .reduce((sum, h) => sum + h.quality, 0) / 10;
      
      // Blend base and adaptive quality
      baseQuality.quality = baseQuality.quality * 0.7 + recentQuality * 0.3;
    }

    return baseQuality;
  };

  return {
    ...baseAligner,
    align: adaptiveAlign,
    getQuality: getAdaptiveQuality,
    enableAdaptation: (enabled: boolean) => {
      adaptiveState.adaptationEnabled = enabled;
    },
    getPerformanceHistory: () => [...adaptiveState.performanceHistory]
  };
};

// Export strategy constants for convenience
export { SynchronizationStrategy } from './types.js';