/**
 * Buffer-Based Aligner
 * Alignment using buffering strategies for variable latency streams
 */

import { SynchronizationStrategy } from '../strategies/sync-strategies.js';
import { createSyncMetrics } from '../metrics/sync-metrics.js';

/**
 * Buffer-based alignment for variable latency streams
 * Uses adaptive buffering to synchronize streams with different characteristics
 */
export const createBufferBasedAligner = (config = {}) => {
  const alignerConfig = {
    bufferSize: config.bufferSize || 100,
    maxBufferLatency: config.maxBufferLatency || 200, // ms
    adaptiveBuffering: config.adaptiveBuffering !== false,
    latencyThreshold: config.latencyThreshold || 50,
    confidenceThreshold: config.confidenceThreshold || 0.75,
    ...config
  };

  const state = {
    streamBuffers: new Map(),
    referenceStream: null,
    bufferMetrics: {
      totalBuffered: 0,
      droppedSamples: 0,
      avgLatency: 0,
      maxLatency: 0
    }
  };

  // Create buffer for a stream
  const createStreamBuffer = (streamId) => ({
    id: streamId,
    samples: [],
    latencyHistory: [],
    avgLatency: 0,
    isReference: false,
    lastFlush: Date.now()
  });

  // Adaptive buffer size calculation
  const calculateOptimalBufferSize = (streamId) => {
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

  const align = (streamData) => {
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

    const buffer = state.streamBuffers.get(streamId);
    const latency = now - timestamp;

    // Update latency tracking
    buffer.latencyHistory.push(latency);
    if (buffer.latencyHistory.length > 50) {
      buffer.latencyHistory.splice(0, 10);
    }
    buffer.avgLatency = buffer.latencyHistory.reduce((sum, l) => sum + l, 0) / buffer.latencyHistory.length;

    // Add sample to buffer
    buffer.samples.push({
      ...streamData,
      arrivalTime: now,
      latency
    });

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
    const referenceBuffer = state.streamBuffers.get(state.referenceStream);
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

  // Flush old samples from buffers
  const flushBuffers = () => {
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

  // Periodic buffer maintenance
  const maintenanceInterval = setInterval(flushBuffers, alignerConfig.maxBufferLatency / 2);

  const getQuality = () => {
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

  const getStats = () => ({
    ...state.bufferMetrics,
    activeStreams: state.streamBuffers.size,
    referenceStream: state.referenceStream,
    totalBufferSize: Array.from(state.streamBuffers.values())
      .reduce((sum, buffer) => sum + buffer.samples.length, 0),
    avgBufferSize: Array.from(state.streamBuffers.values())
      .reduce((sum, buffer) => sum + buffer.samples.length, 0) / Math.max(1, state.streamBuffers.size)
  });

  const cleanup = async () => {
    if (maintenanceInterval) {
      clearInterval(maintenanceInterval);
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

  return { 
    align, 
    getQuality, 
    getStats,
    flushBuffers,
    cleanup,
    strategy: SynchronizationStrategy.BUFFER_BASED 
  };
};