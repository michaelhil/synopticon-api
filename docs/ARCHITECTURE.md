# Synopticon API Architecture

## Overview

Synopticon API is a high-performance, multi-modal behavioral analysis platform built with modern TypeScript and Bun.js runtime. The architecture follows functional programming principles with zero external runtime dependencies for maximum performance and minimal footprint.

## Core Principles

### 1. Functional Programming First
- **Factory Functions**: Object creation through factory patterns instead of classes
- **Pure Functions**: Immutable data structures and side-effect isolation
- **Composition over Inheritance**: Function composition for behavior extension
- **Zero Dependencies**: Minimal external runtime dependencies (only 3 total)

### 2. Bun-Native Architecture
- **Bun.serve**: Native HTTP server (17x faster than Node.js)
- **Built-in WebSockets**: No external WebSocket libraries
- **Native APIs**: Direct filesystem, crypto, and networking access
- **Instant Startup**: Sub-second cold start times

### 3. Modular Design
- **Lazy Loading**: Components loaded on-demand
- **Plugin System**: Extensible pipeline architecture
- **Micro-services**: Independent feature modules
- **Unified Configuration**: Central configuration management

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
│              (Bun.serve + Middleware)                   │
└─────┬───────────────────────────────────────────┬───────┘
      │                                           │
┌─────▼─────┐                               ┌─────▼─────┐
│   HTTP    │                               │ WebSocket │
│   Routes  │                               │  Manager  │
└─────┬─────┘                               └─────┬─────┘
      │                                           │
┌─────▼──────────────────────────────────────────▼─────┐
│              Orchestration Layer                     │
│        (Unified Orchestrator + State Manager)        │
└─────┬──────────────┬──────────────┬─────────────┬────┘
      │              │              │             │
┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐ ┌────▼────┐
│   Face    │  │    Eye    │  │  Speech   │ │Cognitive│
│ Detection │  │ Tracking  │  │ Analysis  │ │Advisory │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘ └────┬────┘
      │              │              │            │
┌─────▼──────────────▼──────────────▼────────────▼────┐
│              Distribution System                     │
│       (WebSocket, UDP, MQTT, SSE, HTTP)            │
└──────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Layer (`src/core/api/`)

#### Server (`server.ts`)
- **Bun.serve Integration**: Native HTTP server with middleware pipeline
- **Route Registry**: Modular route system with dependency injection
- **WebSocket Upgrade**: Automatic WebSocket connection handling
- **Static File Serving**: Built-in static asset serving

```typescript
// Factory pattern for server creation
export const createFaceAnalysisServer = (config) => {
  const orchestrator = createUnifiedOrchestrator(config);
  const middlewareSystem = createMiddlewareSystem(config);
  const router = createRouter();
  
  return { start, stop, server };
};
```

#### Middleware System (`middleware/`)
- **CORS Handler**: Cross-origin resource sharing with configurable policies
- **Rate Limiting**: Adaptive rate limiting with sliding window algorithm
- **Error Handler**: Centralized error processing and logging
- **Request Processing**: Pipeline-based request transformation

#### Routes (`routes/`)
- **Modular Routing**: Independent route modules with dependency injection
- **Type Safety**: Full TypeScript integration with request/response types
- **Lazy Loading**: Routes loaded on-demand for optimal performance

### 2. Orchestration Layer (`src/core/orchestration/`)

#### Unified Orchestrator (`unified-orchestrator.ts`)
```typescript
export const createUnifiedOrchestrator = (config) => ({
  registerPipeline: (pipeline) => { /* Register analysis pipeline */ },
  processFrame: (frame, requirements) => { /* Multi-modal processing */ },
  getSystemStatus: () => { /* System health and metrics */ },
  cleanup: () => { /* Resource cleanup */ }
});
```

**Features:**
- **Pipeline Registration**: Dynamic pipeline management
- **Multi-modal Processing**: Coordinated analysis across modalities
- **Resource Management**: Memory and CPU optimization
- **Performance Monitoring**: Real-time metrics and alerts

#### Plugin System (`plugin-loader.ts`)
```typescript
export const createPluginLoader = () => ({
  loadPlugin: (path, config) => { /* Dynamic plugin loading */ },
  unloadPlugin: (path) => { /* Plugin cleanup */ },
  getLoadedPlugins: () => { /* Plugin registry */ }
});
```

### 3. Feature Modules (`src/features/`)

#### Face Detection (`face-detection/`)
**Architecture:**
- **MediaPipe Integration**: Lightweight face detection (5MB vs 635MB TensorFlow.js)
- **WebGL Acceleration**: Hardware-accelerated processing
- **Memory Pooling**: Efficient buffer management
- **Real-time Processing**: 30+ FPS on commodity hardware

**Key Components:**
```typescript
// Factory-based pipeline creation
export const createMediaPipeFacePipeline = (config) => ({
  detect: (imageData) => { /* Face detection logic */ },
  extractLandmarks: (faces) => { /* Landmark extraction */ },
  calculatePose: (landmarks) => { /* Head pose estimation */ }
});
```

#### Emotion Analysis (`emotion-analysis/`)
**Architecture:**
- **CNN-based Models**: Lightweight emotion recognition
- **Valence-Arousal Mapping**: Dimensional emotion representation
- **Temporal Smoothing**: Confidence-based emotion smoothing
- **Multi-face Support**: Simultaneous emotion analysis for multiple faces

#### Eye Tracking (`eye-tracking/`)
**Revolutionary Tobii 5 Integration:**
- **Cross-platform Architecture**: Windows bridge + Mac/Linux master
- **5-10ms Latency**: Superior performance vs OpenTrack (20-50ms)
- **Auto-discovery**: Zero-config network setup
- **Cognitive Analysis**: Real-time attention and cognitive load assessment

```typescript
// Device factory pattern
export const createTobii5Device = (config) => ({
  connect: () => { /* Device connection */ },
  calibrate: (points) => { /* Calibration procedure */ },
  startTracking: () => { /* Gaze tracking */ },
  getGazeData: () => { /* Real-time gaze data */ }
});
```

#### Speech Analysis (`speech-analysis/`)
**Comprehensive Audio Processing:**
- **Multi-engine Support**: Web Speech API, custom ASR
- **Emotion Detection**: Speech-based emotion analysis
- **Quality Assessment**: Audio quality metrics
- **Pace Analysis**: Speaking rate and fluency analysis
- **Voice Activity Detection**: Intelligent speech segmentation

#### Cognitive Advisory (`src/core/cognitive/`)
**AI-Powered Decision Support:**
- **Multi-modal Fusion**: Integration of all sensor data
- **Temporal Context**: Historical pattern analysis
- **Predictive Analytics**: Future state prediction
- **Explainable AI**: Transparent decision reasoning

### 4. Distribution System (`src/core/distribution/`)

#### Universal Distributor
```typescript
export const createUniversalDistributor = (config) => ({
  distribute: (data, targets) => { /* Multi-protocol distribution */ },
  addAdapter: (adapter) => { /* Protocol adapter registration */ },
  getMetrics: () => { /* Distribution statistics */ }
});
```

**Supported Protocols:**
- **WebSocket**: Real-time bidirectional communication
- **UDP**: High-frequency data streaming (OpenTrack compatible)
- **MQTT**: IoT device integration
- **Server-Sent Events (SSE)**: Browser-based streaming
- **HTTP**: REST API integration

### 5. Configuration System (`src/core/configuration/`)

#### Unified Configuration Manager
```typescript
export const createUnifiedConfigManager = (config) => ({
  get: (key) => { /* Configuration retrieval */ },
  set: (key, value) => { /* Configuration update */ },
  getServerConfig: () => { /* Server-specific config */ },
  getFeaturesConfig: () => { /* Feature-specific config */ },
  validate: (schema) => { /* Configuration validation */ }
});
```

**Features:**
- **Type-safe Configuration**: Full TypeScript integration
- **Environment-aware**: Development, staging, production configs
- **Hot Reloading**: Runtime configuration updates
- **Validation**: Schema-based configuration validation

## Performance Architecture

### Memory Management

#### Resource Pooling
```typescript
export const createResourcePool = (type, config) => ({
  acquire: () => { /* Get resource from pool */ },
  release: (resource) => { /* Return resource to pool */ },
  cleanup: () => { /* Pool cleanup */ },
  getMetrics: () => { /* Pool statistics */ }
});
```

**Pool Types:**
- **Canvas Pool**: Reusable canvas elements
- **Buffer Pool**: Memory buffers for image processing
- **WebGL Pool**: WebGL contexts and shaders

#### Memory Optimization
```typescript
export const createMemoryOptimizer = (config) => ({
  startMonitoring: () => { /* Memory pressure monitoring */ },
  optimizeIfNeeded: () => { /* Adaptive optimization */ },
  cleanup: () => { /* Force cleanup */ }
});
```

### Lazy Loading System

#### Component Loading
```typescript
export const createLazyLoader = (componentMap) => ({
  load: (component) => { /* Dynamic import */ },
  preload: (components) => { /* Preload optimization */ },
  unload: (component) => { /* Component cleanup */ }
});
```

**Benefits:**
- **Reduced Bundle Size**: Only load required components
- **Faster Startup**: Minimal initial load
- **Memory Efficiency**: Release unused components

## Data Flow Architecture

### Request Processing Pipeline

```
HTTP Request → Middleware → Route Handler → Orchestrator → Feature Pipeline → Response
     ↓              ↓            ↓             ↓              ↓            ↑
  Auth Check → Rate Limit → Validation → Processing → Analysis → Formatting
```

### Real-time Data Flow

```
Sensor Data → Feature Module → Orchestrator → Distribution → Client
     ↓             ↓             ↓              ↓            ↑
   Camera → Face Detection → Data Fusion → WebSocket → Browser
   Mic    → Speech Analysis → Correlation → UDP      → OpenTrack
   Eye    → Gaze Tracking  → Cognitive   → MQTT     → IoT Device
```

## Security Architecture

### Input Validation
- **Schema Validation**: Zod-based input validation
- **File Type Checking**: Image and audio format validation
- **Size Limits**: Configurable upload size restrictions
- **Sanitization**: Input sanitization and normalization

### Rate Limiting
```typescript
export const createRateLimiter = (config) => ({
  check: (key) => { /* Check rate limit */ },
  consume: (key, tokens) => { /* Consume tokens */ },
  reset: (key) => { /* Reset counter */ }
});
```

### CORS Policy
- **Origin Validation**: Configurable allowed origins
- **Method Restrictions**: HTTP method limitations
- **Header Control**: Allowed request headers
- **Credential Handling**: Secure credential transmission

## Integration Architecture

### Simulator Integration (`src/integrations/simulators/`)
- **MSFS (Microsoft Flight Simulator)**: SimConnect protocol
- **X-Plane**: UDP data exchange
- **BeamNG.drive**: Lua scripting integration
- **VATSIM**: Network integration for ATC simulation

### Model Context Protocol (MCP)
- **LLM Integration**: Claude Desktop integration
- **Tool System**: Exposed API functions as MCP tools
- **Bidirectional Communication**: LLM can query and control system

### WebRTC Support
- **Peer-to-Peer**: Direct browser-to-browser communication
- **Media Streaming**: Real-time video/audio transmission
- **Data Channels**: High-performance data exchange

## Deployment Architecture

### Development
```bash
bun install          # Zero-dependency install
bun dev             # Hot reloading server
bun test            # Full test suite
```

### Production
```bash
bun run build      # TypeScript compilation + optimization
bun serve          # Production server
```

### Docker
```dockerfile
FROM oven/bun:latest
COPY . .
RUN bun install --production
EXPOSE 3000
CMD ["bun", "serve"]
```

## Monitoring and Observability

### Metrics Collection
```typescript
export const createMetricsCollector = () => ({
  recordLatency: (operation, duration) => { /* Latency tracking */ },
  incrementCounter: (metric) => { /* Counter metrics */ },
  recordGauge: (metric, value) => { /* Gauge metrics */ },
  getMetrics: () => { /* Prometheus format */ }
});
```

### Health Checks
- **Component Health**: Individual feature module status
- **Resource Health**: Memory, CPU, disk usage
- **Dependency Health**: External service connectivity
- **Performance Health**: Latency and throughput metrics

### Logging
```typescript
export const createLogger = (config) => ({
  debug: (message, meta) => { /* Debug logging */ },
  info: (message, meta) => { /* Info logging */ },
  warn: (message, meta) => { /* Warning logging */ },
  error: (error, meta) => { /* Error logging */ }
});
```

## Scaling Architecture

### Horizontal Scaling
- **Stateless Design**: No server-side session state
- **Load Balancing**: Standard HTTP load balancer support
- **WebSocket Clustering**: Session affinity support

### Vertical Scaling
- **Multi-threading**: Bun's built-in worker threads
- **Resource Pooling**: Efficient resource utilization
- **Caching**: In-memory caching for frequently accessed data

### Edge Deployment
- **CDN Integration**: Static asset distribution
- **Edge Functions**: Computation closer to users
- **Geographic Distribution**: Multiple deployment regions

## Future Architecture Considerations

### Planned Enhancements
- **Microservice Decomposition**: Breaking into smaller services
- **Event-driven Architecture**: Async message passing
- **Machine Learning Pipeline**: Custom ML model training
- **Blockchain Integration**: Decentralized data verification

### Technology Roadmap
- **WebAssembly**: High-performance computing modules
- **GraphQL**: Flexible API query language
- **gRPC**: High-performance RPC communication
- **Kubernetes**: Container orchestration

This architecture provides a robust, scalable foundation for multi-modal behavioral analysis with excellent performance characteristics and modern development practices.