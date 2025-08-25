# Neon Eye Tracker Data Distribution Guide

**Version:** 0.5.3  
**Device:** Pupil Labs Neon Eye Tracker  
**Protocols:** MQTT, WebSocket, HTTP, UDP

---

## Quick Start: Sending Neon Data via MQTT

### Basic Setup

```javascript
import { createDistributionSessionManager, createDistributionConfigManager } from './src/core/distribution/index.js';

// 1. Configure MQTT for Neon eye tracker
const configManager = createDistributionConfigManager();
const sessionManager = createDistributionSessionManager();

const neonConfig = configManager.createSessionConfig({
  distributors: {
    mqtt: {
      broker: 'mqtt://your-broker.local:1883',  // Your MQTT broker
      clientId: 'neon-eye-tracker-001',
      topics: {
        gaze: 'eyetracking/neon/gaze',
        pupil: 'eyetracking/neon/pupil',
        events: 'eyetracking/neon/events'
      }
    }
  },
  // Tell the system which data goes where
  eventRouting: {
    'neon_gaze_data': ['mqtt'],     // Gaze data → MQTT
    'neon_pupil_data': ['mqtt'],    // Pupil data → MQTT
    'neon_fixation': ['mqtt'],      // Fixation events → MQTT
  }
});

// 2. Create session
const session = await sessionManager.createSession('neon-session', neonConfig);

// 3. Send Neon data to MQTT
const gazeData = {
  x: 0.523,  // Normalized coordinates from Neon
  y: 0.412,
  confidence: 0.95,
  timestamp: Date.now()
};

await sessionManager.routeEvent('neon-session', 'neon_gaze_data', gazeData);
// Data is now sent to MQTT broker on topic 'eyetracking/neon/gaze'
```

---

## How Data Distribution Works

### The Flow: Data Source → Event Routing → Distributors

```
[Neon Eye Tracker] 
    ↓ (generates data)
[Your Application]
    ↓ (calls routeEvent with event name)
[Event Routing Configuration]
    ↓ (maps event to distributors)
[Selected Distributors]
    ↓ (send to their destinations)
[MQTT Broker / WebSocket / HTTP / etc.]
```

### Step-by-Step Process

1. **Define Event Routing**: Tell the system which events go to which distributors
2. **Send Data with Event Name**: Use `routeEvent()` with the appropriate event name
3. **Automatic Distribution**: System automatically sends to configured distributors

---

## Complete Neon Integration Example

### Full Configuration with Multiple Distributors

```javascript
const neonConfig = configManager.createSessionConfig({
  sessionId: 'study-participant-001',
  distributors: {
    // MQTT for other systems to consume
    mqtt: {
      broker: 'mqtt://lab-broker.local:1883',
      clientId: 'neon-participant-001',
      topics: {
        prefix: 'lab/eyetracking',
        gaze: 'lab/eyetracking/gaze',
        events: 'lab/eyetracking/events',
        quality: 'lab/eyetracking/quality'
      },
      qos: 1  // Reliable delivery
    },
    
    // WebSocket for real-time visualization
    websocket: {
      port: 8080,
      compression: true
    },
    
    // HTTP for data storage
    http: {
      baseUrl: 'http://database.lab.local:3000',
      endpoints: {
        batch: '/api/eyetracking/batch',
        events: '/api/eyetracking/events'
      }
    },
    
    // UDP for ultra-low latency analysis
    udp: {
      port: 9999,
      targets: [
        { host: '192.168.1.100', port: 9999 }
      ]
    }
  },
  
  // Define routing for different data types
  eventRouting: {
    // High-frequency data (200Hz gaze)
    'neon_gaze_data': ['mqtt', 'udp'],       // Real-time systems
    
    // Medium-frequency data
    'neon_pupil_data': ['mqtt', 'websocket'], // MQTT + visualization
    
    // Events (blinks, fixations, saccades)
    'neon_fixation': ['mqtt', 'websocket', 'http'],  // All channels
    'neon_saccade': ['mqtt', 'websocket', 'http'],   // All channels
    'neon_blink': ['mqtt', 'http'],                  // MQTT + storage
    
    // Calibration data
    'neon_calibration': ['http', 'mqtt'],    // Store + notify
    
    // Batch summaries
    'neon_batch': ['http']                   // Storage only
  }
});
```

### Processing Neon Data Stream

```javascript
class NeonDataHandler {
  constructor(sessionManager, sessionId) {
    this.sessionManager = sessionManager;
    this.sessionId = sessionId;
  }

  // Process raw gaze data from Neon
  async processGazeData(neonGazeData) {
    // Structure from Neon API
    const formattedData = {
      // Gaze position
      x: neonGazeData.norm_pos[0],
      y: neonGazeData.norm_pos[1],
      
      // Confidence
      confidence: neonGazeData.confidence,
      
      // Eye state data
      leftPupil: {
        diameter: neonGazeData.base_data[0].pupil.diameter,
        center: neonGazeData.base_data[0].pupil.center
      },
      rightPupil: {
        diameter: neonGazeData.base_data[1].pupil.diameter,
        center: neonGazeData.base_data[1].pupil.center
      },
      
      // Metadata
      timestamp: neonGazeData.timestamp,
      worn: neonGazeData.worn
    };

    // Route to configured distributors
    await this.sessionManager.routeEvent(
      this.sessionId, 
      'neon_gaze_data', 
      formattedData
    );
  }

  // Process eye tracking events
  async processEvent(eventType, eventData) {
    const eventName = `neon_${eventType}`;
    
    await this.sessionManager.routeEvent(
      this.sessionId,
      eventName,
      {
        ...eventData,
        eventType,
        timestamp: Date.now()
      }
    );
  }
  
  // Process IMU data (head movement)
  async processIMUData(imuData) {
    await this.sessionManager.routeEvent(
      this.sessionId,
      'neon_imu_data',
      {
        quaternion: imuData.quaternion,
        gyroscope: imuData.gyro,
        accelerometer: imuData.accel,
        timestamp: imuData.timestamp
      }
    );
  }
}
```

---

## Quality-Based Distribution

### Route Data Based on Quality/Confidence

```javascript
// Configure different routes for different quality levels
const qualityBasedConfig = {
  eventRouting: {
    'high_quality_gaze': ['mqtt', 'udp'],     // Real-time analysis
    'medium_quality_gaze': ['mqtt'],          // Standard processing
    'low_quality_gaze': ['http'],             // Storage only
    'quality_alert': ['websocket', 'mqtt']    // Immediate notification
  }
};

// Process with quality filtering
async function distributeByQuality(gazeData) {
  let eventName;
  
  if (gazeData.confidence > 0.9) {
    eventName = 'high_quality_gaze';
  } else if (gazeData.confidence > 0.7) {
    eventName = 'medium_quality_gaze';
  } else {
    eventName = 'low_quality_gaze';
    
    // Also send alert if too low
    if (gazeData.confidence < 0.5) {
      await sessionManager.routeEvent('neon-session', 'quality_alert', {
        message: 'Low tracking quality',
        confidence: gazeData.confidence
      });
    }
  }
  
  await sessionManager.routeEvent('neon-session', eventName, gazeData);
}
```

---

## Real-World Production Setup

### Environment-Based Configuration

```bash
# Environment variables for production
export MQTT_BROKER=mqtt://production-broker.company.com:1883
export MQTT_USERNAME=neon-client
export MQTT_PASSWORD=secure-password
export STUDY_ID=cognitive-load-2024
export PARTICIPANT_ID=P001
```

```javascript
// Production configuration using environment variables
const productionConfig = configManager.createSessionConfig({
  template: 'production',
  sessionId: `${process.env.STUDY_ID}-${process.env.PARTICIPANT_ID}`,
  distributors: {
    mqtt: {
      broker: process.env.MQTT_BROKER,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: `neon-${process.env.PARTICIPANT_ID}`,
      topics: {
        // Organized topic structure
        prefix: `studies/${process.env.STUDY_ID}`,
        gaze: `studies/${process.env.STUDY_ID}/participants/${process.env.PARTICIPANT_ID}/gaze`,
        events: `studies/${process.env.STUDY_ID}/participants/${process.env.PARTICIPANT_ID}/events`,
        alerts: `studies/${process.env.STUDY_ID}/alerts`
      }
    }
  }
});
```

### Batching for Efficiency

```javascript
class NeonBatchProcessor {
  constructor(sessionManager, sessionId) {
    this.sessionManager = sessionManager;
    this.sessionId = sessionId;
    this.buffer = [];
    this.bufferSize = 100;  // Send every 100 samples
    this.flushInterval = 1000; // Or every 1 second
    
    // Auto-flush timer
    setInterval(() => this.flush(), this.flushInterval);
  }

  async addGazeSample(gazeData) {
    this.buffer.push(gazeData);
    
    // Send individual sample via MQTT for real-time
    await this.sessionManager.routeEvent(
      this.sessionId,
      'neon_gaze_data',
      gazeData
    );
    
    // Check if batch is ready
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;
    
    // Send batch via HTTP for storage
    const batch = {
      samples: this.buffer,
      count: this.buffer.length,
      startTime: this.buffer[0].timestamp,
      endTime: this.buffer[this.buffer.length - 1].timestamp
    };
    
    await this.sessionManager.distribute(
      this.sessionId,
      'gaze_batch',
      batch,
      { targets: ['http'] }  // Only to HTTP
    );
    
    this.buffer = [];
  }
}
```

---

## Common Patterns

### 1. Real-Time Streaming
```javascript
// High-frequency data → Low-latency protocols
eventRouting: {
  'neon_gaze_data': ['udp', 'websocket'],  // No MQTT for 200Hz
  'neon_pupil_data': ['udp', 'websocket']
}
```

### 2. Research Data Collection
```javascript
// Everything to MQTT for other systems + HTTP for storage
eventRouting: {
  'neon_gaze_data': ['mqtt', 'http'],
  'neon_events': ['mqtt', 'http'],
  'neon_calibration': ['mqtt', 'http']
}
```

### 3. Live Monitoring Dashboard
```javascript
// WebSocket for dashboard + MQTT for logging
eventRouting: {
  'neon_gaze_data': ['websocket'],
  'neon_quality_metrics': ['websocket', 'mqtt'],
  'neon_alerts': ['websocket', 'mqtt']
}
```

### 4. Multi-Site Study
```javascript
// Different MQTT topics per site
const siteAConfig = {
  mqtt: { 
    broker: 'mqtt://site-a.study.edu:1883',
    topics: { prefix: 'study/site-a' }
  }
};

const siteBConfig = {
  mqtt: {
    broker: 'mqtt://site-b.study.edu:1883',
    topics: { prefix: 'study/site-b' }
  }
};
```

---

## Troubleshooting

### MQTT Not Receiving Data?

1. **Check broker connection**:
```javascript
const status = await sessionManager.getSessionStatus('neon-session');
console.log('MQTT health:', status.health.distributors.find(d => d.name.includes('mqtt')));
```

2. **Verify event routing**:
```javascript
console.log('Active routes:', status.eventRoutes);
// Should show: 'neon_gaze_data' → ['mqtt']
```

3. **Enable only MQTT for testing**:
```javascript
const testConfig = {
  enabledDistributors: ['mqtt'],  // Only MQTT active
  distributors: { mqtt: { ... } },
  eventRouting: { 'neon_gaze_data': ['mqtt'] }
};
```

### Data Not Reaching Specific Distributor?

```javascript
// Send to specific distributor only
await sessionManager.distribute(
  'neon-session',
  'test_event',
  { test: 'data' },
  { targets: ['mqtt'] }  // Force MQTT only
);
```

---

## Best Practices

1. **Match data frequency to protocol**:
   - 200Hz gaze → UDP or WebSocket
   - Events → MQTT, HTTP
   - Batches → HTTP

2. **Use quality thresholds**:
   - Drop samples below confidence threshold
   - Route by quality level

3. **Implement batching**:
   - Real-time individual samples via MQTT/WebSocket
   - Batch storage via HTTP

4. **Topic organization**:
   - Use hierarchical topics: `study/participant/datatype`
   - Separate high/low frequency data

5. **Handle disconnections**:
   - Implement local buffering
   - Retry with exponential backoff
   - Switch to backup distributors

---

This guide shows exactly how to route Neon eye tracker data through specific distributors, with MQTT being the primary example. The key is configuring event routing to map your data types to the appropriate distribution channels.