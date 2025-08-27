/**
 * Hardware Timestamp Aligner
 * Highest precision alignment using hardware timing sources
 */

import { SynchronizationStrategy } from '../strategies/sync-strategies.js';
import { createSyncMetrics } from '../metrics/sync-metrics.js';

/**
 * Hardware timestamp-based alignment (highest precision)
 * Uses hardware timestamps with drift compensation
 */
export const createHardwareTimestampAligner = (config = {}) => {
  const alignerConfig = {
    maxOffsetHistory: config.maxOffsetHistory || 100,
    driftCalculationWindow: config.driftCalculationWindow || 10,
    confidenceThreshold: config.confidenceThreshold || 0.95,
    ...config
  };

  const state = {
    referenceTime: null,
    clockOffsets: new Map(), // Track clock differences per stream
    driftCompensation: new Map(),
    alignmentStats: {
      totalAlignments: 0,
      averageOffset: 0,
      maxDrift: 0
    }
  };

  // Linear slope calculation for drift compensation
  const calculateLinearSlope = (points) => {
    const n = points.length;
    if (n < 2) return 0;

    const sumX = points.reduce((sum, [x]) => sum + x, 0);
    const sumY = points.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumXX = points.reduce((sum, [x]) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isFinite(slope) ? slope : 0;
  };

  const align = (streamData) => {
    // Use hardware timestamps if available
    const hwTimestamp = streamData.hardwareTimestamp || streamData.timestamp;
    
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
    
    const offsets = state.clockOffsets.get(streamId);
    offsets.push({ timestamp: Date.now(), offset });
    
    // Keep only recent offsets for drift calculation
    if (offsets.length > alignerConfig.maxOffsetHistory) {
      offsets.splice(0, offsets.length - alignerConfig.maxOffsetHistory);
    }
    
    // Calculate drift compensation
    let drift = 0;
    let confidence = alignerConfig.confidenceThreshold;
    
    if (offsets.length > alignerConfig.driftCalculationWindow) {
      const recent = offsets.slice(-alignerConfig.driftCalculationWindow);
      const slope = calculateLinearSlope(recent.map((o, i) => [i, o.offset]));
      drift = slope * offsets.length;
      
      // Adjust confidence based on drift stability
      const variance = recent.reduce((sum, o) => {
        const expectedOffset = o.offset - drift;
        return sum + Math.pow(offset - expectedOffset, 2);
      }, 0) / recent.length;
      
      confidence = Math.max(0.5, alignerConfig.confidenceThreshold - (variance / 1000));
    }
    
    state.driftCompensation.set(streamId, drift);
    
    // Update stats
    state.alignmentStats.totalAlignments++;
    state.alignmentStats.averageOffset = (state.alignmentStats.averageOffset + Math.abs(offset)) / 2;
    state.alignmentStats.maxDrift = Math.max(state.alignmentStats.maxDrift, Math.abs(drift));

    return {
      alignedTimestamp: hwTimestamp - drift,
      confidence,
      offset: offset - drift,
      drift,
      strategy: SynchronizationStrategy.HARDWARE_TIMESTAMP
    };
  };

  const getQuality = () => createSyncMetrics({
    quality: Math.min(0.95, 1.0 - (state.alignmentStats.maxDrift / 10000)), // Penalize excessive drift
    latency: 1, // ~1ms precision with hardware timestamps
    jitter: state.alignmentStats.averageOffset / 10, // Convert to relative jitter
    droppedSamples: 0, // Hardware timestamps don't typically drop
    alignmentAccuracy: state.alignmentStats.averageOffset,
    totalAlignments: state.alignmentStats.totalAlignments
  });

  const getStats = () => ({
    ...state.alignmentStats,
    activeStreams: state.clockOffsets.size,
    avgDrift: Array.from(state.driftCompensation.values()).reduce((sum, d) => sum + Math.abs(d), 0) / Math.max(1, state.driftCompensation.size)
  });

  const cleanup = async () => {
    state.clockOffsets.clear();
    state.driftCompensation.clear();
    state.referenceTime = null;
    state.alignmentStats = {
      totalAlignments: 0,
      averageOffset: 0,
      maxDrift: 0
    };
  };

  return { 
    align, 
    getQuality, 
    getStats,
    cleanup,
    strategy: SynchronizationStrategy.HARDWARE_TIMESTAMP 
  };
};