# Tobii 5 Eye Tracker Integration Plan

## Overview
Direct integration with Tobii 5 eye tracker using Tobii Game Integration (TGI) API, bypassing OpenTrack entirely.

## Current OpenTrack Limitations
- Uses legacy Tobii EyeX SDK (not Tobii 5)
- Requires UDP bridge on port 4242
- Incomplete implementation (1-2 years stale)
- Needs FaceTrackNoIR as intermediary
- Limited to basic head tracking data

## Proposed Solution: Native TGI Integration

### Architecture
```
┌─────────────────────────────────────┐
│        Synopticon API               │
│    (JavaScript/Bun Runtime)        │
├─────────────────────────────────────┤
│      Tobii Bridge Service          │
│         (C++/Native)               │
├─────────────────────────────────────┤
│   Tobii Game Integration API       │
│        (TGI C++ SDK)               │
├─────────────────────────────────────┤
│      Tobii Runtime Service         │
│        (Background Service)        │
└─────────────────────────────────────┘
```

### Core Components

#### 1. Tobii Bridge Service (C++)
**Location**: `src/features/eye-tracking/devices/tobii5/native/`

**Responsibilities**:
- Initialize TGI API connection
- Stream gaze and head pose data
- Handle device state management
- Expose data via shared memory or IPC

**Key Features**:
```cpp
class TobiiBridge {
    // Direct TGI integration
    ITobiiGameIntegrationApi* api;
    IStreamsProvider* streams;
    
    // Data structures
    struct EyeTrackingData {
        GazePoint gaze;
        HeadPose headPose;
        bool userPresent;
        uint64_t timestamp;
    };
    
    // Methods
    bool initialize();
    EyeTrackingData getLatestData();
    void cleanup();
};
```

#### 2. JavaScript Interface
**Location**: `src/features/eye-tracking/devices/tobii5/`

**Files**:
- `device.js` - Tobii 5 device factory
- `discovery.js` - Device discovery implementation  
- `streaming.js` - Data streaming controller
- `bridge.js` - Native bridge communication

### Implementation Phases

#### Phase 1: Native Bridge Development
```bash
# Create native bridge using Bun's FFI capabilities
mkdir -p src/features/eye-tracking/devices/tobii5/native
```

**Bridge Interface**:
```cpp
extern "C" {
    // Initialize Tobii connection
    bool tobii_initialize();
    
    // Get latest tracking data
    bool tobii_get_data(EyeTrackingData* data);
    
    // Check device status
    bool tobii_is_connected();
    
    // Cleanup resources
    void tobii_cleanup();
}
```

#### Phase 2: Bun FFI Integration
**File**: `src/features/eye-tracking/devices/tobii5/bridge.js`

```javascript
import { dlopen, FFIType, ptr } from 'bun:ffi';

const createTobiiBridge = () => {
    const lib = dlopen('./native/tobii_bridge.dylib', {
        tobii_initialize: { returns: FFIType.bool },
        tobii_get_data: { 
            args: [FFIType.ptr], 
            returns: FFIType.bool 
        },
        tobii_is_connected: { returns: FFIType.bool },
        tobii_cleanup: { returns: FFIType.void }
    });
    
    return {
        initialize: () => lib.symbols.tobii_initialize(),
        getData: () => {
            const buffer = new ArrayBuffer(64);
            const success = lib.symbols.tobii_get_data(ptr(buffer));
            return success ? parseTrackingData(buffer) : null;
        },
        isConnected: () => lib.symbols.tobii_is_connected(),
        cleanup: () => lib.symbols.tobii_cleanup()
    };
};
```

#### Phase 3: Device Factory Implementation
**File**: `src/features/eye-tracking/devices/tobii5/device.js`

```javascript
export const createTobii5Device = (config = {}) => {
    const bridge = createTobiiBridge();
    const state = {
        connected: false,
        streaming: false,
        lastData: null
    };
    
    return {
        connect: async () => {
            if (bridge.initialize()) {
                state.connected = true;
                return { success: true };
            }
            return { success: false, error: 'Failed to initialize Tobii 5' };
        },
        
        disconnect: async () => {
            bridge.cleanup();
            state.connected = false;
            return { success: true };
        },
        
        getStatus: () => ({
            connected: state.connected && bridge.isConnected(),
            deviceType: 'tobii-5',
            capabilities: ['gaze-tracking', 'head-tracking', 'presence-detection']
        }),
        
        getLatestData: () => bridge.getData()
    };
};
```

#### Phase 4: Discovery Integration
**File**: `src/features/eye-tracking/devices/tobii5/discovery.js`

```javascript
export const createTobii5Discovery = () => ({
    discoverDevices: async () => {
        // Check if Tobii runtime is available
        const tobiiAvailable = await checkTobiiRuntime();
        
        if (tobiiAvailable) {
            return [{
                id: 'tobii-5-default',
                name: 'Tobii Eye Tracker 5',
                type: 'tobii-5',
                capabilities: ['gaze-tracking', 'head-tracking', 'presence-detection']
            }];
        }
        
        return [];
    }
});
```

## Advantages Over OpenTrack

### Performance Improvements
- **Latency**: Direct API access vs UDP network hop
- **Data Quality**: Full TGI data streams vs limited head tracking
- **Reliability**: Native connection vs protocol bridge
- **Precision**: Raw gaze coordinates vs processed head movement

### Feature Enhancements
- **Gaze Point Tracking**: Precise screen coordinates
- **Head Pose Data**: 6DOF position and rotation
- **Presence Detection**: User attention monitoring  
- **Automatic Calibration**: Built-in TGI calibration

### Integration Benefits
- **Synopticon Native**: Designed for Synopticon's architecture
- **Bun Runtime**: Optimized for Bun's performance characteristics
- **Factory Pattern**: Consistent with existing device implementations
- **Type Safety**: Full TypeScript integration

## Development Requirements

### Dependencies
- Tobii Game Integration SDK (Windows)
- C++ compiler toolchain
- Bun FFI capabilities
- Platform-specific runtime libraries

### Platform Support
- **Windows**: Full TGI support
- **macOS**: Limited (investigate TGI availability)  
- **Linux**: Research required

### Testing Strategy
- Unit tests for bridge communication
- Integration tests with physical Tobii 5 device
- Performance benchmarks vs OpenTrack
- Cross-platform compatibility verification

## Migration Path

### For Existing Users
1. **Parallel Support**: Keep existing Tobii integrations working
2. **Feature Flag**: Allow switching between implementations
3. **Gradual Migration**: Migrate features incrementally
4. **Fallback Option**: OpenTrack UDP as backup

### Development Workflow  
1. **Phase 1**: Native bridge (2-3 weeks)
2. **Phase 2**: Bun FFI integration (1 week)  
3. **Phase 3**: Device factory (1 week)
4. **Phase 4**: Discovery and testing (1-2 weeks)

## Success Metrics

### Performance Targets
- **Latency**: <10ms end-to-end (vs 20-50ms OpenTrack UDP)
- **Accuracy**: Native TGI precision (vs processed OpenTrack data)
- **Reliability**: 99%+ connection stability
- **Throughput**: 60Hz+ data rate

This approach provides a modern, high-performance alternative to OpenTrack's legacy implementation while leveraging Synopticon's existing architecture patterns.