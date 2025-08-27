/**
 * Hardware Timestamp Aligner
 * Highest precision alignment using hardware timestamps with drift compensation
 */

import { createSyncMetrics } from '../sync-metrics.js';

// Helper function for linear slope calculation
const calculateLinearSlope = (points) => {
  if (points.length < 2) return 0;
  
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  
  const denominator = n * sumXX - sumX * sumX;
  return denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
};

// Hardware timestamp-based alignment (highest precision)
export const createHardwareTimestampAligner = () => {
  const state = {
    referenceTime: null,
    clockOffsets: new Map(), // Track clock differences per stream
    driftCompensation: new Map()
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
    const {streamId} = streamData;
    if (!state.clockOffsets.has(streamId)) {
      state.clockOffsets.set(streamId, []);
    }
    
    const offsets = state.clockOffsets.get(streamId);
    offsets.push({ timestamp: Date.now(), offset });
    
    // Keep only recent offsets for drift calculation
    if (offsets.length > 100) {
      offsets.splice(0, offsets.length - 100);
    }
    
    // Calculate drift compensation
    let drift = 0;
    if (offsets.length > 10) {
      const recent = offsets.slice(-10);
      const slope = calculateLinearSlope(recent.map((o, i) => [i, o.offset]));
      drift = slope * offsets.length;
    }
    
    state.driftCompensation.set(streamId, drift);
    
    return {
      alignedTimestamp: hwTimestamp - drift,
      confidence: 0.95,
      offset: offset - drift,
      drift,
      streamId
    };
  };

  const getQuality = () => createSyncMetrics({
    quality: 0.95,
    latency: 1, // ~1ms precision with hardware timestamps
    jitter: 0.5,
    alignmentAccuracy: 1
  });

  const reset = () => {
    state.referenceTime = null;
    state.clockOffsets.clear();
    state.driftCompensation.clear();
  };

  const getStreamDrift = (streamId) => {
    return state.driftCompensation.get(streamId) || 0;
  };

  const getClockOffsets = () => {
    const offsets = {};
    for (const [streamId, offsetHistory] of state.clockOffsets) {
      offsets[streamId] = offsetHistory.slice(-10); // Recent history only
    }
    return offsets;
  };

  return { 
    align, 
    getQuality, 
    reset,
    getStreamDrift,
    getClockOffsets,
    strategy: 'hardware_timestamp'
  };
};