# Synopticon API

**synopticon-api: an open-source platform for real-time multi-modal behavioral analysis and sensor synchronization.**

Production-ready platform for behavioral research environments with 6 specialized analysis pipelines, advanced orchestration, circuit breaker patterns, and hardware integration capabilities.

## 🚀 Features

### 🆕 **Hybrid Architecture - Works Everywhere!**
- ✅ **Universal Pipelines**: All pipelines work in both browser and Node.js/Bun
- ✅ **Automatic Backend Selection**: Optimal performance based on environment
- ✅ **Graceful Fallbacks**: Server-side execution with mock/simplified models
- ✅ **Zero Configuration**: Automatically detects and adapts to runtime

### ✅ **Production-Ready Pipelines (6/6)**
- ✅ **BlazeFace Detection**: TensorFlow.js model for fast real-time face detection and landmarks
- ✅ **MediaPipe Face Mesh**: 468 landmarks with 6DOF pose estimation and eye tracking
- ✅ **Neon Eye Tracking**: Pupil Labs hardware integration with calibration and recording capabilities
- ✅ **Iris Tracking**: MediaPipe Iris for high-precision eye tracking and gaze estimation
- ✅ **Emotion Analysis**: Custom CNN for 7-emotion classification with valence arousal analysis
- ✅ **Age Estimation**: Facial feature analysis for age estimation and gender detection

### 🏗️ **Advanced Architecture**
- ✅ **Circuit Breakers**: Automatic failure isolation and recovery
- ✅ **Dynamic Pipeline Selection**: Intelligent orchestration based on requirements
- ✅ **Real-time Monitoring**: Performance metrics and health checks
- ✅ **Graceful Degradation**: Automatic fallback strategies
- ✅ **Dependency Management**: Auto-loading of external dependencies

## 📊 **Pipeline Performance**

| Pipeline | Target FPS | Latency | Model Size | Status |
|----------|------------|---------|------------|---------|
| **BlazeFace** | 60 | 10-20ms | 1.2MB | ✅ Optimized |
| **MediaPipe Face Mesh** | 30 | 30-50ms | 11MB | ✅ Production |
| **Neon Eye Tracking** | 30 | 5-15ms | - | ✅ Hardware Ready |
| **Iris Tracking** | 30 | 25-40ms | 3MB | ✅ Optimized |
| **Emotion Analysis** | 30 | 15-25ms | 2.5MB | ✅ CNN Accelerated |
| **Age Estimation** | 25 | 20-35ms | 1.8MB | ✅ Feature Based |

## 🛠️ **Available Pipelines**

### **Face Detection & Analysis**
- **`blazeface-pipeline`**: TensorFlow.js BlazeFace model for fast real-time face detection and landmarks
- **`mediapipe-pipeline`**: MediaPipe Face Mesh with 468 landmarks and 6DOF pose estimation

### **Eye Tracking & Gaze**
- **`eye-tracking-pipeline`**: Pupil Labs Neon hardware integration with calibration and recording capabilities  
- **`iris-tracking-pipeline`**: MediaPipe Iris for high-precision eye tracking and gaze estimation

### **Facial Analysis**
- **`emotion-analysis-pipeline`**: Custom CNN for 7-emotion classification with valence arousal analysis
- **`age-estimation-pipeline`**: Facial feature analysis for age estimation and gender detection

## 🌐 **API Endpoints**

### **System Management**
- **`GET /api/health`**: System health check with pipeline status and performance metrics
- **`GET /api/config`**: Current system configuration and available capabilities
- **`GET /api/pipelines`**: List all available analysis pipelines with capabilities
- **`GET /api/strategies`**: Available processing strategies and configurations

### **Analysis Processing**  
- **`POST /api/v1/detect`**: Single image face detection and analysis
- **`POST /api/v1/batch`**: Batch processing for multiple images with optimized throughput
- **`POST /api/process`**: Process frame through configured pipeline combination

### **Configuration**
- **`POST /api/configure`**: Configure orchestrator with analysis requirements and strategy
- **`POST /api/pipelines/register`**: Register new pipeline with orchestrator for dynamic loading

## 🚀 **Quick Start**

### **Multi-Pipeline Orchestration**

```javascript
import { createOrchestrator } from './src/core/orchestrator.js';
import { createBlazeFacePipeline } from './src/pipelines/blazeface-pipeline.js';
import { createEmotionAnalysisPipeline } from './src/pipelines/emotion-analysis-pipeline.js';
import { Capability } from './src/core/types.js';

// Create orchestrator with circuit breakers
const orchestrator = createOrchestrator({
  circuitBreakerConfig: { failureThreshold: 5, timeoutMs: 30000 }
});

// Register multiple pipelines
await orchestrator.registerPipeline(createBlazeFacePipeline());
await orchestrator.registerPipeline(createEmotionAnalysisPipeline());

// Multi-modal analysis with automatic pipeline selection
const results = await orchestrator.process(videoFrame, {
  capabilities: [Capability.FACE_DETECTION, Capability.EXPRESSION_ANALYSIS],
  strategy: 'hybrid' // Balanced performance and accuracy
});

console.log('Detected faces:', results.faces);
console.log('Emotions:', results.faces.map(f => f.expression));
```

### **Single Pipeline Usage**

```javascript
import { createAgeEstimationPipeline } from './src/pipelines/age-estimation-pipeline.js';

// Use individual pipeline
const agePipeline = createAgeEstimationPipeline();
await agePipeline.initialize();

const results = await agePipeline.process(imageData);
console.log('Age estimation:', results.faces[0].age);
console.log('Gender detection:', results.faces[0].gender);
```

### **API Server Usage**

```javascript
// Start API server
import { createFaceAnalysisServer } from './src/api/server.js';
const server = await createFaceAnalysisServer({ port: 3001 });

// Use REST API
const response = await fetch('/api/v1/detect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    image: base64ImageData,
    capabilities: ['face_detection', 'emotion_analysis']
  })
});

const analysis = await response.json();
```

## 🎯 **Capabilities Matrix**

| Capability | BlazeFace | MediaPipe | Eye Tracking | Iris | Emotion | Age |
|------------|-----------|-----------|--------------|------|---------|-----|
| **Face Detection** | ✅ Fast | ✅ Accurate | ❌ | ❌ | ❌ | ❌ |
| **Landmarks** | ✅ Basic | ✅ 468pts | ❌ | ❌ | ❌ | ❌ |
| **3DOF Pose** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **6DOF Pose** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Eye Tracking** | ❌ | ✅ Basic | ✅ Hardware | ✅ Precision | ❌ | ❌ |
| **Gaze Estimation** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Emotion Analysis** | ❌ | ❌ | ❌ | ❌ | ✅ 7 emotions | ❌ |
| **Age Estimation** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Gender Detection** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Device Control** | ❌ | ❌ | ✅ Neon | ❌ | ❌ | ❌ |

## 🌐 **Cross-Platform Support**

### **Browser Compatibility**
| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebGL2 | 56+ | 51+ | 15+ | 79+ |
| WebGL1 Fallback | ✅ | ✅ | ✅ | ✅ |
| Camera Access | ✅ | ✅ | ✅ | ✅ |
| MediaPipe | ✅ Full | ✅ Full | ⚠️ Limited | ✅ Full |
| Hardware Eye Tracking | ✅ | ✅ | ✅ | ✅ |

### **Runtime Support (NEW: Hybrid Architecture)**
| Runtime | Face Detection | Emotion | Eye Tracking | Notes |
|---------|---------------|----------|--------------|-------|
| **Browser** | ✅ Full WebGL | ✅ CNN | ✅ MediaPipe | Optimal performance |
| **Node.js** | ✅ TF.js CPU | ✅ Fallback | ✅ Mock/Hardware | Server-side compatible |
| **Bun** | ✅ TF.js CPU | ✅ Fallback | ✅ Mock/Hardware | Preferred runtime |
| **Deno** | ⚠️ Partial | ⚠️ Partial | ⚠️ Limited | Experimental |

## Development

### Setup

```bash
cd synopticon-api
bun install  # or npm install
```

### Run Demo

```bash
bun run dev
# Open http://localhost:3000/examples/basic-demo.html
```

### Build

```bash
bun run build
```

### Testing

```bash
# Unit tests
bun test

# Performance benchmarks
bun run test:performance
```

## Architecture

### Core Components

- **WebGL Engine**: Context management, shader compilation, resource pooling
- **Pipeline System**: Efficient multi-stage GPU processing
- **Face Detection**: Custom Haar cascade with integral images
- **Landmark Detection**: Template matching with sub-pixel accuracy

### Performance Optimizations

- **GPU-First Design**: All processing on GPU via WebGL shaders
- **Buffer Pooling**: Efficient memory management
- **Single-Pass Rendering**: Minimized GPU state changes
- **Optimized Shaders**: Hand-tuned GLSL for maximum performance

## Bundle Size

- **Total Size**: <200KB (vs 3-15MB for existing solutions)
- **Zero Runtime Dependencies**: No external libraries
- **Tree Shakeable**: Import only needed components

## API Reference

### FaceAnalysisEngine

```javascript
const engine = new FaceAnalysisEngine(canvas);

// Initialize with options
await engine.initialize({
    camera: true,
    cameraConstraints: {
        video: { width: 640, height: 480 }
    }
});

// Start/stop processing
engine.startProcessing(options);
engine.stopProcessing();

// Single operations
const faces = await engine.detectFaces(imageData);
const landmarks = await engine.detectLandmarks(imageData, faceRegion);

// Utilities
const stats = engine.getStats();
const features = engine.getAvailableFeatures();
```

### Detection Results

```javascript
// Face detection result
{
    x: 100,           // Bounding box x
    y: 50,            // Bounding box y  
    width: 120,       // Bounding box width
    height: 150,      // Bounding box height
    confidence: 0.95, // Detection confidence
    scale: 1.0,       // Detection scale
    landmarks: [...] // 68 facial landmarks
}

// Landmark result
{
    x: 125,              // Pixel x coordinate
    y: 75,               // Pixel y coordinate  
    confidence: 0.85,    // Landmark confidence
    templateIndex: 36    // Landmark type (0-67)
}
```

## License

MIT License

## Contributing

1. Fork the repository
2. Create feature branch
3. Run tests: `bun test`
4. Submit pull request

## Performance Notes

### Desktop/Laptop Optimization

This engine is specifically optimized for desktop and laptop hardware:

- **Primary Target**: Discrete and integrated GPUs on Windows/macOS/Linux
- **WebGL2 Preferred**: Full feature set with compute-like shaders
- **High Memory Bandwidth**: Optimized for desktop GPU memory
- **Multi-core CPU**: Parallel processing where beneficial

### Mobile Considerations

While desktop/laptop is the primary target, mobile fallbacks are provided:

- **WebGL1 Fallback**: Reduced feature set for older devices
- **Performance Scaling**: Automatic quality adjustment
- **Memory Limits**: Optimized texture sizes for mobile GPUs