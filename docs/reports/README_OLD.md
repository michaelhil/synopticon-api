# Synopticon API 👁️
## Open-Source Platform for Real-Time Multi-Modal Behavioral Analysis

[![Docker](https://img.shields.io/badge/Docker-Available-blue?logo=docker)](https://github.com/orgs/username/packages/container/synopticon-api)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Native-blue?logo=typescript)](src/)
[![Bun](https://img.shields.io/badge/Bun-Optimized-orange?logo=bun)](package.json)

**A production-ready platform for behavioral research environments with 6 specialized analysis pipelines, advanced orchestration, circuit breaker patterns, and real-time data distribution capabilities.**

**🎯 Designed for Human Factors & Behavioral Research**  
Synopticon API provides researchers with enterprise-grade tools for multi-modal behavioral analysis in complex environments like nuclear control rooms, flight decks, medical simulations, and training facilities.

## 🚀 Features

### 🆕 **Hybrid Architecture - Works Everywhere!**
- ✅ **Universal Pipelines**: All pipelines work in both browser and Node.js/Bun
- ✅ **Automatic Backend Selection**: Optimal performance based on environment
- ✅ **Graceful Fallbacks**: Server-side execution with mock/simplified models
- ✅ **Zero Configuration**: Automatically detects and adapts to runtime

### 🆕 **Distribution API - Real-Time Data Streaming**
- ✅ **User-Controlled Streaming**: No auto-start - streams only when requested via API
- ✅ **Multi-Protocol Support**: UDP, MQTT, WebSocket, HTTP, Server-Sent Events
- ✅ **Dynamic Stream Management**: Create, modify, stop streams at runtime
- ✅ **Real-Time Status Updates**: WebSocket notifications and comprehensive monitoring
- ✅ **Client Discovery**: Service discovery and client registration system
- ✅ **Stream Templates**: Pre-configured templates for research, visualization, logging
- ✅ **Advanced Features**: Recording, playback, stream sharing, filtering

### ✅ **Production-Ready Pipelines (6/6)**
- ✅ **MediaPipe Face Detection**: Lightweight real-time face detection with 468 facial landmarks
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
| **MediaPipe Face** | 60 | 15-30ms | 5MB | ✅ Optimized |
| **MediaPipe Face Mesh** | 30 | 30-50ms | 11MB | ✅ Production |
| **Neon Eye Tracking** | 30 | 5-15ms | - | ✅ Hardware Ready |
| **Iris Tracking** | 30 | 25-40ms | 3MB | ✅ Optimized |
| **Emotion Analysis** | 30 | 15-25ms | 2.5MB | ✅ CNN Accelerated |
| **Age Estimation** | 25 | 20-35ms | 1.8MB | ✅ Feature Based |

## 🛠️ **Available Pipelines**

### **Face Detection & Analysis**
- **`mediapipe-face-pipeline`**: MediaPipe Face Detection with 468 landmarks and 3DOF pose estimation
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
- **`POST /api/detect`**: Single image face detection and analysis
- **`POST /api/batch`**: Batch processing for multiple images with optimized throughput  
- **`POST /api/process`**: Process frame through configured pipeline combination

### **🆕 Distribution API - Real-Time Data Streaming**
- **`GET /api/distribution/status`**: Overall distribution system status and active streams
- **`GET /api/distribution/discovery`**: Service discovery - available streams, protocols, and capabilities
- **`POST /api/distribution/streams`**: Create new data stream (UDP, MQTT, WebSocket, HTTP)
- **`GET /api/distribution/streams`**: List all active streams
- **`GET /api/distribution/streams/:id`**: Get specific stream status and metrics
- **`PUT /api/distribution/streams/:id`**: Modify stream configuration (filters, destinations)
- **`DELETE /api/distribution/streams/:id`**: Stop and remove stream
- **`POST /api/distribution/clients`**: Register client for stream management
- **`GET /api/distribution/templates`**: Available stream configuration templates
- **`POST /api/distribution/streams/:id/record`**: Start recording stream data
- **`POST /api/distribution/streams/:id/share`**: Share stream with multiple destinations
- **`WebSocket /api/distribution/events`**: Real-time status updates and notifications

### **Configuration**
- **`POST /api/configure`**: Configure orchestrator with analysis requirements and strategy
- **`POST /api/pipelines/register`**: Register new pipeline with orchestrator for dynamic loading

## 🚀 **Quick Start**

### **Multi-Pipeline Orchestration**

```javascript
import { createOrchestrator } from './src/core/orchestrator.js';
import { createMediaPipeFacePipeline } from './src/pipelines/mediapipe-face-pipeline.js';
import { createEmotionAnalysisPipeline } from './src/pipelines/emotion-analysis-pipeline.js';
import { Capability } from './src/core/types.js';

// Create orchestrator with circuit breakers
const orchestrator = createOrchestrator({
  circuitBreakerConfig: { failureThreshold: 5, timeoutMs: 30000 }
});

// Register multiple pipelines
await orchestrator.registerPipeline(createMediaPipeFacePipeline());
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
const response = await fetch('http://localhost:3001/api/detect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    image: base64ImageData,
    capabilities: ['face_detection', 'emotion_analysis']
  })
});

const analysis = await response.json();
```

## 📡 **Distribution API - Real-Time Data Streaming**

The Distribution API enables **user-controlled, dynamic data streaming** to external systems. Stream eye tracking, face analysis, and other sensor data to MQTT brokers, UDP endpoints, WebSockets, or HTTP services with full runtime control.

### **🎯 Key Features**
- ✅ **User-Controlled**: No auto-streaming - streams only start when requested via API
- ✅ **Multi-Protocol**: UDP, MQTT, WebSocket, HTTP, Server-Sent Events
- ✅ **Dynamic Configuration**: Create, modify, and stop streams at runtime
- ✅ **Client Registration**: Track and manage connected external applications
- ✅ **Real-Time Status**: WebSocket status updates and comprehensive monitoring
- ✅ **Stream Templates**: Pre-configured templates for common scenarios
- ✅ **Recording & Playback**: Record streams for later analysis
- ✅ **Stream Sharing**: Share single stream with multiple destinations

### **🚀 Quick Start: Stream Eye Tracking to UDP**

```javascript
import { createEnhancedAPIServer } from './src/api/enhanced-server.js';

// Start server with Distribution API
const server = createEnhancedAPIServer({ port: 3000 });
await server.start();

// Create UDP stream for 3D visualization app
const response = await fetch('http://localhost:3000/api/distribution/streams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    type: 'udp',
    source: 'eye_tracking',
    destination: {
      host: '192.168.1.100',  // 3D viz computer
      port: 9999
    },
    client_id: 'unity-3d-app',
    filter: {
      sample_rate: 60,        // Downsample to 60Hz
      confidence_threshold: 0.8
    }
  })
});

const { stream_id } = await response.json();
console.log(`Stream created: ${stream_id}`);
// Now eye tracking data streams to Unity app at 60Hz!
```

### **📊 Use Case: Research Study with MQTT**

```javascript
// Start MQTT broadcasting when study begins
const studyStream = await fetch('http://localhost:3000/api/distribution/streams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    type: 'mqtt',
    source: 'eye_tracking',
    destination: {
      broker: 'mqtt://lab.university.edu:1883',
      topics: {
        gaze: 'studies/cognitive_load_2024/P001/gaze',
        events: 'studies/cognitive_load_2024/P001/events'
      }
    },
    metadata: {
      study_id: 'cognitive_load_2024',
      participant_id: 'P001'
    }
  })
});

// Stop when study ends
await fetch(`http://localhost:3000/api/distribution/streams/${stream_id}`, { 
  method: 'DELETE',
  headers: { 'X-API-Key': 'your-api-key' }
});
```

### **🔄 Real-Time Status Monitoring**

```javascript
// WebSocket connection for real-time status
const ws = new WebSocket('ws://localhost:3000/api/distribution/events');

ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  
  switch (status.type) {
    case 'connected':
      console.log('Distribution API connected:', status.overall_status);
      break;
      
    case 'stream_created':
      console.log('New stream:', status.stream);
      break;
      
    case 'eye_tracker_disconnected':
      console.log('Eye tracker lost:', status.stream_id);
      // Handle device disconnection
      break;
  }
};
```

### **🔍 Service Discovery**

```javascript
// Discover available services and capabilities
const discovery = await fetch('http://localhost:3000/api/distribution/discovery').then(r => r.json());

console.log('Available data sources:', discovery.data.capabilities);
console.log('Supported protocols:', discovery.data.available_distributors);
console.log('Active streams:', discovery.data.available_streams);
console.log('Connected clients:', discovery.data.connected_clients);

/*
Output example:
{
  "capabilities": ["eye_tracking", "face_analysis", "speech_analysis"],
  "available_distributors": ["mqtt", "udp", "websocket", "http"],
  "available_streams": [
    { "id": "stream_123", "type": "udp", "source": "eye_tracking", "status": "active" }
  ],
  "connected_clients": [
    { "id": "unity-3d-app", "name": "3D Visualization", "stream_count": 1 }
  ]
}
*/
```

### **📝 Stream Templates**

```javascript
// Use pre-configured template for common scenarios
const templates = await fetch('http://localhost:3000/api/distribution/templates').then(r => r.json());

// Research study template
const studyStream = await fetch('http://localhost:3000/api/distribution/templates/research_study/instantiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    destination: {
      broker: 'mqtt://your-lab.edu:1883'
    },
    study_id: 'my_study_2024',
    participant_id: 'P001'
  })
});

// Real-time visualization template  
const vizStream = await fetch('http://localhost:3000/api/distribution/templates/real_time_viz/instantiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    destination: {
      host: '192.168.1.100',
      port: 9999
    }
  })
});
```

### **📹 Recording & Playback**

```javascript
// Start recording stream data
const recording = await fetch(`/api/distribution/streams/${stream_id}/record`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    format: 'json',
    file_path: '/recordings/study_P001_session1.json'
  })
});

// Stop recording
await fetch(`/api/distribution/recordings/${recording.recording_id}/stop`, {
  method: 'POST',
  headers: { 'X-API-Key': 'your-api-key' }
});
```

### **🔗 Stream Sharing**

```javascript
// Share single stream with multiple destinations
const sharedStream = await fetch(`/api/distribution/streams/${stream_id}/share`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'your-api-key' },
  body: JSON.stringify({
    destination: {
      host: '192.168.1.200',  // Second visualization computer
      port: 9998
    },
    client_id: 'backup-viz-system'
  })
});

// Original stream continues to 192.168.1.100:9999
// Shared stream sends same data to 192.168.1.200:9998
```

### **📋 Available Templates**

| Template | Description | Protocols | Use Case |
|----------|-------------|-----------|----------|
| **`research_study`** | Standard research configuration | MQTT + HTTP | Academic studies, data collection |
| **`real_time_viz`** | Low-latency streaming | UDP + WebSocket | 3D visualization, gaming |
| **`data_logging`** | Comprehensive logging | HTTP + MQTT | Long-term storage, analysis |

### **🌐 Supported Protocols**

| Protocol | Latency | Reliability | Use Case |
|----------|---------|-------------|----------|
| **UDP** | < 5ms | Best Effort | Real-time visualization, gaming |
| **WebSocket** | < 10ms | Reliable | Live dashboards, monitoring |
| **MQTT** | < 50ms | Reliable | IoT systems, lab integration |
| **HTTP** | < 100ms | Reliable | Data storage, webhooks |
| **SSE** | < 20ms | Reliable | Web applications, dashboards |

### **🛡️ Security & Authentication**

All Distribution API endpoints require authentication via `X-API-Key` header:

```javascript
headers: {
  'X-API-Key': process.env.SYNOPTICON_API_KEY || 'dev-key-synopticon-2024'
}
```

Rate limiting: 100 requests per 15 minutes per IP address.

### **🔧 Integration with Eye Tracking**

The Distribution API seamlessly integrates with Synopticon's existing eye tracking capabilities:

```javascript
import { createEyeTrackingDistributor } from './examples/eye-tracking-distribution-integration.js';

// Complete integration: Eye tracker → Distribution API
const system = createEyeTrackingDistributor({
  // Eye tracker config
  deviceId: 'neon-001',
  mockMode: false,
  
  // Distribution config
  mqttBroker: 'mqtt://lab.local:1883',
  gazeTopic: 'lab/eyetracking/gaze',
  
  // Routing: where data goes
  gazeRouting: ['mqtt', 'websocket'],
  statusRouting: ['websocket']
});

await system.initialize();
await system.start();

// Eye tracking data now streams automatically to MQTT and WebSocket
```

## 🎯 **Capabilities Matrix**

| Capability | MediaPipe Face | MediaPipe Mesh | Eye Tracking | Iris | Emotion | Age |
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