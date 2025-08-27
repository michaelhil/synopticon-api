/**
 * Buffer-Based Aligner
 * Sliding window alignment for buffered stream synchronization
 */

import { createSyncMetrics } from '../sync-metrics.js';

// Buffer-based sliding window alignment
export const createBufferBasedAligner = () => {
  const state = {
    windowSize: 1000, // 1 second window
    tolerance: 50, // 50ms tolerance
    referenceStream: null,
    alignmentHistory: []
  };

  const align = (streamDataArray, referenceTimestamp) => {
    if (!Array.isArray(streamDataArray)) {
      streamDataArray = [streamDataArray];
    }

    const results = [];
    
    for (const streamData of streamDataArray) {
      const timestamp = streamData.timestamp || Date.now();
      const diff = Math.abs(timestamp - referenceTimestamp);
      
      // Find closest match within tolerance
      if (diff <= state.tolerance) {
        const result = {
          alignedTimestamp: referenceTimestamp,
          confidence: Math.max(0, 1 - diff / state.tolerance),
          offset: timestamp - referenceTimestamp,
          data: streamData,
          streamId: streamData.streamId
        };
        
        results.push(result);
      }
    }

    // Track alignment quality over time
    if (results.length > 0) {
      const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
      state.alignmentHistory.push({
        timestamp: referenceTimestamp,
        alignedStreams: results.length,
        avgConfidence,
        maxOffset: Math.max(...results.map(r => Math.abs(r.offset)))
      });
      
      // Keep history manageable
      if (state.alignmentHistory.length > 100) {
        state.alignmentHistory.shift();
      }
    }

    return results;
  };

  const findBestAlignment = (streamBuffers, targetTimestamp) => {
    const aligned = new Map();
    
    for (const [streamId, buffer] of streamBuffers) {
      const closest = buffer.getClosest ? 
        buffer.getClosest(targetTimestamp, state.tolerance) :
        findClosestInArray(buffer, targetTimestamp, state.tolerance);
        
      if (closest) {
        aligned.set(streamId, {
          data: closest,
          alignedTimestamp: targetTimestamp,
          confidence: 1 - Math.abs(closest.timestamp - targetTimestamp) / state.tolerance,
          offset: closest.timestamp - targetTimestamp,
          streamId
        });
      }
    }
    
    return aligned;
  };

  const findClosestInArray = (dataArray, targetTimestamp, tolerance) => {
    let closest = null;
    let minDiff = Infinity;
    
    for (const data of dataArray) {
      const diff = Math.abs(data.timestamp - targetTimestamp);
      if (diff < minDiff && diff <= tolerance) {
        minDiff = diff;
        closest = data;
      }
    }
    
    return closest;
  };

  const getQuality = (alignmentResults = null) => {
    if (alignmentResults && alignmentResults.size > 0) {
      // Calculate quality from current alignment results
      const confidences = Array.from(alignmentResults.values()).map(r => r.confidence);
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const maxOffset = Math.max(...Array.from(alignmentResults.values()).map(r => Math.abs(r.offset)));
      
      return createSyncMetrics({
        quality: avgConfidence,
        latency: maxOffset,
        jitter: Math.max(0, maxOffset - state.tolerance),
        alignmentAccuracy: maxOffset
      });
    }
    
    // Calculate quality from historical performance
    if (state.alignmentHistory.length > 0) {
      const recent = state.alignmentHistory.slice(-10);
      const avgConfidence = recent.reduce((sum, h) => sum + h.avgConfidence, 0) / recent.length;
      const avgMaxOffset = recent.reduce((sum, h) => sum + h.maxOffset, 0) / recent.length;
      
      return createSyncMetrics({
        quality: avgConfidence,
        latency: avgMaxOffset,
        jitter: Math.max(0, avgMaxOffset - state.tolerance),
        alignmentAccuracy: avgMaxOffset
      });
    }
    
    return createSyncMetrics({ quality: 0 });
  };

  const updateConfig = (newConfig) => {
    if (newConfig.windowSize !== undefined) {
      state.windowSize = newConfig.windowSize;
    }
    if (newConfig.tolerance !== undefined) {
      state.tolerance = newConfig.tolerance;
    }
  };

  const reset = () => {
    state.referenceStream = null;
    state.alignmentHistory = [];
  };

  const getStats = () => ({
    windowSize: state.windowSize,
    tolerance: state.tolerance,
    alignmentHistoryLength: state.alignmentHistory.length,
    recentPerformance: state.alignmentHistory.slice(-5)
  });

  return { 
    align, 
    findBestAlignment,
    getQuality, 
    updateConfig,
    reset,
    getStats,
    strategy: 'buffer_based'
  };
};