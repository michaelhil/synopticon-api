/**
 * Software Timestamp Aligner
 * NTP-style alignment with drift compensation for software timestamps
 */

import { createSyncMetrics } from '../sync-metrics.js';

// Software timestamp-based alignment with NTP-style drift compensation  
export const createSoftwareTimestampAligner = () => {
  const state = {
    referenceTime: null,
    clockSync: {
      offset: 0,
      drift: 0,
      lastSync: Date.now()
    },
    syncHistory: []
  };

  const align = (streamData) => {
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
      drift: state.clockSync.drift,
      streamId: streamData.streamId
    };
  };

  const updateClockSync = (serverTime, clientTime) => {
    const newOffset = serverTime - clientTime;
    const timeDiff = Date.now() - state.clockSync.lastSync;
    
    if (timeDiff > 0) {
      state.clockSync.drift = (newOffset - state.clockSync.offset) / timeDiff;
    }
    
    state.clockSync.offset = newOffset;
    state.clockSync.lastSync = Date.now();
    
    // Track sync history for quality metrics
    state.syncHistory.push({
      timestamp: Date.now(),
      offset: newOffset,
      drift: state.clockSync.drift
    });
    
    // Keep only recent history
    if (state.syncHistory.length > 100) {
      state.syncHistory.shift();
    }
  };

  const getQuality = () => {
    // Calculate quality based on drift stability
    let driftVariability = 0;
    if (state.syncHistory.length > 10) {
      const recentDrifts = state.syncHistory.slice(-10).map(s => s.drift);
      const avgDrift = recentDrifts.reduce((a, b) => a + b, 0) / recentDrifts.length;
      driftVariability = Math.sqrt(
        recentDrifts.reduce((sum, d) => sum + Math.pow(d - avgDrift, 2), 0) / recentDrifts.length
      );
    }
    
    return createSyncMetrics({
      quality: Math.max(0.5, 0.8 - driftVariability * 10),
      latency: 10 + Math.abs(state.clockSync.offset),
      jitter: 2 + driftVariability * 5,
      alignmentAccuracy: 5 + Math.abs(state.clockSync.drift) * 100
    });
  };

  const reset = () => {
    state.referenceTime = null;
    state.clockSync = {
      offset: 0,
      drift: 0,
      lastSync: Date.now()
    };
    state.syncHistory = [];
  };

  const getSyncStatus = () => ({
    offset: state.clockSync.offset,
    drift: state.clockSync.drift,
    lastSync: state.clockSync.lastSync,
    historyLength: state.syncHistory.length
  });

  return { 
    align, 
    getQuality, 
    updateClockSync,
    reset,
    getSyncStatus,
    strategy: 'software_timestamp'
  };
};