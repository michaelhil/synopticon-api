/**
 * Software Timestamp Aligner
 * Software-based alignment with NTP-style drift compensation
 */

import { SynchronizationStrategy } from '../strategies/sync-strategies.js';
import { createSyncMetrics } from '../metrics/sync-metrics.js';

/**
 * Software timestamp-based alignment with NTP-style drift compensation
 * Uses software timestamps with network time synchronization
 */
export const createSoftwareTimestampAligner = (config = {}) => {
  const alignerConfig = {
    ntpSyncInterval: config.ntpSyncInterval || 30000, // 30 seconds
    maxClockSkew: config.maxClockSkew || 1000, // 1 second
    smoothingFactor: config.smoothingFactor || 0.8,
    confidenceThreshold: config.confidenceThreshold || 0.85,
    ...config
  };

  const state = {
    referenceTime: null,
    clockSync: {
      offset: 0,
      drift: 0,
      lastSync: 0,
      syncHistory: []
    },
    streamOffsets: new Map(),
    qualityMetrics: {
      avgLatency: 5,
      jitter: 2,
      syncQuality: alignerConfig.confidenceThreshold
    }
  };

  // NTP-style network time synchronization
  const performTimeSync = async () => {
    const t1 = Date.now(); // Client send time
    
    try {
      // In a real implementation, this would query NTP server
      // For now, simulate network round-trip
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      
      const t4 = Date.now(); // Client receive time
      const t2 = t1 + (t4 - t1) / 2; // Simulated server receive time
      const t3 = t2; // Simulated server send time
      
      // Calculate offset and round-trip delay
      const offset = ((t2 - t1) + (t3 - t4)) / 2;
      const delay = (t4 - t1) - (t3 - t2);
      
      // Apply smoothing to reduce jitter
      const smoothedOffset = state.clockSync.offset * alignerConfig.smoothingFactor + 
                           offset * (1 - alignerConfig.smoothingFactor);
      
      // Update clock sync state
      state.clockSync.offset = smoothedOffset;
      state.clockSync.lastSync = Date.now();
      state.clockSync.syncHistory.push({ timestamp: t4, offset, delay });
      
      // Keep only recent sync history
      if (state.clockSync.syncHistory.length > 50) {
        state.clockSync.syncHistory.splice(0, 10);
      }
      
      // Calculate drift
      if (state.clockSync.syncHistory.length > 5) {
        const recent = state.clockSync.syncHistory.slice(-5);
        const driftSlope = calculateLinearTrend(recent.map((s, i) => [i, s.offset]));
        state.clockSync.drift = driftSlope;
      }
      
      // Update quality metrics
      state.qualityMetrics.avgLatency = delay / 2;
      state.qualityMetrics.jitter = Math.sqrt(
        state.clockSync.syncHistory.slice(-10).reduce((sum, s) => {
          return sum + Math.pow(s.delay - state.qualityMetrics.avgLatency * 2, 2);
        }, 0) / Math.min(10, state.clockSync.syncHistory.length)
      );
      
    } catch (error) {
      console.warn('Time sync failed:', error.message);
      state.qualityMetrics.syncQuality *= 0.9; // Degrade quality on sync failure
    }
  };

  // Linear trend calculation
  const calculateLinearTrend = (points) => {
    const n = points.length;
    if (n < 2) return 0;

    const sumX = points.reduce((sum, [x]) => sum + x, 0);
    const sumY = points.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumXX = points.reduce((sum, [x]) => sum + x * x, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  };

  // Initialize periodic time sync
  const syncInterval = setInterval(performTimeSync, alignerConfig.ntpSyncInterval);
  performTimeSync(); // Initial sync

  const align = (streamData) => {
    const now = Date.now();
    const timestamp = streamData.timestamp || now;
    
    if (!state.referenceTime) {
      state.referenceTime = timestamp;
    }

    // Apply clock offset and drift compensation
    const timeSinceLastSync = now - state.clockSync.lastSync;
    const driftAdjustment = state.clockSync.drift * (timeSinceLastSync / 1000);
    const adjustedTimestamp = timestamp + state.clockSync.offset + driftAdjustment;
    
    // Track stream-specific offsets
    const { streamId } = streamData;
    if (streamId) {
      if (!state.streamOffsets.has(streamId)) {
        state.streamOffsets.set(streamId, []);
      }
      
      const offsets = state.streamOffsets.get(streamId);
      const streamOffset = adjustedTimestamp - state.referenceTime;
      offsets.push({ timestamp: now, offset: streamOffset });
      
      // Keep recent history
      if (offsets.length > 20) {
        offsets.splice(0, 10);
      }
    }

    // Calculate confidence based on sync quality and age
    const syncAge = timeSinceLastSync / alignerConfig.ntpSyncInterval;
    const confidence = Math.max(0.5, 
      alignerConfig.confidenceThreshold * Math.exp(-syncAge) * state.qualityMetrics.syncQuality
    );

    return {
      alignedTimestamp: adjustedTimestamp,
      confidence,
      offset: adjustedTimestamp - timestamp,
      drift: driftAdjustment,
      strategy: SynchronizationStrategy.SOFTWARE_TIMESTAMP
    };
  };

  const getQuality = () => createSyncMetrics({
    quality: state.qualityMetrics.syncQuality,
    latency: state.qualityMetrics.avgLatency,
    jitter: state.qualityMetrics.jitter,
    droppedSamples: 0,
    alignmentAccuracy: Math.abs(state.clockSync.offset),
    lastSync: state.clockSync.lastSync
  });

  const getStats = () => ({
    clockOffset: state.clockSync.offset,
    clockDrift: state.clockSync.drift,
    lastSyncAge: Date.now() - state.clockSync.lastSync,
    syncHistorySize: state.clockSync.syncHistory.length,
    activeStreams: state.streamOffsets.size,
    avgLatency: state.qualityMetrics.avgLatency,
    jitter: state.qualityMetrics.jitter
  });

  const cleanup = async () => {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    state.streamOffsets.clear();
    state.clockSync.syncHistory = [];
    state.referenceTime = null;
  };

  return { 
    align, 
    getQuality, 
    getStats,
    cleanup,
    strategy: SynchronizationStrategy.SOFTWARE_TIMESTAMP 
  };
};