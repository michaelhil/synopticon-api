# Tobii 5 Comprehensive Integration Plan
## Full Synopticon Architecture Integration

After analyzing the complete Synopticon architecture, here's the updated comprehensive plan that ensures seamless integration with all existing systems.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                Mac (Synopticon Master)                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────────────┐ │
│  │  Eye Tracking   │  │  Cognitive       │  │         Distribution               │ │
│  │     System      │  │   System         │  │          System                    │ │
│  │                 │  │                  │  │                                    │ │
│  │ ┌─────────────┐ │  │ ┌──────────────┐ │  │ ┌─────────────────────────────────┐ │ │
│  │ │Device Mgr   │ │  │ │Fusion Engine │ │  │ │    Multi-Protocol              │ │ │
│  │ │Streaming    │◄├──┤ │State Manager │◄├──┤ │    Distribution                │ │ │
│  │ │Recording    │ │  │ │Pipeline Sys  │ │  │ │    • WebSocket                 │ │ │
│  │ │Calibration  │ │  │ │Context Orch  │ │  │ │    • UDP (OpenTrack compat)    │ │ │
│  │ └─────────────┘ │  │ └──────────────┘ │  │ │    • MQTT                      │ │ │
│  └─────────────────┘  └──────────────────┘  │ │    • SSE                       │ │ │
│                                             │ └─────────────────────────────────┘ │ │
│                    ↕                        └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │                    Remote Tobii Client                                         │ │
│  │         (Network connection to Windows Tobii Bridge)                          │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          ↕ TCP/WebSocket
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Windows PC (Lightweight Tobii Bridge)                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │                    Tobii Bridge Server (C++)                                   │ │
│  │                                                                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  TGI Interface  │  │              Network Interface                     │  │ │
│  │  │                 │  │                                                     │  │ │
│  │  │ ┌─────────────┐ │  │ ┌─────────────────────────────────────────────────┐ │  │ │
│  │  │ │Gaze Data    │ │  │ │  • WebSocket Server (primary)                 │ │  │ │
│  │  │ │Head Pose    │ ├──┤ │  • UDP Server (OpenTrack protocol compat)     │ │  │ │
│  │  │ │Presence     │ │  │ │  • Auto-discovery beacon                      │ │  │ │
│  │  │ │Calibration  │ │  │ └─────────────────────────────────────────────────┘ │  │ │
│  │  │ └─────────────┘ │  └─────────────────────────────────────────────────────┐ │  │
│  │  └─────────────────┘                                                        │ │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │                    Tobii Game Integration API                                  │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Tobii Eye Tracker 5                                    │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 1. Synopticon Integration Points

### A. Eye Tracking System Integration

**Existing Architecture Preserved:**
- Uses existing `createEyeTrackingAPI()` factory pattern
- Integrates with existing device manager, streaming controller, recording controller
- Supports all existing features: calibration sessions, recording sessions, event notifications

**New Device Implementation:**
```javascript
// src/features/eye-tracking/devices/tobii5/device.js
export const createTobii5Device = (config = {}) => {
  const { connectionType = 'remote', host, port = 8080 } = config;
  
  // Remote connection to Windows bridge
  const remoteClient = createRemoteTobiiClient({ host, port });
  
  const state = {
    connected: false,
    calibrationData: null,
    recordingSession: null
  };

  return {
    // Standard device interface (compatible with existing system)
    connect: async () => await remoteClient.connect(),
    disconnect: () => remoteClient.disconnect(),
    
    getDeviceInfo: () => ({
      type: 'tobii-5',
      name: 'Tobii Eye Tracker 5',
      capabilities: ['gaze-tracking', 'head-tracking', 'presence-detection'],
      connectionType: 'remote',
      remoteHost: host
    }),
    
    getConnectionState: () => remoteClient.getStatus().connected ? 'connected' : 'disconnected',
    getLastHeartbeat: () => remoteClient.getLastDataTimestamp(),
    
    // Streaming interface (integrates with existing streamingController)
    getGazeStream: () => createTobii5GazeStream(remoteClient),
    onGazeData: (callback) => remoteClient.onData(callback),
    
    // Recording interface (integrates with existing recordingController)
    startRecording: async (recordingId, config) => {
      state.recordingSession = { recordingId, startTime: Date.now(), config };
      remoteClient.enableRecording(true);
      return { success: true };
    },
    
    stopRecording: async () => {
      if (state.recordingSession) {
        remoteClient.enableRecording(false);
        const session = state.recordingSession;
        state.recordingSession = null;
        return { success: true, session };
      }
      return { success: false, error: 'No active recording' };
    },
    
    // Calibration interface (integrates with existing calibrationController)
    startCalibration: async (calibrationConfig) => {
      return await remoteClient.requestCalibration(calibrationConfig);
    },
    
    stopCalibration: async () => {
      return await remoteClient.stopCalibration();
    }
  };
};
```

### B. Cognitive System Integration

**Existing Pipeline Integration:**
```javascript
// Data flows through existing pipeline system automatically
// src/features/eye-tracking/cognitive-integration.js

export const integrateTobii5WithCognitive = (eyeTrackingAPI, cognitiveSystem) => {
  // Subscribe to Tobii 5 gaze data
  eyeTrackingAPI.onGazeData((gazeData) => {
    // Transform to cognitive system format
    const humanStateData = {
      category: 'behavioral',
      type: 'gaze-tracking',
      timestamp: Date.now(),
      data: {
        gazePoint: { x: gazeData.gaze.x, y: gazeData.gaze.y },
        headPose: gazeData.head,
        presence: gazeData.present,
        quality: gazeData.confidence || 1.0
      }
    };
    
    // Feed into fusion engine (existing pipeline)
    cognitiveSystem.fusionEngine.ingestData('human', 'gaze-tracking', humanStateData);
    
    // Update state manager (existing pipeline)
    cognitiveSystem.stateManager.updateState('human.gaze', humanStateData);
  });
  
  // Subscribe to head pose data
  eyeTrackingAPI.onGazeData((data) => {
    if (data.head) {
      const headPoseData = {
        category: 'behavioral',
        type: 'head-tracking',
        timestamp: Date.now(),
        data: {
          yaw: data.head.yaw,
          pitch: data.head.pitch,
          roll: data.head.roll,
          position: data.head.position
        }
      };
      
      // Process through tactical pipeline (<50ms)
      cognitiveSystem.pipelineSystem.process('head-pose-analysis', headPoseData, 'tactical');
    }
  });
};
```

**New Cognitive Pipelines (Purpose-built for Eye Tracking):**
```javascript
// src/core/cognitive/pipelines/gaze-analysis-pipeline.js
export const createGazeAnalysisPipeline = () => ({
  name: 'gaze-analysis',
  level: 'tactical', // <50ms processing
  
  process: (gazeData) => {
    return {
      attentionFocus: calculateAttentionArea(gazeData.gazePoint),
      scanPattern: analyzeScanPattern(gazeData.history),
      cognitiveLoad: estimateCognitiveLoad(gazeData.fixations),
      anomalies: detectGazeAnomalies(gazeData)
    };
  }
});

// src/core/cognitive/pipelines/attention-monitoring-pipeline.js  
export const createAttentionMonitoringPipeline = () => ({
  name: 'attention-monitoring',
  level: 'operational', // <500ms processing
  
  process: (combinedData) => {
    const { gaze, head, performance } = combinedData;
    
    return {
      attentionState: calculateAttentionState(gaze, head),
      workloadIndicators: analyzeWorkloadIndicators(gaze.scanPattern, performance),
      alertnessLevel: assessAlertnessLevel(gaze.fixations, head.stability),
      recommendations: generateAttentionRecommendations(combinedData)
    };
  }
});
```

### C. Distribution System Integration

**Multi-Protocol Distribution (Existing System Enhanced):**
```javascript
// src/features/eye-tracking/distribution/tobii-distributor.js
export const createTobii5Distributor = (distributionSystem) => {
  
  // OpenTrack UDP compatibility (existing protocol)
  const udpDistributor = {
    name: 'tobii-udp-opentrack',
    protocol: 'UDP',
    port: 4242, // Standard OpenTrack port
    
    transform: (tobiiData) => {
      // Convert Tobii gaze + head data to OpenTrack head tracking format
      return {
        yaw: tobiiData.head.yaw,
        pitch: tobiiData.head.pitch, 
        roll: tobiiData.head.roll,
        x: tobiiData.head.position?.x || 0,
        y: tobiiData.head.position?.y || 0,
        z: tobiiData.head.position?.z || 0
      };
    }
  };
  
  // WebSocket distribution (full data)
  const websocketDistributor = {
    name: 'tobii-websocket-full',
    protocol: 'WebSocket',
    
    transform: (tobiiData) => ({
      type: 'tobii-5-data',
      timestamp: Date.now(),
      gaze: tobiiData.gaze,
      head: tobiiData.head,
      presence: tobiiData.present,
      cognitive: tobiiData.cognitiveAnalysis // From pipeline processing
    })
  };
  
  // MQTT distribution (configurable topics)
  const mqttDistributor = {
    name: 'tobii-mqtt',
    protocol: 'MQTT',
    topics: {
      'synopticon/gaze/data': (data) => data.gaze,
      'synopticon/head/pose': (data) => data.head,
      'synopticon/attention/state': (data) => data.cognitive?.attentionState,
      'synopticon/cognitive/analysis': (data) => data.cognitive
    }
  };
  
  return {
    distributors: [udpDistributor, websocketDistributor, mqttDistributor],
    
    distribute: async (tobiiData) => {
      // Send via all configured protocols
      await distributionSystem.distribute('eye-tracking', {
        udp: udpDistributor.transform(tobiiData),
        websocket: websocketDistributor.transform(tobiiData),
        mqtt: mqttDistributor.topics
      });
    }
  };
};
```

## 2. Lightweight Windows Bridge Implementation

### A. Minimal Deployment Package

**Distribution Structure:**
```
tobii-bridge-v1.0/
├── tobii_bridge.exe              # 2MB - Standalone executable
├── TobiiGameIntegration.dll       # 1MB - TGI SDK
├── config.json                   # <1KB - Configuration 
├── install.bat                   # <1KB - Auto-installer
└── README.txt                    # <1KB - Instructions
```

**Total Size: ~3MB** (vs full Synopticon install ~100MB+)

### B. Advanced Bridge Architecture

```cpp
// Enhanced bridge server with multiple protocol support
class TobiiBridgeServer {
private:
    // TGI Integration
    ITobiiGameIntegrationApi* tgiApi;
    IStreamsProvider* streams;
    
    // Network interfaces
    WebSocketServer wsServer;
    UDPServer udpServer;  // OpenTrack compatibility
    HTTPServer httpServer; // Configuration interface
    
    // Data processing
    DataBuffer<GazeData> gazeBuffer;
    DataBuffer<HeadData> headBuffer;
    CalibrationManager calibrationMgr;
    
public:
    void initialize() {
        // Initialize TGI
        tgiApi = TobiiGameIntegration::GetApi("Synopticon Bridge v1.0");
        streams = tgiApi->GetStreamsProvider();
        
        // Start network services
        wsServer.start(8080);        // WebSocket (primary)
        udpServer.start(4242);       // UDP OpenTrack compat
        httpServer.start(8081);      // Configuration UI
        
        // Setup auto-discovery
        startDiscoveryBeacon();
    }
    
    // Main processing loop
    void processLoop() {
        while (running) {
            tgiApi->Update(); // Get Tobii data
            
            // Process data
            TobiiDataPacket packet = collectTobiiData();
            
            // Distribute to all connected clients
            distributeData(packet);
            
            // Maintain 60Hz rate
            Sleep(16);
        }
    }
    
    TobiiDataPacket collectTobiiData() {
        TobiiDataPacket packet;
        packet.timestamp = GetTickCount64();
        
        // Gaze data
        TobiiGameIntegration::GazePoint gaze;
        if (streams->GetLatestGazePoint(gaze)) {
            packet.gaze = { gaze.X, gaze.Y, gaze.Timestamp };
            packet.hasGaze = true;
        }
        
        // Head pose data  
        TobiiGameIntegration::HeadPose headPose;
        if (streams->GetLatestHeadPose(headPose)) {
            packet.head = {
                headPose.Rotation.YawDegrees,
                headPose.Rotation.PitchDegrees, 
                headPose.Rotation.RollDegrees,
                headPose.Position.X,
                headPose.Position.Y,
                headPose.Position.Z
            };
            packet.hasHead = true;
        }
        
        // Presence detection
        packet.present = streams->IsPresent();
        
        return packet;
    }
    
    void distributeData(const TobiiDataPacket& packet) {
        // WebSocket (full data)
        Json::Value wsMessage = createWebSocketMessage(packet);
        wsServer.broadcast(wsMessage.toStyledString());
        
        // UDP OpenTrack format (head tracking only)
        if (packet.hasHead) {
            OpenTrackPacket udpPacket = convertToOpenTrackFormat(packet.head);
            udpServer.broadcast(reinterpret_cast<char*>(&udpPacket), sizeof(udpPacket));
        }
    }
};
```

### C. Auto-Discovery & Configuration

**Network Discovery:**
```cpp
// UDP beacon for auto-discovery
void startDiscoveryBeacon() {
    std::thread([this]() {
        UDPSocket beacon;
        beacon.bind(8082);
        
        while (running) {
            Json::Value announcement;
            announcement["service"] = "tobii-bridge";
            announcement["version"] = "1.0";
            announcement["host"] = getLocalIP();
            announcement["websocket_port"] = 8080;
            announcement["udp_port"] = 4242;
            announcement["config_port"] = 8081;
            announcement["capabilities"] = Json::arrayValue;
            announcement["capabilities"].append("gaze-tracking");
            announcement["capabilities"].append("head-tracking");
            announcement["capabilities"].append("presence-detection");
            
            std::string message = announcement.toStyledString();
            beacon.broadcast(8083, message.c_str(), message.length());
            
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }
    }).detach();
}
```

**Configuration Web UI:**
```cpp
// Simple web interface for bridge configuration
void setupConfigInterface() {
    httpServer.addRoute("GET", "/", [](const Request& req) {
        return Response::html(R"(
            <!DOCTYPE html>
            <html>
            <head><title>Tobii Bridge Configuration</title></head>
            <body>
                <h1>Tobii Bridge Status</h1>
                <div id="status"></div>
                <div id="connections"></div>
                <script>
                    // Simple status dashboard
                    setInterval(() => {
                        fetch('/api/status').then(r => r.json()).then(data => {
                            document.getElementById('status').innerHTML = 
                                `<p>Tobii Connected: ${data.tobii_connected}</p>
                                 <p>Clients: ${data.client_count}</p>
                                 <p>Data Rate: ${data.data_rate} Hz</p>`;
                        });
                    }, 1000);
                </script>
            </body>
            </html>
        )");
    });
}
```

## 3. Implementation Phases & Timeline

### Phase 1: Core Integration (2-3 weeks)
**Week 1-2: Bridge Development**
- [ ] C++ bridge server with TGI integration
- [ ] WebSocket + UDP protocol support  
- [ ] Data transformation pipelines
- [ ] Auto-discovery beacon

**Week 3: Synopticon Integration**
- [ ] Remote Tobii device implementation
- [ ] Integration with existing eye-tracking system
- [ ] Basic streaming functionality

### Phase 2: Feature Completion (2 weeks)
**Week 4: Advanced Features**
- [ ] Recording session support
- [ ] Calibration integration
- [ ] Error handling & reconnection

**Week 5: Cognitive Integration** 
- [ ] Pipeline system integration
- [ ] Cognitive data processing
- [ ] Distribution system integration

### Phase 3: Distribution & Cognitive (1-2 weeks)
**Week 6: Multi-Protocol Distribution**
- [ ] OpenTrack UDP compatibility
- [ ] MQTT topic publishing
- [ ] WebSocket streaming
- [ ] SSE support

**Week 7: Cognitive Pipelines**
- [ ] Gaze analysis pipeline
- [ ] Attention monitoring pipeline  
- [ ] Fusion engine integration
- [ ] Cognitive advisory integration

### Phase 4: Testing & Deployment (1 week)
**Week 8: Integration Testing**
- [ ] Cross-platform testing
- [ ] Performance benchmarking
- [ ] End-to-end validation
- [ ] Documentation & packaging

## 4. Advantages Over OpenTrack

### Performance Improvements
- **Latency**: 5-10ms vs 20-50ms (direct TGI vs UDP bridge)
- **Data Richness**: Full gaze + head + presence vs head-only
- **Accuracy**: Native precision vs processed approximation
- **Reliability**: Direct API vs protocol conversion

### Synopticon Integration Benefits
- **Existing Features**: Full compatibility with recording, calibration, events
- **Cognitive Processing**: Automatic pipeline integration
- **Distribution**: Multi-protocol support (UDP/MQTT/WebSocket/SSE)
- **Future-Proof**: Extensible architecture for new features

### Deployment Advantages
- **Lightweight**: 3MB bridge vs full installation
- **Auto-Discovery**: Zero-config network setup
- **Compatibility**: OpenTrack UDP protocol support
- **Maintenance**: Simple executable + config file

## 5. Success Metrics & Validation

### Technical Metrics
- **Latency**: <10ms end-to-end (bridge → Synopticon → distribution)
- **Throughput**: 60Hz sustained data rate
- **Accuracy**: Pixel-level gaze precision maintained
- **Reliability**: 99.5%+ connection uptime

### Integration Metrics  
- **Compatibility**: 100% existing feature support (recording/calibration)
- **Performance**: Cognitive pipeline processing <50ms tactical, <500ms operational
- **Distribution**: Successful multi-protocol data distribution
- **Deployment**: <5 minute setup time per Windows PC

### User Experience Metrics
- **Setup Simplicity**: Copy folder → run executable → auto-discovered
- **Feature Parity**: All OpenTrack functionality + enhanced capabilities  
- **Cross-Platform**: Seamless Mac ↔ Windows operation
- **Cognitive Integration**: Real-time attention/workload analysis

This comprehensive plan ensures the Tobii 5 integration leverages Synopticon's full architecture while providing a lightweight, high-performance solution that surpasses OpenTrack's capabilities.