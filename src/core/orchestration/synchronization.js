/**
 * Stream Synchronization Engine
 * Enables precise temporal alignment of multimodal data streams
 * Following functional programming patterns with factory functions
 */

import { createStreamBuffer } from '../state/streams.js';

// Synchronization strategy types
export const SynchronizationStrategy = {
  HARDWARE_TIMESTAMP: 'hardware_timestamp',
  SOFTWARE_TIMESTAMP: 'software_timestamp', 
  BUFFER_BASED: 'buffer_based',
  EVENT_DRIVEN: 'event_driven'
};

// Synchronization quality metrics factory
export const createSyncMetrics = (config = {}) => ({
  quality: config.quality || 1.0,
  latency: config.latency || 0,
  jitter: config.jitter || 0,
  droppedSamples: config.droppedSamples || 0,
  alignmentAccuracy: config.alignmentAccuracy || 0,
  lastUpdate: config.lastUpdate || Date.now(),
  
  // Quality scoring based on multiple factors
  computeOverallQuality() {
    const jitterPenalty = Math.min(this.jitter / 100, 0.3); // Max 30% penalty for jitter
    const dropPenalty = Math.min(this.droppedSamples / 1000, 0.4); // Max 40% penalty for drops
    const latencyPenalty = Math.min(this.latency / 1000, 0.2); // Max 20% penalty for latency
    
    return Math.max(0, 1.0 - jitterPenalty - dropPenalty - latencyPenalty);
  }
});

// Temporal alignment algorithm implementations
export const createTemporalAligner = (strategy = SynchronizationStrategy.BUFFER_BASED) => {
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

// Hardware timestamp-based alignment (highest precision)
const createHardwareTimestampAligner = () => {
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
      drift
    };
  };

  const getQuality = () => createSyncMetrics({
    quality: 0.95,
    latency: 1, // ~1ms precision with hardware timestamps
    jitter: 0.5,
    alignmentAccuracy: 1
  });

  return { align, getQuality, strategy: SynchronizationStrategy.HARDWARE_TIMESTAMP };
};

// Software timestamp-based alignment with NTP-style drift compensation  
const createSoftwareTimestampAligner = () => {
  const state = {
    referenceTime: null,
    clockSync: {
      offset: 0,
      drift: 0,
      lastSync: Date.now()
    }
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
      drift: state.clockSync.drift
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
  };

  const getQuality = () => createSyncMetrics({
    quality: 0.8,
    latency: 10,
    jitter: 2,
    alignmentAccuracy: 5
  });

  return { 
    align, 
    getQuality, 
    updateClockSync,
    strategy: SynchronizationStrategy.SOFTWARE_TIMESTAMP 
  };
};

// Buffer-based sliding window alignment
const createBufferBasedAligner = () => {
  const state = {
    windowSize: 1000, // 1 second window
    tolerance: 50, // 50ms tolerance
    referenceStream: null
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
        results.push({
          alignedTimestamp: referenceTimestamp,
          confidence: Math.max(0, 1 - diff / state.tolerance),
          offset: timestamp - referenceTimestamp,
          data: streamData
        });
      }
    }

    return results;
  };

  const findBestAlignment = (streamBuffers, targetTimestamp) => {
    const aligned = new Map();
    
    for (const [streamId, buffer] of streamBuffers) {
      const closest = buffer.getClosest(targetTimestamp, state.tolerance);
      if (closest) {
        aligned.set(streamId, {
          data: closest,
          alignedTimestamp: targetTimestamp,
          confidence: 1 - Math.abs(closest.timestamp - targetTimestamp) / state.tolerance,
          offset: closest.timestamp - targetTimestamp
        });
      }
    }
    
    return aligned;
  };

  const getQuality = (alignmentResults) => {
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

// Event-driven synchronization (trigger-based)
const createEventDrivenAligner = () => {
  const state = {
    events: [],
    eventWindow: 100, // 100ms window around events
    lastEventTime: null
  };

  const registerEvent = (eventType, timestamp = Date.now()) => {
    state.events.push({ type: eventType, timestamp });
    state.lastEventTime = timestamp;
    
    // Keep only recent events
    const cutoff = timestamp - 60000; // 1 minute
    state.events = state.events.filter(e => e.timestamp > cutoff);
  };

  const align = (streamData, eventType = null) => {
    const timestamp = streamData.timestamp || Date.now();
    
    // Find the nearest event
    let nearestEvent = null;
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

  const getQuality = (hasRecentEvent = false) => createSyncMetrics({
    quality: hasRecentEvent ? 0.9 : 0.3,
    latency: hasRecentEvent ? 5 : 50,
    jitter: hasRecentEvent ? 1 : 20,
    alignmentAccuracy: hasRecentEvent ? 2 : 50
  });

  return { 
    align, 
    registerEvent,
    getQuality, 
    strategy: SynchronizationStrategy.EVENT_DRIVEN 
  };
};

// Main synchronization engine factory
export const createSynchronizationEngine = (config = {}) => {
  const state = {
    strategy: config.strategy || SynchronizationStrategy.BUFFER_BASED,
    tolerance: config.tolerance || 50, // 50ms default tolerance
    aligner: null,
    streams: new Map(),
    syncMetrics: createSyncMetrics(),
    callbacks: {
      onSync: [],
      onQualityChange: [],
      onError: []
    },
    isRunning: false
  };

  // Initialize the appropriate aligner
  state.aligner = createTemporalAligner(state.strategy);

  const addStream = (streamId, stream) => {
    state.streams.set(streamId, {
      stream,
      buffer: createStreamBuffer({ 
        maxSize: config.bufferSize || 1000,
        windowMs: config.windowMs || 5000 
      }),
      lastTimestamp: null,
      metrics: createSyncMetrics()
    });
  };

  const removeStream = (streamId) => {
    state.streams.delete(streamId);
  };

  const synchronizeStreams = async (targetTimestamp = Date.now()) => {
    if (state.streams.size === 0) return new Map();

    try {
      const streamBuffers = new Map();
      for (const [streamId, streamInfo] of state.streams) {
        streamBuffers.set(streamId, streamInfo.buffer);
      }

      let alignmentResults;
      
      if (state.aligner.findBestAlignment) {
        // Buffer-based alignment
        alignmentResults = state.aligner.findBestAlignment(streamBuffers, targetTimestamp);
      } else {
        // Direct alignment for other strategies
        alignmentResults = new Map();
        for (const [streamId, streamInfo] of state.streams) {
          const latest = streamInfo.buffer.getLatest(1)[0];
          if (latest) {
            const result = state.aligner.align(latest, state.tolerance);
            alignmentResults.set(streamId, result);
          }
        }
      }

      // Update sync metrics
      state.syncMetrics = state.aligner.getQuality(alignmentResults);
      
      // Notify callbacks
      state.callbacks.onSync.forEach(cb => {
        try {
          cb(alignmentResults, state.syncMetrics);
        } catch (error) {
          console.warn('Sync callback error:', error);
        }
      });

      return alignmentResults;
      
    } catch (error) {
      state.callbacks.onError.forEach(cb => {
        try {
          cb(error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      });
      throw error;
    }
  };

  const processStreamData = async (streamId, data) => {
    const streamInfo = state.streams.get(streamId);
    if (!streamInfo) {
      throw new Error(`Stream ${streamId} not registered`);
    }

    // Add data to stream buffer
    const bufferedData = streamInfo.buffer.add(data);
    streamInfo.lastTimestamp = data.timestamp || Date.now();

    // Trigger synchronization if we have multiple streams
    if (state.streams.size > 1 && state.isRunning) {
      return await synchronizeStreams(bufferedData.timestamp);
    }

    return new Map([[streamId, { data: bufferedData, confidence: 1.0 }]]);
  };

  const start = () => {
    state.isRunning = true;
  };

  const stop = () => {
    state.isRunning = false;
  };

  // Event handlers
  const onSync = (callback) => {
    state.callbacks.onSync.push(callback);
    return () => {
      const index = state.callbacks.onSync.indexOf(callback);
      if (index !== -1) state.callbacks.onSync.splice(index, 1);
    };
  };

  const onQualityChange = (callback) => {
    state.callbacks.onQualityChange.push(callback);
    return () => {
      const index = state.callbacks.onQualityChange.indexOf(callback);
      if (index !== -1) state.callbacks.onQualityChange.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  // Getters
  const getStrategy = () => state.strategy;
  const getMetrics = () => ({ ...state.syncMetrics });
  const getStreamCount = () => state.streams.size;
  const isRunning = () => state.isRunning;

  // Backward compatibility alias for onSynchronizedData
  const onSynchronizedData = (callback) => {
    // Transform the onSync callback signature to match expected syncedStreams format
    return onSync((alignmentResults, syncMetrics) => {
      const syncedStreams = [];
      
      for (const [streamId, alignmentData] of alignmentResults.entries()) {
        const streamType = streamId.includes('-') ? streamId.split('-')[0] : streamId;
        
        syncedStreams.push({
          streamId,
          streamType,
          timestamp: alignmentData.data?.timestamp || alignmentData.alignedTimestamp || Date.now(),
          data: alignmentData.data,
          confidence: alignmentData.confidence || 1.0,
          syncMetrics
        });
      }
      
      callback(syncedStreams);
    });
  };

  return {
    // Stream management
    addStream,
    removeStream,
    
    // Synchronization
    synchronizeStreams,
    processStreamData,
    
    // Control
    start,
    stop,
    
    // Event handlers
    onSync,
    onSynchronizedData, // Backward compatibility alias
    onQualityChange, 
    onError,
    
    // Status
    getStrategy,
    getMetrics,
    getStreamCount,
    isRunning,
    
    // Statistics for debugging
    getStats: () => ({
      streamCount: state.streams.size,
      strategy: state.strategy,
      tolerance: state.tolerance,
      isRunning: state.isRunning,
      metrics: { ...state.syncMetrics }
    })
  };
};

// Multi-stream coordinator factory
export const createMultiStreamCoordinator = (config = {}) => {
  const state = {
    syncEngine: createSynchronizationEngine(config.syncConfig),
    streams: new Map(),
    processingInterval: config.processingInterval || 33, // ~30 FPS
    intervalId: null,
    isActive: false
  };

  const addStream = async (stream) => {
    const streamId = stream.getId();
    state.streams.set(streamId, stream);
    state.syncEngine.addStream(streamId, stream);

    // Listen to stream data
    stream.onData(async (data) => {
      if (state.isActive) {
        try {
          await state.syncEngine.processStreamData(streamId, data);
        } catch (error) {
          console.warn(`Sync processing error for stream ${streamId}:`, error);
        }
      }
    });
  };

  const removeStream = (streamId) => {
    const stream = state.streams.get(streamId);
    if (stream) {
      stream.stop();
      state.streams.delete(streamId);
      state.syncEngine.removeStream(streamId);
    }
  };

  const start = async () => {
    // Start all streams
    for (const stream of state.streams.values()) {
      await stream.start();
    }

    // Start synchronization engine
    state.syncEngine.start();
    state.isActive = true;

    // Start processing interval
    state.intervalId = setInterval(async () => {
      try {
        await state.syncEngine.synchronizeStreams();
      } catch (error) {
        console.warn('Sync interval error:', error);
      }
    }, state.processingInterval);
  };

  const stop = () => {
    // Stop processing interval
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }

    // Stop synchronization engine
    state.syncEngine.stop();
    state.isActive = false;

    // Stop all streams
    for (const stream of state.streams.values()) {
      stream.stop();
    }
  };

  return {
    addStream,
    removeStream,
    start,
    stop,
    getSyncEngine: () => state.syncEngine,
    getStreams: () => new Map(state.streams),
    isActive: () => state.isActive
  };
};

// Utility functions
const calculateLinearSlope = (points) => {
  const n = points.length;
  if (n < 2) return 0;

  const sumX = points.reduce((sum, [x]) => sum + x, 0);
  const sumY = points.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumX2 = points.reduce((sum, [x]) => sum + x * x, 0);

  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
};
