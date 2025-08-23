# Face Analysis Engine - Pipeline Setup Guide

## Overview

The Face Analysis Engine supports multiple computer vision pipelines that can work independently or together. This guide covers setup, configuration, and usage of all available pipelines.

## Available Pipelines

### 🚀 **Ready-to-Use Pipelines**

#### 1. BlazeFace Pipeline
- **Capabilities**: Face detection, 3DOF pose estimation, basic landmarks
- **Performance**: 60 FPS, ~10-20ms latency
- **Dependencies**: Automatically loaded via CDN
- **Status**: ✅ Production ready

#### 2. Eye Tracking Pipeline  
- **Capabilities**: Pupil Labs Neon integration, gaze tracking, calibration
- **Performance**: 30 FPS, real-time streaming
- **Dependencies**: Mock devices included for testing
- **Status**: ✅ Production ready (with hardware)

### ⚙️ **Advanced Pipelines (Require Setup)**

#### 3. MediaPipe Face Mesh Pipeline
- **Capabilities**: 468 landmarks, 6DOF pose, detailed face analysis
- **Performance**: 30 FPS, ~30-50ms latency
- **Dependencies**: MediaPipe.js (auto-loaded)
- **Status**: ⚠️ Requires MediaPipe setup

#### 4. MediaPipe Iris Tracking Pipeline
- **Capabilities**: High-precision eye tracking, gaze estimation
- **Performance**: 30 FPS, ~25-40ms latency  
- **Dependencies**: MediaPipe Iris (auto-loaded)
- **Status**: ⚠️ Requires MediaPipe setup

## Quick Start

### Basic Setup (BlazeFace + Eye Tracking)

```javascript
import { createOrchestrator } from './src/core/orchestrator.js';
import { createBlazeFacePipeline } from './src/pipelines/blazeface-pipeline.js';
import { createEyeTrackingPipeline } from './src/pipelines/eye-tracking-pipeline.js';
import { Capability } from './src/core/types.js';

// Create orchestrator
const orchestrator = createOrchestrator();

// Register pipelines
await orchestrator.registerPipeline(createBlazeFacePipeline());
await orchestrator.registerPipeline(createEyeTrackingPipeline({ 
  useMockDevices: true // For testing without hardware
}));

// Process video frame
const results = await orchestrator.process(videoFrame, {
  capabilities: [Capability.FACE_DETECTION, Capability.EYE_TRACKING],
  strategy: 'performance_first'
});

console.log('Detected faces:', results.faces);
console.log('Gaze data:', results.gazeData);
```

### Advanced Setup (All Pipelines)

```javascript
import { createMediaPipeFaceMeshPipeline } from './src/pipelines/mediapipe-pipeline.js';
import { createIrisTrackingPipeline } from './src/pipelines/iris-tracking-pipeline.js';

// Create orchestrator with all pipelines
const orchestrator = createOrchestrator({
  defaultRequirements: {
    capabilities: [Capability.FACE_DETECTION],
    strategy: 'accuracy_first',
    maxLatency: 100,
    targetFPS: 30
  }
});

// Register all available pipelines
const pipelines = [
  createBlazeFacePipeline(),
  createEyeTrackingPipeline({ useMockDevices: true }),
  createMediaPipeFaceMeshPipeline({ enableIris: true }),
  createIrisTrackingPipeline()
];

for (const pipeline of pipelines) {
  try {
    await orchestrator.registerPipeline(pipeline);
    console.log(`✅ ${pipeline.name} registered`);
  } catch (error) {
    console.warn(`⚠️ ${pipeline.name} failed: ${error.message}`);
  }
}

// Process with automatic pipeline selection
const results = await orchestrator.process(videoFrame, {
  capabilities: [
    Capability.FACE_DETECTION,
    Capability.POSE_ESTIMATION_6DOF,
    Capability.EYE_TRACKING,
    Capability.LANDMARK_DETECTION
  ],
  strategy: 'hybrid' // Use fast detection + accurate analysis
});
```

## Dependency Management

The Face Analysis Engine automatically loads required dependencies. Here's what happens:

### Automatic Dependency Loading

```javascript
// Dependencies are loaded automatically when pipelines initialize
const blazeFace = createBlazeFacePipeline();
await blazeFace.initialize(); // Loads TensorFlow.js + BlazeFace model

const mediaPipe = createMediaPipeFaceMeshPipeline();
await mediaPipe.initialize(); // Loads MediaPipe + Face Mesh model
```

### Manual Dependency Control

```javascript
import { 
  loadDependency, 
  isDependencyAvailable, 
  checkSystemCapabilities 
} from './src/utils/dependency-loader.js';

// Check what's available
const capabilities = checkSystemCapabilities();
console.log('Available:', capabilities);

// Pre-load specific dependencies
if (!isDependencyAvailable('tensorflow')) {
  await loadDependency('tensorflow');
}

// Load MediaPipe manually
await loadDependency('mediapipeFaceMesh');
await loadDependency('mediapipeIris');
```

### CDN Dependencies (Automatically Loaded)

The engine loads these from CDN when needed:

```javascript
// TensorFlow.js ecosystem
'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js'
'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js'

// MediaPipe ecosystem  
'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js'
'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js'
'https://cdn.jsdelivr.net/npm/@mediapipe/iris@0.1.1633559619/iris.js'
```

## Pipeline Configuration

### BlazeFace Configuration

```javascript
const blazeFace = createBlazeFacePipeline({
  maxFaces: 10,           // Maximum faces to detect
  iouThreshold: 0.3,      // Intersection over Union threshold
  scoreThreshold: 0.75,   // Confidence threshold
  returnTensors: false    // Return raw tensors or not
});
```

### MediaPipe Face Mesh Configuration

```javascript
const faceMesh = createMediaPipeFaceMeshPipeline({
  maxNumFaces: 1,                    // Number of faces to track
  refineLandmarks: true,             // High-quality landmarks
  minDetectionConfidence: 0.5,       // Detection threshold
  minTrackingConfidence: 0.5,        // Tracking threshold
  enableIris: true,                  // Enable iris tracking
  selfieMode: false                  // Mirror image
});
```

### Eye Tracking Configuration

```javascript
const eyeTracking = createEyeTrackingPipeline({
  useMockDevices: true,      // Use mock data for testing
  autoConnect: true,         // Auto-connect to first device
  autoCalibrate: true,       // Auto-start calibration
  enableSynchronization: true // Sync with other pipelines
});
```

### Iris Tracking Configuration

```javascript
const irisTracking = createIrisTrackingPipeline({
  maxNumFaces: 1,                  // Single face for best performance
  minDetectionConfidence: 0.5,     // Detection threshold
  enableGazeEstimation: true,      // Enable gaze vector calculation
  smoothingFactor: 0.7             // Smoothing for gaze data
});
```

## Processing Strategies

### Performance First
```javascript
const results = await orchestrator.process(frame, {
  capabilities: [Capability.FACE_DETECTION],
  strategy: 'performance_first' // Choose fastest pipeline
});
```

### Accuracy First
```javascript
const results = await orchestrator.process(frame, {
  capabilities: [Capability.FACE_DETECTION, Capability.LANDMARK_DETECTION],
  strategy: 'accuracy_first' // Choose most accurate pipeline
});
```

### Hybrid Strategy
```javascript
const results = await orchestrator.process(frame, {
  capabilities: [Capability.FACE_DETECTION, Capability.EYE_TRACKING],
  strategy: 'hybrid' // Fast detection + detailed analysis
});
```

## Error Handling and Fallbacks

### Graceful Degradation
```javascript
try {
  // Try to use advanced pipeline
  const results = await orchestrator.process(frame, {
    capabilities: [Capability.POSE_ESTIMATION_6DOF],
    strategy: 'accuracy_first'
  });
} catch (error) {
  // Automatically falls back to simpler pipeline
  console.warn('Advanced pipeline failed, using fallback');
  const fallbackResults = await orchestrator.processWithFallback(frame, {
    capabilities: [Capability.FACE_DETECTION],
    strategy: 'performance_first'
  });
}
```

### Circuit Breaker Pattern
```javascript
// Automatic circuit breaker prevents cascade failures
const orchestrator = createOrchestrator({
  circuitBreakerConfig: {
    failureThreshold: 5,    // Open after 5 failures
    timeoutMs: 30000       // 30 second cooldown
  }
});

// Monitor circuit breaker status
const breakerState = orchestrator.getCircuitBreakerState();
console.log('Circuit breaker status:', breakerState);
```

## Production Deployment

### HTML Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Face Analysis Engine</title>
</head>
<body>
  <video id="video" autoplay muted></video>
  <canvas id="canvas"></canvas>
  
  <script type="module">
    import { createOrchestrator } from './src/core/orchestrator.js';
    import { createBlazeFacePipeline } from './src/pipelines/blazeface-pipeline.js';
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    
    // Setup camera
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    
    // Setup face analysis
    const orchestrator = createOrchestrator();
    await orchestrator.registerPipeline(createBlazeFacePipeline());
    
    // Process frames
    const processFrame = async () => {
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0);
      
      const results = await orchestrator.process(canvas, {
        capabilities: ['face_detection']
      });
      
      // Draw results
      results.faces?.forEach(face => {
        const [x, y, w, h] = face.bbox;
        context.strokeRect(x, y, w, h);
      });
      
      requestAnimationFrame(processFrame);
    };
    
    video.onloadedmetadata = () => processFrame();
  </script>
</body>
</html>
```

### Node.js Integration (Limited)

```javascript
// Note: MediaPipe and camera access not available in Node.js
import { createBlazeFacePipeline } from './src/pipelines/blazeface-pipeline.js';

// Only works with pre-loaded image data
const pipeline = createBlazeFacePipeline();

// Mock browser environment for TensorFlow.js
global.window = { tf: require('@tensorflow/tfjs-node') };

await pipeline.initialize();
const results = await pipeline.process(imageData);
```

## Performance Optimization

### Memory Management
```javascript
// Proper cleanup prevents memory leaks
await orchestrator.cleanup(); // Cleanup all pipelines
await pipeline.cleanup();     // Cleanup individual pipeline
```

### Performance Monitoring
```javascript
// Built-in performance tracking
const metrics = orchestrator.getMetrics();
console.log('Average latency:', metrics.averageLatency);
console.log('Processed frames:', metrics.processedFrames);
console.log('Success rate:', metrics.successRate);

// Health monitoring
const health = orchestrator.getHealthStatus();
console.log('System health:', health.status);
```

### Optimization Tips

1. **Pipeline Selection**: Use BlazeFace for real-time applications
2. **Batch Processing**: Process multiple frames together when possible
3. **Resource Cleanup**: Always call `cleanup()` when done
4. **Error Handling**: Use circuit breakers for production systems
5. **Dependency Loading**: Pre-load dependencies during app initialization

## Browser Compatibility

| Browser | BlazeFace | Eye Tracking | MediaPipe | Notes |
|---------|-----------|--------------|-----------|-------|
| Chrome 56+ | ✅ Full | ✅ Full | ✅ Full | Best performance |
| Firefox 51+ | ✅ Full | ✅ Full | ✅ Full | Good performance |
| Safari 15+ | ✅ Full | ✅ Full | ⚠️ Limited | MediaPipe issues |
| Edge 79+ | ✅ Full | ✅ Full | ✅ Full | Good performance |

## Troubleshooting

### Common Issues

**"MediaPipe not available"**
```javascript
// Check if dependencies loaded
import { checkSystemCapabilities } from './src/utils/dependency-loader.js';
console.log(checkSystemCapabilities());
```

**"Eye tracker not found"**
```javascript
// Use mock devices for testing
const eyeTracking = createEyeTrackingPipeline({ 
  useMockDevices: true 
});
```

**"Circuit breaker open"**
```javascript
// Reset circuit breaker
orchestrator.resetCircuitBreaker('pipeline-name');
```

**Performance Issues**
```javascript
// Use performance strategy
const results = await orchestrator.process(frame, {
  strategy: 'performance_first',
  maxLatency: 16.67 // 60 FPS target
});
```

## Examples

### Real-time Face Tracking
```javascript
import { createBlazeFacePipeline } from './src/pipelines/blazeface-pipeline.js';

const pipeline = createBlazeFacePipeline();
await pipeline.initialize();

const processVideo = async (videoElement) => {
  const results = await pipeline.process(videoElement);
  
  results.faces.forEach(face => {
    console.log('Face detected:', {
      bbox: face.bbox,
      pose: face.pose,
      confidence: face.confidence
    });
  });
  
  requestAnimationFrame(() => processVideo(videoElement));
};
```

### Multi-Modal Analysis
```javascript
import { createOrchestrator } from './src/core/orchestrator.js';

const orchestrator = createOrchestrator();
await orchestrator.registerPipeline(createBlazeFacePipeline());
await orchestrator.registerPipeline(createEyeTrackingPipeline({ useMockDevices: true }));

const results = await orchestrator.process(frame, {
  capabilities: ['face_detection', 'eye_tracking'],
  strategy: 'hybrid'
});

console.log('Combined results:', {
  faces: results.faces,
  gazeData: results.gazeData,
  processingTime: results.metadata.processingTime
});
```

## Next Steps

1. **Start Simple**: Begin with BlazeFace pipeline for face detection
2. **Add Eye Tracking**: Integrate eye tracking with mock devices
3. **Expand Capabilities**: Add MediaPipe for advanced features
4. **Optimize Performance**: Use orchestrator for multi-pipeline coordination
5. **Production Deploy**: Add error handling and monitoring

For more examples, see the `examples/` directory and integration tests.