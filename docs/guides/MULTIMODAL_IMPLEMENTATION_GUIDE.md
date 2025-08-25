# Multimodal API Implementation Guide

## Quick Start: Extending Your Current Architecture

### 1. Stream Abstraction Layer (Week 1-3)

Extend your existing pipeline pattern to support continuous data streams:

```javascript
// src/core/streams.js
import { createPipeline } from './pipeline.js';

export const createDataStream = (config = {}) => {
  const state = {
    type: config.type, // 'eye', 'audio', 'motion', 'simulator', etc.
    sampleRate: config.sampleRate || 30,
    buffer: createStreamBuffer(config.bufferSize || 1000),
    pipeline: createPipeline(config.processors || []),
    synchronizer: null,
    isActive: false,
    metadata: config.metadata || {}
  };

  const start = async () => {
    state.isActive = true;
    if (state.pipeline.initialize) {
      await state.pipeline.initialize(config.pipelineConfig);
    }
    return true;
  };

  const stop = () => {
    state.isActive = false;
    if (state.pipeline.cleanup) {
      state.pipeline.cleanup();
    }
  };

  const process = async (data) => {
    if (!state.isActive) return null;
    
    // Add timestamp and buffer management
    const timestampedData = {
      ...data,
      timestamp: performance.now(),
      streamId: config.id,
      type: state.type
    };
    
    // Process through pipeline
    const result = await state.pipeline.process(timestampedData);
    
    // Add to buffer for synchronization
    state.buffer.add(result);
    
    return result;
  };

  return {
    start,
    stop,
    process,
    getType: () => state.type,
    getSampleRate: () => state.sampleRate,
    isActive: () => state.isActive,
    getBuffer: () => state.buffer,
    getMetadata: () => state.metadata
  };
};
```

### 2. Extend Type System (Week 2)

Add multimodal data types to your existing type system:

```javascript
// src/core/types.js - Add to existing file

// Stream-specific result factories
export const createAudioResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  features: config.features || [],
  transcription: config.transcription || null,
  vad: config.vad || null, // Voice activity detection
  volume: config.volume || 0,
  confidence: config.confidence || 0,
  processingTime: config.processingTime || 0
});

export const createMotionResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  pose: config.pose || null, // 6DOF pose
  joints: config.joints || [], // Joint positions
  velocity: config.velocity || null,
  acceleration: config.acceleration || null,
  confidence: config.confidence || 0,
  processingTime: config.processingTime || 0
});

export const createSensorResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  sensorType: config.sensorType || 'unknown',
  values: config.values || [],
  units: config.units || [],
  calibration: config.calibration || null,
  confidence: config.confidence || 1.0
});

export const createMultimodalResult = (config = {}) => ({
  timestamp: config.timestamp || Date.now(),
  streams: config.streams || {}, // Results from each stream
  fusion: config.fusion || null, // Cross-modal analysis results
  synchronizationQuality: config.syncQuality || 1.0,
  totalProcessingTime: config.totalProcessingTime || 0
});
```

### 3. Multimodal Orchestrator Extension (Week 3-4)

Extend your existing orchestrator to handle multiple streams:

```javascript
// src/core/multimodal-orchestrator.js
import { createOrchestrator } from './orchestrator.js';
import { createStreamSynchronizer } from './stream-sync.js';

export const createMultimodalOrchestrator = (config = {}) => {
  // Compose with existing orchestrator
  const baseOrchestrator = createOrchestrator(config.base || {});
  
  const state = {
    streams: new Map(),
    synchronizer: createStreamSynchronizer(config.sync || {}),
    fusionStrategies: new Map(),
    activeStreams: new Set()
  };

  const registerStream = (stream) => {
    state.streams.set(stream.getType(), stream);
    return true;
  };

  const processMultimodal = async (data, requirements = {}) => {
    const activeStreams = Array.from(state.activeStreams);
    const streamResults = {};
    
    // Process each active stream
    for (const streamType of activeStreams) {
      const stream = state.streams.get(streamType);
      if (stream && data[streamType]) {
        try {
          streamResults[streamType] = await stream.process(data[streamType]);
        } catch (error) {
          console.warn(`Stream ${streamType} processing failed:`, error);
        }
      }
    }
    
    // Synchronize results if multiple streams
    if (activeStreams.length > 1) {
      const syncResults = state.synchronizer.synchronize(streamResults);
      
      // Apply fusion strategy if requested
      if (requirements.fusion) {
        const fusionStrategy = state.fusionStrategies.get(requirements.fusion);
        if (fusionStrategy) {
          syncResults.fusion = await fusionStrategy.fuse(syncResults.streams);
        }
      }
      
      return createMultimodalResult(syncResults);
    }
    
    // Single stream - return direct result
    return Object.values(streamResults)[0];
  };

  return {
    // Inherit existing orchestrator methods
    ...baseOrchestrator,
    
    // Add multimodal capabilities
    registerStream,
    processMultimodal,
    activateStream: (streamType) => state.activeStreams.add(streamType),
    deactivateStream: (streamType) => state.activeStreams.delete(streamType),
    getActiveStreams: () => Array.from(state.activeStreams),
    registerFusionStrategy: (name, strategy) => state.fusionStrategies.set(name, strategy)
  };
};
```

### 4. Stream Synchronization (Week 4-5)

Implement temporal synchronization for multimodal data:

```javascript
// src/core/stream-sync.js
export const createStreamSynchronizer = (config = {}) => {
  const state = {
    strategy: config.strategy || 'buffer_based',
    windowSize: config.windowSize || 100, // ms
    tolerance: config.tolerance || 50, // ms
    buffers: new Map()
  };

  const synchronize = (streamResults) => {
    const timestamp = Date.now();
    const synchronized = {};
    
    switch (state.strategy) {
      case 'hardware_timestamp':
        return synchronizeByHardwareTime(streamResults);
      
      case 'software_timestamp':
        return synchronizeBySoftwareTime(streamResults);
        
      case 'buffer_based':
      default:
        return synchronizeByBuffer(streamResults, timestamp);
    }
  };

  const synchronizeByBuffer = (streamResults, targetTime) => {
    const result = { streams: {}, synchronizationQuality: 1.0 };
    
    for (const [streamType, streamResult] of Object.entries(streamResults)) {
      if (!streamResult) continue;
      
      const timeDiff = Math.abs(streamResult.timestamp - targetTime);
      if (timeDiff <= state.tolerance) {
        result.streams[streamType] = streamResult;
      } else {
        // Try to find a buffered result closer to target time
        const buffer = state.buffers.get(streamType);
        if (buffer) {
          const closestResult = buffer.getClosest(targetTime, state.tolerance);
          if (closestResult) {
            result.streams[streamType] = closestResult;
            result.synchronizationQuality *= 0.9; // Reduce quality score
          }
        }
      }
    }
    
    return result;
  };

  return {
    synchronize,
    setStrategy: (strategy) => { state.strategy = strategy; },
    getStrategy: () => state.strategy
  };
};
```

### 5. Simple API Layer (Week 6-8)

Create user-friendly APIs for common use cases:

```javascript
// src/api/simple.js
import { createMultimodalOrchestrator } from '../core/multimodal-orchestrator.js';
import { createDataStream } from '../core/streams.js';

// Simple eye tracker API
export const createEyeTracker = async (config = {}) => {
  const stream = createDataStream({
    type: 'eye',
    processors: [config.processor || 'mediapipe_iris'],
    sampleRate: config.sampleRate || 60,
    ...config
  });

  await stream.start();

  return {
    onGaze: (callback) => {
      // Set up real-time gaze callback
      return stream.onData((result) => {
        if (result.eyeTracking) {
          callback(result.eyeTracking);
        }
      });
    },
    
    stop: () => stream.stop(),
    
    calibrate: async () => {
      // Use existing calibration system
      return stream.process({ action: 'calibrate' });
    }
  };
};

// Simple speech analyzer API  
export const createSpeechAnalyzer = async (config = {}) => {
  const stream = createDataStream({
    type: 'audio',
    processors: [config.processor || 'whisper'],
    sampleRate: config.sampleRate || 16000,
    ...config
  });

  await stream.start();

  return {
    onTranscription: (callback) => {
      return stream.onData((result) => {
        if (result.transcription) {
          callback(result.transcription);
        }
      });
    },
    
    onFeatures: (callback) => {
      return stream.onData((result) => {
        if (result.features) {
          callback(result.features);
        }
      });
    },
    
    stop: () => stream.stop()
  };
};

// Multimodal processor API
export const createMultimodalProcessor = async (config) => {
  const orchestrator = createMultimodalOrchestrator(config);
  const streams = {};
  
  // Initialize requested streams
  for (const streamType of config.streams) {
    const streamConfig = config.streamConfigs?.[streamType] || {};
    streams[streamType] = createDataStream({
      type: streamType,
      ...streamConfig
    });
    
    await streams[streamType].start();
    orchestrator.registerStream(streams[streamType]);
    orchestrator.activateStream(streamType);
  }

  return {
    process: async (data) => {
      return orchestrator.processMultimodal(data, {
        fusion: config.fusion || 'temporal_fusion'
      });
    },
    
    onData: (callback) => {
      // Set up unified data callback
      return orchestrator.onData(callback);
    },
    
    stop: async () => {
      for (const stream of Object.values(streams)) {
        stream.stop();
      }
    }
  };
};
```

## Integration with Existing Code

Your current face analysis code continues to work unchanged. To add multimodal capabilities:

1. **Existing Code**: Keep using your current orchestrator for face-only analysis
2. **New Multimodal Code**: Use the multimodal orchestrator for complex scenarios
3. **Migration Path**: Gradually move to multimodal APIs as needed

## Testing Strategy

1. **Unit Tests**: Test each stream type independently
2. **Integration Tests**: Test stream synchronization with mock data
3. **Performance Tests**: Ensure real-time performance requirements are met
4. **User Acceptance Tests**: Test with actual research scenarios

## Deployment Considerations

1. **Backward Compatibility**: Existing demos and APIs continue to work
2. **Progressive Enhancement**: Add streams incrementally
3. **Configuration Management**: Use your existing config system
4. **Error Handling**: Leverage your circuit breaker pattern

This approach builds directly on your existing architecture while adding the multimodal capabilities you need for research applications.