# Tobii 5 Integration - Development Guide

This guide covers the technical implementation details, architecture decisions, and development workflows for the Tobii 5 integration.

## Architecture Deep Dive

### Design Principles

1. **Functional Programming**: All components use factory functions and composition
2. **Event-Driven**: Reactive architecture with comprehensive event handling
3. **Zero Dependencies**: Minimal runtime dependencies for reliability
4. **Cross-Platform**: Mac/Linux master with Windows bridge support
5. **Backward Compatibility**: OpenTrack protocol support for existing users

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tobii 5 Integration                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Remote    │  │   Device    │  │  Discovery  │             │
│  │   Client    │  │ Factory     │  │  Service    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Cognitive   │  │Distribution │  │    Bridge   │             │
│  │Integration  │  │Integration  │  │   Server    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                Synopticon Eye Tracking System                  │
│          (Device Manager, Streaming, Recording, etc.)          │
└─────────────────────────────────────────────────────────────────┘
```

## Remote Client Implementation

### WebSocket Communication Protocol

The remote client uses a custom WebSocket protocol for communication with the bridge server:

#### Message Types

```javascript
const MESSAGE_TYPES = {
  DATA: 'tobii-data',           // Real-time tracking data
  STATUS: 'tobii-status',       // Bridge/device status
  CALIBRATION: 'tobii-calibration', // Calibration events
  ERROR: 'tobii-error',         // Error notifications
  HEARTBEAT: 'tobii-heartbeat'  // Connection health
};
```

#### Data Flow

```
Bridge Server → Remote Client → Device Factory → Eye Tracking System
     ↓               ↓              ↓                    ↓
   TGI API        WebSocket      Transform         Distribution
   60Hz data      Protocol       to Synopticon     Multi-protocol
```

### Connection Management

The remote client implements robust connection management:

```javascript
// Exponential backoff reconnection
const reconnectWithBackoff = (attempt) => {
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
  setTimeout(() => connect(), delay);
};

// Heartbeat monitoring
const heartbeatInterval = setInterval(() => {
  if (Date.now() - lastHeartbeat > heartbeatTimeout) {
    handleConnectionLoss();
  }
}, heartbeatTimeout / 2);
```

### Data Quality Assurance

Real-time data quality monitoring ensures reliable tracking:

```javascript
const calculateDataQuality = (data) => {
  let quality = 0;
  let factors = 0;

  // Gaze confidence
  if (data.hasGaze && data.gaze) {
    quality += data.gaze.confidence || 0.8;
    factors++;
  }

  // Head tracking confidence
  if (data.hasHead && data.head) {
    quality += data.head.confidence || 0.8;
    factors++;
  }

  // Presence detection
  if (data.present) {
    quality += 0.9;
    factors++;
  }

  return factors > 0 ? quality / factors : 0;
};
```

## Device Factory Implementation

### Synopticon Interface Compliance

The device factory implements the complete Synopticon device interface:

```javascript
// Standard device interface methods
const deviceInterface = {
  // Connection lifecycle
  connect: async () => Promise<{success: boolean, error?: string}>,
  disconnect: async () => Promise<{success: boolean}>,
  
  // Device information
  getDeviceInfo: () => DeviceInfo,
  getConnectionState: () => 'connected' | 'disconnected',
  getStats: () => DeviceStats,
  
  // Streaming (for streaming controller)
  getGazeStream: () => GazeStream,
  onGazeData: (callback) => UnsubscribeFunction,
  
  // Recording (for recording controller)
  startRecording: async (id, config) => Promise<RecordingResult>,
  stopRecording: async () => Promise<RecordingResult>,
  
  // Calibration (for calibration controller)
  startCalibration: async (config) => Promise<CalibrationResult>,
  stopCalibration: async () => Promise<CalibrationResult>,
  
  // Events
  on: (event, callback) => void,
  off: (event, callback) => void,
  
  // Cleanup
  cleanup: async () => void
};
```

### Data Transformation Pipeline

Raw Tobii data is transformed to match Synopticon's expected format:

```javascript
const transformToSynopticonFormat = (tobiiData) => {
  return {
    timestamp: tobiiData.timestamp,
    
    // Gaze data with validation
    gaze: tobiiData.gaze ? {
      x: tobiiData.gaze.x,
      y: tobiiData.gaze.y,
      valid: tobiiData.gaze.valid,
      confidence: tobiiData.quality.gazeConfidence
    } : null,
    
    // Head pose data
    head: tobiiData.head ? {
      yaw: tobiiData.head.yaw,
      pitch: tobiiData.head.pitch,
      roll: tobiiData.head.roll,
      position: tobiiData.head.position,
      valid: tobiiData.head.valid,
      confidence: tobiiData.quality.headConfidence
    } : null,
    
    // Presence and quality
    presence: {
      detected: tobiiData.present,
      confidence: tobiiData.present ? 0.9 : 0.1
    },
    
    quality: {
      overall: tobiiData.quality.overallQuality,
      gaze: tobiiData.quality.gazeConfidence,
      head: tobiiData.quality.headConfidence
    },
    
    // Metadata for diagnostics
    metadata: {
      latency: tobiiData.latency,
      bridgeTimestamp: tobiiData.bridgeTimestamp,
      deviceType: 'tobii-5',
      connectionType: 'remote'
    }
  };
};
```

## Network Discovery System

### UDP Discovery Protocol

The discovery system uses UDP broadcasts for zero-configuration setup:

```javascript
// Discovery request packet
const discoveryRequest = {
  type: 'tobii-discovery-request',
  timestamp: Date.now(),
  requestId: `discovery-${Date.now()}`,
  source: 'synopticon-tobii5-discovery'
};

// Bridge response packet  
const bridgeResponse = {
  type: 'tobii-bridge-announcement',
  service: 'tobii-bridge',
  version: '1.0',
  host: getLocalIP(),
  websocket_port: 8080,
  udp_port: 4242,
  config_port: 8081,
  capabilities: ['gaze-tracking', 'head-tracking', 'presence-detection'],
  timestamp: Date.now()
};
```

### Discovery Flow

```
1. Synopticon broadcasts discovery request on UDP:8083
2. Bridge servers respond with announcement
3. Synopticon collects responses for timeout period
4. Connectivity testing validates reachable bridges
5. Device list returned to application
```

### Connectivity Testing

Each discovered bridge is tested for actual connectivity:

```javascript
const testDeviceConnectivity = async (deviceInfo) => {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${deviceInfo.host}:${deviceInfo.websocketPort}`);
    
    ws.onopen = () => {
      const latency = Date.now() - startTime;
      ws.close();
      resolve({
        success: true,
        latency,
        status: 'reachable'
      });
    };
    
    ws.onerror = () => {
      resolve({
        success: false,
        error: 'Connection failed',
        latency: null
      });
    };
    
    // Timeout after 5 seconds
    setTimeout(() => {
      ws.close();
      resolve({
        success: false,
        error: 'Connection timeout',
        latency: null
      });
    }, 5000);
  });
};
```

## Cognitive System Integration

### Pipeline Architecture

The cognitive integration registers specialized pipelines for eye tracking analysis:

#### Tactical Pipeline (<50ms)

```javascript
const tacticalGazeAnalysis = {
  name: 'gaze-analysis-tactical',
  level: 'tactical',
  maxProcessingTime: 50,
  
  process: async (data) => {
    const { currentGaze, history } = data;
    
    return {
      gazePosition: currentGaze,
      fixation: detectFixation(history),
      saccade: detectSaccade(history),
      attentionArea: calculateAttentionArea(currentGaze),
      quality: currentGaze.confidence
    };
  }
};
```

#### Operational Pipeline (<500ms)

```javascript
const operationalAttentionMonitoring = {
  name: 'attention-monitoring-operational', 
  level: 'operational',
  maxProcessingTime: 500,
  
  process: async (data) => {
    const { gazeHistory, headData, presenceData } = data;
    
    return {
      attentionState: assessAttentionState(gazeHistory),
      cognitiveLoad: calculateCognitiveLoad(gazeHistory),
      alertness: assessAlertness(gazeHistory, presenceData),
      scanPattern: analyzeScanPattern(gazeHistory),
      workloadIndicators: analyzeWorkloadIndicators(gazeHistory, headData)
    };
  }
};
```

### Fusion Engine Integration

Data flows into the fusion engine for multi-modal analysis:

```javascript
// Gaze tracking data
const gazeData = {
  category: 'behavioral',
  type: 'gaze-tracking',
  timestamp: data.timestamp,
  data: {
    position: { x: data.gaze.x, y: data.gaze.y },
    confidence: data.gaze.confidence,
    quality: data.quality.gaze,
    deviceType: 'tobii-5'
  }
};

cognitiveSystem.fusionEngine.ingestData('human', 'gaze-tracking', gazeData);
```

### Real-time Analysis Algorithms

#### Fixation Detection

```javascript
const detectFixation = (history) => {
  if (history.length < 3) return null;

  const recent = history.slice(-3);
  const dispersion = calculateDispersion(recent.map(h => h.gaze).filter(g => g && g.valid));
  
  return {
    isFixation: dispersion < 50, // pixels
    duration: recent.length * 16.7, // ~60Hz assumption
    dispersion,
    center: calculateCentroid(recent.map(h => h.gaze).filter(g => g && g.valid))
  };
};
```

#### Cognitive Load Calculation

```javascript
const calculateCognitiveLoad = (scanPattern) => {
  if (scanPattern.length < 2) return 0;

  let totalDistance = 0;
  let fixationCount = 0;
  const fixationThreshold = 50; // pixels

  for (let i = 1; i < scanPattern.length; i++) {
    const prev = scanPattern[i - 1];
    const curr = scanPattern[i];
    
    const distance = Math.sqrt(
      Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
    );
    
    totalDistance += distance;
    
    if (distance < fixationThreshold) {
      fixationCount++;
    }
  }

  // High velocity and low fixation count = high cognitive load
  const avgVelocity = totalDistance / scanPattern.length;
  const fixationRatio = fixationCount / scanPattern.length;
  
  // Normalize to 0-1 scale
  const loadScore = Math.min(1, (avgVelocity / 1000) + (1 - fixationRatio));
  
  return loadScore;
};
```

## Distribution System Integration

### Multi-Protocol Architecture

The distribution integration supports multiple protocols simultaneously:

```javascript
const distributionChannels = {
  // OpenTrack UDP compatibility
  'opentrack-udp': {
    protocol: 'UDP',
    port: 4242,
    transform: (data) => createOpenTrackPacket(data.head),
    enabled: true
  },
  
  // WebSocket full data
  'websocket-full': {
    protocol: 'WebSocket',
    format: 'json',
    transform: (data) => createFullDataPacket(data),
    enabled: true
  },
  
  // MQTT topic-based
  'mqtt-topics': {
    protocol: 'MQTT',
    topics: {
      'synopticon/tobii5/gaze': (data) => data.gaze,
      'synopticon/tobii5/head': (data) => data.head,
      'synopticon/tobii5/presence': (data) => data.presence
    },
    enabled: true
  }
};
```

### OpenTrack Protocol Compatibility

Ensures seamless migration from existing OpenTrack installations:

```javascript
const createOpenTrackPacket = (headData) => {
  // OpenTrack expects 6DOF data: yaw, pitch, roll, x, y, z
  return {
    yaw: headData.yaw || 0,
    pitch: headData.pitch || 0,
    roll: headData.roll || 0,
    x: headData.position?.x || 0,
    y: headData.position?.y || 0,
    z: headData.position?.z || 0,
    timestamp: Date.now()
  };
};
```

### Distribution Performance

Optimized for real-time distribution with minimal latency:

```javascript
const distributeGazeData = async (data) => {
  // Parallel distribution to all enabled channels
  const distributionPromises = [];
  
  if (channels.udp.enabled) {
    distributionPromises.push(distributeUDP(data));
  }
  
  if (channels.websocket.enabled) {
    distributionPromises.push(distributeWebSocket(data));
  }
  
  if (channels.mqtt.enabled) {
    distributionPromises.push(distributeMQTT(data));
  }
  
  // Don't wait for all to complete (fire-and-forget for performance)
  Promise.allSettled(distributionPromises).catch(console.error);
};
```

## C++ Bridge Server Implementation

### TGI API Integration

Direct integration with Tobii Game Integration API:

```cpp
class TobiiBridgeServer {
private:
    TobiiGameIntegration::ITobiiGameIntegrationApi* tgiApi;
    TobiiGameIntegration::IStreamsProvider* streams;
    
public:
    bool initializeTobii() {
        tgiApi = TobiiGameIntegration::GetApi("Synopticon Tobii Bridge v1.0");
        if (!tgiApi) return false;
        
        streams = tgiApi->GetStreamsProvider();
        if (!streams) return false;
        
        return true;
    }
    
    void processTobiiData() {
        // Update TGI API
        tgiApi->Update();
        
        TobiiDataPacket packet;
        packet.timestamp = getCurrentTimestamp();
        
        // Get gaze data
        TobiiGameIntegration::GazePoint gazePoint;
        if (streams->GetLatestGazePoint(gazePoint)) {
            packet.hasGaze = true;
            packet.gazeX = gazePoint.X;
            packet.gazeY = gazePoint.Y;
            packet.gazeTimestamp = gazePoint.Timestamp;
        }
        
        // Get head pose data
        TobiiGameIntegration::HeadPose headPose;
        if (streams->GetLatestHeadPose(headPose)) {
            packet.hasHead = true;
            packet.headYaw = headPose.Rotation.YawDegrees;
            packet.headPitch = headPose.Rotation.PitchDegrees;
            packet.headRoll = headPose.Rotation.RollDegrees;
            packet.headPosX = headPose.Position.X;
            packet.headPosY = headPose.Position.Y;
            packet.headPosZ = headPose.Position.Z;
        }
        
        // Get presence
        packet.present = streams->IsPresent();
        
        distributeData(packet);
    }
};
```

### WebSocket Server Implementation

High-performance WebSocket server using websocketpp:

```cpp
void setupWebSocketServer() {
    wsServer.set_access_channels(websocketpp::log::alevel::all);
    wsServer.clear_access_channels(websocketpp::log::alevel::frame_payload);
    
    wsServer.init_asio();
    wsServer.set_reuse_addr(true);
    
    // Message handler
    wsServer.set_message_handler([this](websocketpp::connection_hdl hdl, 
                                       websocketpp::server<websocketpp::config::asio>::message_ptr msg) {
        handleWebSocketMessage(hdl, msg);
    });
    
    // Connection handlers
    wsServer.set_open_handler([this](websocketpp::connection_hdl hdl) {
        std::lock_guard<std::mutex> lock(clientsMutex);
        clients[hdl] = "client_" + std::to_string(clients.size());
    });
    
    wsServer.listen(wsPort);
    wsServer.start_accept();
}
```

### Performance Optimization

The bridge is optimized for minimal latency and CPU usage:

```cpp
void mainLoop() {
    const auto targetInterval = std::chrono::milliseconds(16); // ~60Hz
    
    while (running) {
        auto start = std::chrono::high_resolution_clock::now();
        
        // Process Tobii data
        tgiApi->Update();
        processTobiiData();
        
        // Process network events
        ioContext->poll();
        
        // Maintain target frame rate
        auto elapsed = std::chrono::high_resolution_clock::now() - start;
        if (elapsed < targetInterval) {
            std::this_thread::sleep_for(targetInterval - elapsed);
        }
    }
}
```

## Testing Strategy

### Unit Testing

Each component has comprehensive unit tests:

```javascript
// Example: Remote client tests
describe('RemoteTobiiClient', () => {
  let client;
  let mockWebSocket;
  
  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    client = createRemoteTobiiClient({ host: 'test', port: 8080 });
  });
  
  test('connects to bridge server', async () => {
    const result = await client.connect();
    expect(result.success).toBe(true);
  });
  
  test('handles gaze data messages', () => {
    const callback = jest.fn();
    client.onData(callback);
    
    mockWebSocket.simulateMessage({
      type: 'tobii-data',
      data: { hasGaze: true, gaze: { x: 100, y: 200 } }
    });
    
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      gaze: expect.objectContaining({ x: 100, y: 200 })
    }));
  });
  
  test('reconnects on connection loss', async () => {
    await client.connect();
    mockWebSocket.simulateDisconnect();
    
    // Wait for reconnection attempt
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockWebSocket.connectionAttempts).toBeGreaterThan(1);
  });
});
```

### Integration Testing

Integration tests validate component interactions:

```javascript
describe('Tobii5 Integration Tests', () => {
  let eyeTrackingSystem;
  let cognitiveSystem;
  let distributionSystem;
  
  beforeEach(async () => {
    eyeTrackingSystem = createEyeTrackingAPI();
    cognitiveSystem = createCognitiveSystem();
    distributionSystem = createDistributionSystem();
    
    await eyeTrackingSystem.initialize();
  });
  
  test('end-to-end data flow', async () => {
    // Connect to mock Tobii bridge
    const mockBridge = new MockTobiiBridge();
    const device = createTobii5Device({ 
      host: mockBridge.host, 
      port: mockBridge.port 
    });
    
    await device.connect();
    
    // Setup cognitive integration
    const cognitiveIntegration = createTobii5CognitiveIntegration(device, cognitiveSystem);
    cognitiveIntegration.start();
    
    // Setup distribution
    const distributionIntegration = createTobii5DistributionIntegration(device, distributionSystem);
    distributionIntegration.start();
    
    // Simulate gaze data
    const testData = {
      gaze: { x: 960, y: 540, valid: true, confidence: 0.95 },
      head: { yaw: 0, pitch: 0, roll: 0, valid: true, confidence: 0.9 },
      present: true
    };
    
    mockBridge.sendData(testData);
    
    // Verify data flows through all systems
    await waitFor(() => {
      expect(cognitiveSystem.getState('human.gaze')).toBeDefined();
      expect(distributionSystem.getStats().packetsDistributed).toBeGreaterThan(0);
    });
  });
});
```

### End-to-End Testing

E2E tests validate the complete system with actual hardware:

```javascript
describe('Tobii5 E2E Tests', () => {
  // Requires actual Tobii hardware and bridge server
  test('real hardware integration', async () => {
    const eyeTracking = createEyeTrackingAPI();
    await eyeTracking.initialize();
    
    // Discover real Tobii bridges on network
    const devices = await eyeTracking.discoverDevices(30000);
    const tobiiDevice = devices.find(d => d.type === 'tobii-5');
    
    if (!tobiiDevice) {
      console.warn('No Tobii bridge found - skipping E2E test');
      return;
    }
    
    // Connect and verify data flow
    await eyeTracking.connectToDevice(tobiiDevice.id);
    
    const dataReceived = new Promise((resolve) => {
      eyeTracking.onGazeData((data) => {
        expect(data.gaze).toBeDefined();
        expect(data.head).toBeDefined();
        resolve();
      });
    });
    
    await dataReceived;
  });
});
```

## Build System

### Cross-Platform Build

The build system supports both development and production builds:

#### Development (Mac/Linux)

```bash
# Install dependencies
bun install

# Run unit tests
bun test src/features/eye-tracking/devices/tobii5/

# Run integration tests
bun test tests/integration/tobii5/

# Start demo server
cd examples/tobii5-demo
python -m http.server 8000
```

#### Production (Windows Bridge)

```cmd
REM Build C++ bridge server
cd src/features/eye-tracking/devices/tobii5/bridge
build.bat

REM Creates deployment package in bridge/deployment/
REM Ready for distribution to Windows PCs
```

### CMake Configuration

The bridge server uses CMake for cross-platform builds:

```cmake
# Minimum version for modern C++
cmake_minimum_required(VERSION 3.16)

# Project configuration
project(TobiiBridgeServer VERSION 1.0.0 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)

# Platform-specific settings
if(WIN32)
    # Windows-specific Tobii SDK paths
    set(TOBII_SDK_PATH "C:/Program Files/Tobii/Tobii Game Integration/SDK")
    include_directories("${TOBII_SDK_PATH}/include")
    
    # Architecture-specific libraries
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        link_directories("${TOBII_SDK_PATH}/lib/x64")
    else()
        link_directories("${TOBII_SDK_PATH}/lib/x86")
    endif()
endif()

# Dependencies
find_package(Threads REQUIRED)

# Executable
add_executable(tobii_bridge tobii-bridge-server.cpp)
target_link_libraries(tobii_bridge 
    PRIVATE 
    ${CMAKE_THREAD_LIBS_INIT}
    TobiiGameIntegration
)
```

## Deployment

### Windows Bridge Deployment

The build system creates a complete deployment package:

```
deployment/
├── tobii_bridge.exe         # Main executable (2MB)
├── TobiiGameIntegration.dll # TGI SDK (1MB, if needed)
├── config.json             # Configuration (<1KB)
├── install.bat              # Startup script (<1KB)
└── README.txt               # User documentation (<1KB)
```

**Total size: ~3MB** - easily distributed via email or USB.

### Automated Installation

The `install.bat` script provides one-click installation:

```batch
@echo off
echo Starting Tobii Bridge Server...
echo.
echo Make sure:
echo 1. Tobii Game Hub is running
echo 2. Tobii Eye Tracker 5 is connected
echo 3. Windows Firewall allows connections
echo.
pause
echo.
echo Starting bridge server on ports:
echo - WebSocket: 8080 (primary data)
echo - UDP: 4242 (OpenTrack compatibility) 
echo - Discovery: 8083 (auto-discovery)
echo.
tobii_bridge.exe
pause
```

### Network Configuration

The system is designed to work on typical corporate networks:

- **Ports Used**: 8080 (WebSocket), 4242 (UDP), 8083 (Discovery)
- **Protocols**: TCP for primary data, UDP for compatibility
- **Firewall**: Windows will prompt for firewall access
- **Security**: No authentication required for trusted networks

## Performance Monitoring

### Real-time Metrics

The system provides comprehensive performance monitoring:

```javascript
// Client-side metrics
const metrics = {
  connection: {
    latency: client.getStats().avgLatency,
    dataRate: client.getStats().dataRate,
    uptime: Date.now() - client.connectTime
  },
  
  data: {
    packetsReceived: client.getStats().packetsReceived,
    packetsLost: client.getStats().packetsLost,
    packetLossRate: client.getStats().packetsLost / client.getStats().packetsReceived
  },
  
  quality: {
    gazeQuality: latestData.quality.gaze,
    headQuality: latestData.quality.head,
    overallQuality: latestData.quality.overall
  }
};
```

### Bridge Server Metrics

The C++ bridge provides system-level metrics:

```cpp
struct BridgeMetrics {
    uint64_t packetsProcessed;
    uint64_t packetsDistributed;
    uint64_t clientCount;
    double avgProcessingTime;
    double cpuUsage;
    double memoryUsage;
    bool tobiiConnected;
};
```

### Monitoring Dashboard

The visualization demo includes a real-time monitoring dashboard showing:

- Connection status and uptime
- Data rate and latency
- Packet loss statistics  
- Data quality metrics
- Cognitive load analysis
- System resource usage

This provides immediate feedback on system performance and helps identify issues.

---

This development guide covers the essential implementation details for understanding, modifying, and extending the Tobii 5 integration. For specific API details, see the [API Reference](./api-reference.md).