# Eye Tracking Module

## 📁 Directory Structure

```
eye-tracking/
├── common/                      # Shared logic across all devices
│   ├── calibration.js           # Universal calibration algorithms
│   └── gaze-processing.js       # Gaze computation & algorithms
│
├── devices/                     # Device-specific implementations
│   ├── webcam/                  # MediaPipe/browser webcam
│   │   ├── index.js            # Module exports
│   │   └── pipeline.js         # MediaPipe iris tracking pipeline
│   │
│   └── neon/                   # Pupil Labs Neon
│       ├── index.js            # Module exports
│       ├── pipeline.js         # Neon eye tracking pipeline
│       ├── device.js           # Device connection management
│       ├── discovery.js        # mDNS device discovery
│       └── streaming.js        # RTSP stream handling
│
└── index.js                    # Main API interface
```

## 🚀 Usage

### Webcam Eye Tracking (MediaPipe)
```javascript
import { createWebcamEyeTrackingPipeline } from './devices/webcam';

const pipeline = createWebcamEyeTrackingPipeline({
  enableIrisTracking: true,
  enableBlinkDetection: true
});

await pipeline.initialize();
const result = await pipeline.process(frame);
```

### Neon Eye Tracking (Pupil Labs)
```javascript
import { createNeonEyeTrackingPipeline } from './devices/neon';

const pipeline = createNeonEyeTrackingPipeline({
  deviceAddress: '192.168.1.100',
  enableStreaming: true
});

await pipeline.initialize();
const result = await pipeline.process(frame);
```

### Common Components

#### Calibration
```javascript
import { createCalibrator } from './common/calibration';

const calibrator = createCalibrator({
  screenWidth: 1920,
  screenHeight: 1080
});
```

#### Gaze Processing
```javascript
import { createGazeProcessor } from './common/gaze-processing';

const processor = createGazeProcessor({
  smoothingFactor: 0.7,
  fixationThreshold: 100
});
```

## 🔌 Adding New Eye Tracking Devices

To add support for a new eye tracking device (e.g., Tobii):

1. Create a new directory under `devices/`:
   ```
   devices/tobii/
   ```

2. Implement the pipeline interface:
   ```javascript
   // devices/tobii/pipeline.js
   export const createTobiiEyeTrackingPipeline = (config) => {
     // Implementation
   };
   ```

3. Export from index:
   ```javascript
   // devices/tobii/index.js
   export { createTobiiEyeTrackingPipeline } from './pipeline.js';
   ```

4. Update the lazy pipeline registry if needed:
   ```javascript
   // In src/core/lazy-pipeline-registry.js
   'tobii-eye-tracking': () => import('../features/eye-tracking/devices/tobii/pipeline.js')
   ```

## 📊 Device Comparison

| Feature | Webcam (MediaPipe) | Neon (Pupil Labs) | 
|---------|-------------------|-------------------|
| Accuracy | Medium | High |
| Frame Rate | 30 FPS | 200 FPS |
| Calibration | Optional | Required |
| Cost | Free | Professional |
| Setup | Easy | Complex |
| Platform | Browser | Any |

## 🔧 Configuration

Each device type has its own configuration options:

### Webcam Configuration
- `enableIrisTracking`: Enable iris landmark detection
- `enableBlinkDetection`: Enable blink detection
- `smoothingFactor`: Gaze smoothing (0-1)

### Neon Configuration  
- `deviceAddress`: IP address of Neon device
- `port`: Connection port (default: 8080)
- `enableStreaming`: Enable RTSP streaming
- `calibrationMode`: 'screen' or '3d'

## 📝 API Reference

All eye tracking pipelines implement the standard Pipeline interface:
- `initialize()`: Initialize the device/pipeline
- `process(frame)`: Process a frame and return eye tracking data
- `cleanup()`: Clean up resources
- `getStatus()`: Get device/pipeline status
- `isInitialized()`: Check initialization status