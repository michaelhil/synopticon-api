/**
 * Neon Eye Tracker Data Distribution Example
 * Shows how to route specific data types through specific distributors
 */

import { createDistributionSessionManager } from '../../src/core/distribution/distribution-session-manager.js';
import { createDistributionConfigManager } from '../../src/core/distribution/distribution-config-manager.js';

/**
 * Example 1: Basic Neon Eye Tracker Setup with MQTT
 */
const setupNeonEyeTrackerDistribution = async () => {
  console.log('👁️ Setting up Neon Eye Tracker Distribution via MQTT');
  console.log('='.repeat(60));

  const sessionManager = createDistributionSessionManager();
  const configManager = createDistributionConfigManager();

  // Step 1: Create session with MQTT configured for eye tracking data
  const eyeTrackingConfig = configManager.createSessionConfig({
    template: 'research_lab',
    sessionId: 'neon-tracker-001',
    distributors: {
      mqtt: {
        broker: 'mqtt://localhost:1883', // Your MQTT broker
        clientId: 'neon-eye-tracker-001',
        topics: {
          // Define specific topics for eye tracking data
          prefix: 'eyetracking/neon',
          gaze: 'eyetracking/neon/gaze',
          pupil: 'eyetracking/neon/pupil',
          events: 'eyetracking/neon/events',
          imu: 'eyetracking/neon/imu',
          calibration: 'eyetracking/neon/calibration'
        },
        qos: 1, // Reliable delivery
        retain: false
      },
      websocket: {
        port: 8080, // For real-time visualization
        compression: true
      },
      http: {
        baseUrl: 'http://localhost:3001', // For data storage
        endpoints: {
          eyetracking_batch: '/api/eyetracking/batch',
          calibration: '/api/eyetracking/calibration'
        }
      }
    },
    // Define which events go to which distributors
    eventRouting: {
      // High-frequency gaze data → MQTT (for other systems) + WebSocket (for visualization)
      'neon_gaze_data': ['mqtt', 'websocket'],
      
      // Pupil data → MQTT + WebSocket
      'neon_pupil_data': ['mqtt', 'websocket'],
      
      // IMU data → MQTT only (other systems need this)
      'neon_imu_data': ['mqtt'],
      
      // Eye tracking events (blinks, fixations, saccades) → All channels
      'neon_blink': ['mqtt', 'websocket', 'http'],
      'neon_fixation': ['mqtt', 'websocket', 'http'],
      'neon_saccade': ['mqtt', 'websocket', 'http'],
      
      // Calibration data → HTTP (for storage) + MQTT (for notification)
      'neon_calibration': ['http', 'mqtt'],
      
      // Batch summaries → HTTP only
      'neon_batch_summary': ['http']
    }
  });

  const session = await sessionManager.createSession('neon-session', eyeTrackingConfig);
  console.log('✅ Eye tracking session created with MQTT distribution');

  // Step 2: Function to distribute Neon eye tracker data
  const distributeNeonData = async (dataType, data) => {
    // Add metadata to the data
    const enrichedData = {
      ...data,
      device: 'neon_eye_tracker',
      timestamp: data.timestamp || Date.now(),
      sessionId: 'neon-session'
    };

    // Route based on data type
    let eventName;
    switch (dataType) {
      case 'gaze':
        eventName = 'neon_gaze_data';
        break;
      case 'pupil':
        eventName = 'neon_pupil_data';
        break;
      case 'imu':
        eventName = 'neon_imu_data';
        break;
      case 'blink':
        eventName = 'neon_blink';
        break;
      case 'fixation':
        eventName = 'neon_fixation';
        break;
      case 'saccade':
        eventName = 'neon_saccade';
        break;
      case 'calibration':
        eventName = 'neon_calibration';
        break;
      default:
        eventName = 'neon_gaze_data';
    }

    // Distribute through the session
    const result = await sessionManager.routeEvent('neon-session', eventName, enrichedData);
    
    return {
      eventName,
      distributed: result.summary.successful,
      total: result.summary.total,
      timestamp: enrichedData.timestamp
    };
  };

  // Step 3: Simulate Neon eye tracker data stream
  console.log('\n📊 Simulating Neon Eye Tracker Data Stream...\n');

  // Simulate gaze data (high frequency - 200Hz)
  const gazeData = {
    x: 0.523,  // Normalized screen coordinates (0-1)
    y: 0.412,
    confidence: 0.95,
    timestamp: Date.now(),
    worn: true,
    eyeStates: {
      left: {
        pupilDiameter: 3.2,
        pupilCenter: { x: 0.51, y: 0.48 },
        eyeballCenter: { x: -32.1, y: 0.5, z: 45.2 },
        opticalAxis: { x: 0.15, y: -0.08, z: 0.98 }
      },
      right: {
        pupilDiameter: 3.1,
        pupilCenter: { x: 0.49, y: 0.47 },
        eyeballCenter: { x: 32.3, y: 0.4, z: 45.1 },
        opticalAxis: { x: -0.14, y: -0.07, z: 0.98 }
      }
    }
  };

  const gazeResult = await distributeNeonData('gaze', gazeData);
  console.log(`👁️ Gaze data → ${gazeResult.distributed}/${gazeResult.total} distributors`);

  // Simulate pupil data
  const pupilData = {
    leftPupilDiameter: 3.2,
    rightPupilDiameter: 3.1,
    leftConfidence: 0.98,
    rightConfidence: 0.97,
    timestamp: Date.now()
  };

  const pupilResult = await distributeNeonData('pupil', pupilData);
  console.log(`👁️ Pupil data → ${pupilResult.distributed}/${pupilResult.total} distributors`);

  // Simulate IMU data (head position/orientation)
  const imuData = {
    quaternion: [0.998, 0.012, -0.045, 0.032], // w, x, y, z
    accelerometer: [0.02, -9.81, 0.15], // x, y, z in m/s²
    gyroscope: [0.001, 0.002, -0.001], // x, y, z in rad/s
    timestamp: Date.now()
  };

  const imuResult = await distributeNeonData('imu', imuData);
  console.log(`🔄 IMU data → ${imuResult.distributed}/${imuResult.total} distributors`);

  // Simulate eye tracking events
  const fixationEvent = {
    type: 'fixation',
    eventType: 'start',
    x: 0.523,
    y: 0.412,
    timestamp: Date.now(),
    areaOfInterest: 'navigation_menu', // Semantic information
    confidence: 0.92
  };

  const fixationResult = await distributeNeonData('fixation', fixationEvent);
  console.log(`🎯 Fixation event → ${fixationResult.distributed}/${fixationResult.total} distributors`);

  // Simulate calibration result
  const calibrationData = {
    status: 'completed',
    quality: 'excellent',
    accuracy: 0.8, // degrees
    precision: 0.5, // degrees
    points: [
      { x: 0.1, y: 0.1, error: 0.7 },
      { x: 0.5, y: 0.1, error: 0.6 },
      { x: 0.9, y: 0.1, error: 0.8 },
      // ... more points
    ],
    timestamp: Date.now()
  };

  const calibrationResult = await distributeNeonData('calibration', calibrationData);
  console.log(`✅ Calibration data → ${calibrationResult.distributed}/${calibrationResult.total} distributors`);

  return { sessionManager, distributeNeonData };
};

/**
 * Example 2: Advanced Neon Integration with Selective Distribution
 */
const advancedNeonDistribution = async () => {
  console.log('\n🚀 Advanced Neon Eye Tracker Distribution');
  console.log('='.repeat(60));

  const sessionManager = createDistributionSessionManager();
  const configManager = createDistributionConfigManager();

  // Create session with selective distribution based on data quality
  const advancedConfig = configManager.createSessionConfig({
    template: 'high_frequency',
    sessionId: 'neon-advanced',
    distributors: {
      mqtt: {
        broker: 'mqtt://eye-tracking-server.lab:1883',
        clientId: 'neon-advanced',
        topics: {
          highQuality: 'eyetracking/neon/high-quality',
          lowQuality: 'eyetracking/neon/low-quality',
          alerts: 'eyetracking/neon/alerts'
        }
      },
      udp: {
        port: 9999,
        targets: [
          { host: '192.168.1.100', port: 9999 } // Real-time analysis server
        ]
      },
      websocket: {
        port: 8080
      },
      http: {
        baseUrl: 'http://database.lab:3000'
      }
    }
  });

  const session = await sessionManager.createSession('neon-advanced', advancedConfig);

  // Advanced distribution logic based on data characteristics
  const distributeWithQualityFiltering = async (data) => {
    const results = [];

    // High-quality, high-confidence data
    if (data.confidence > 0.9) {
      // Send via UDP for real-time analysis
      const udpResult = await sessionManager.distribute('neon-advanced', 
        'high_quality_gaze', 
        data, 
        { targets: ['udp'] }
      );
      results.push({ channel: 'UDP (real-time)', sent: udpResult.summary.successful > 0 });

      // Also send via MQTT to high-quality topic
      const mqttResult = await sessionManager.distribute('neon-advanced',
        'high_quality_gaze',
        { ...data, topic: 'eyetracking/neon/high-quality' },
        { targets: ['mqtt'] }
      );
      results.push({ channel: 'MQTT (high-quality)', sent: mqttResult.summary.successful > 0 });
    }

    // Medium quality data - MQTT and WebSocket only
    else if (data.confidence > 0.7) {
      const result = await sessionManager.distribute('neon-advanced',
        'medium_quality_gaze',
        data,
        { targets: ['mqtt', 'websocket'] }
      );
      results.push({ channel: 'MQTT+WebSocket (medium)', sent: result.summary.successful > 0 });
    }

    // Low quality data - only store in database
    else {
      const result = await sessionManager.distribute('neon-advanced',
        'low_quality_gaze',
        data,
        { targets: ['http'] }
      );
      results.push({ channel: 'HTTP (storage)', sent: result.summary.successful > 0 });
    }

    // Alert if quality drops below threshold
    if (data.confidence < 0.5) {
      await sessionManager.distribute('neon-advanced',
        'quality_alert',
        {
          message: 'Eye tracking quality below threshold',
          confidence: data.confidence,
          timestamp: data.timestamp
        },
        { targets: ['mqtt', 'websocket'] }
      );
      results.push({ channel: 'Alert', sent: true });
    }

    return results;
  };

  // Simulate quality-based distribution
  console.log('\n📊 Testing Quality-Based Distribution:\n');

  const testData = [
    { confidence: 0.95, x: 0.5, y: 0.5, label: 'High quality' },
    { confidence: 0.75, x: 0.4, y: 0.6, label: 'Medium quality' },
    { confidence: 0.45, x: 0.3, y: 0.7, label: 'Low quality' }
  ];

  for (const data of testData) {
    console.log(`\n${data.label} (confidence: ${data.confidence}):`);
    const results = await distributeWithQualityFiltering(data);
    results.forEach(r => {
      console.log(`  ${r.sent ? '✅' : '❌'} ${r.channel}`);
    });
  }

  return { sessionManager, distributeWithQualityFiltering };
};

/**
 * Example 3: Real-World Neon Integration Pattern
 */
const realWorldNeonIntegration = async () => {
  console.log('\n🔬 Real-World Neon Eye Tracker Integration');
  console.log('='.repeat(60));

  const sessionManager = createDistributionSessionManager();
  const configManager = createDistributionConfigManager();

  // Production configuration for Neon eye tracker
  const productionConfig = configManager.createSessionConfig({
    template: 'production',
    sessionId: 'study-2024-001',
    distributors: {
      mqtt: {
        broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clientId: `neon-${process.env.PARTICIPANT_ID || 'unknown'}`,
        topics: {
          // Organized topic structure
          prefix: `studies/${process.env.STUDY_ID || 'default'}`,
          participants: `studies/${process.env.STUDY_ID}/participants/${process.env.PARTICIPANT_ID}`,
          gaze: `studies/${process.env.STUDY_ID}/participants/${process.env.PARTICIPANT_ID}/gaze`,
          events: `studies/${process.env.STUDY_ID}/participants/${process.env.PARTICIPANT_ID}/events`,
          quality: `studies/${process.env.STUDY_ID}/quality`,
          alerts: `studies/${process.env.STUDY_ID}/alerts`
        },
        qos: 1,
        retain: false
      },
      http: {
        baseUrl: process.env.API_ENDPOINT || 'http://localhost:3001',
        headers: {
          'Authorization': `Bearer ${process.env.API_TOKEN || ''}`,
          'X-Study-ID': process.env.STUDY_ID || '',
          'X-Participant-ID': process.env.PARTICIPANT_ID || ''
        },
        endpoints: {
          gaze_batch: '/api/v1/eyetracking/gaze/batch',
          events: '/api/v1/eyetracking/events',
          calibration: '/api/v1/eyetracking/calibration',
          session: '/api/v1/eyetracking/session'
        }
      },
      websocket: {
        port: parseInt(process.env.WS_PORT) || 8080,
        compression: true
      }
    }
  });

  const session = await sessionManager.createSession('production-neon', productionConfig);

  /**
   * Create Neon data processor with batching and quality control
   */
  class NeonDataProcessor {
    constructor(sessionManager, sessionId) {
      this.sessionManager = sessionManager;
      this.sessionId = sessionId;
      this.gazeBuffer = [];
      this.bufferSize = 100; // Batch size
      this.bufferTimeout = 1000; // Max time before flush (ms)
      this.lastFlush = Date.now();
      this.metrics = {
        totalSamples: 0,
        highQualitySamples: 0,
        lowQualitySamples: 0,
        droppedSamples: 0
      };
    }

    /**
     * Process incoming gaze data from Neon
     */
    async processGazeData(gazeData) {
      this.metrics.totalSamples++;

      // Quality check
      if (gazeData.confidence < 0.3) {
        this.metrics.droppedSamples++;
        console.warn('⚠️ Dropping low-quality sample:', gazeData.confidence);
        return;
      }

      // Track quality metrics
      if (gazeData.confidence > 0.8) {
        this.metrics.highQualitySamples++;
      } else {
        this.metrics.lowQualitySamples++;
      }

      // Add to buffer
      this.gazeBuffer.push({
        ...gazeData,
        processedAt: Date.now()
      });

      // Send real-time via MQTT and WebSocket
      await this.sessionManager.routeEvent(this.sessionId, 'neon_gaze_data', gazeData);

      // Check if buffer should be flushed
      if (this.shouldFlushBuffer()) {
        await this.flushBuffer();
      }
    }

    /**
     * Process eye tracking events (blinks, fixations, saccades)
     */
    async processEvent(eventData) {
      // Events are sent immediately to all channels
      const eventType = `neon_${eventData.type}`;
      
      const enrichedEvent = {
        ...eventData,
        studyId: process.env.STUDY_ID,
        participantId: process.env.PARTICIPANT_ID,
        sessionId: this.sessionId,
        timestamp: eventData.timestamp || Date.now()
      };

      await this.sessionManager.routeEvent(this.sessionId, eventType, enrichedEvent);
      
      // Also store in database
      await this.sessionManager.distribute(this.sessionId, 
        'event_storage',
        enrichedEvent,
        { targets: ['http'] }
      );
    }

    /**
     * Check if buffer should be flushed
     */
    shouldFlushBuffer() {
      const timeSinceFlush = Date.now() - this.lastFlush;
      return this.gazeBuffer.length >= this.bufferSize || timeSinceFlush > this.bufferTimeout;
    }

    /**
     * Flush gaze buffer to storage
     */
    async flushBuffer() {
      if (this.gazeBuffer.length === 0) return;

      const batch = {
        samples: this.gazeBuffer,
        count: this.gazeBuffer.length,
        startTime: this.gazeBuffer[0].timestamp,
        endTime: this.gazeBuffer[this.gazeBuffer.length - 1].timestamp,
        averageConfidence: this.gazeBuffer.reduce((sum, s) => sum + s.confidence, 0) / this.gazeBuffer.length,
        metrics: { ...this.metrics }
      };

      // Send batch to HTTP storage
      await this.sessionManager.distribute(this.sessionId,
        'gaze_batch',
        batch,
        { targets: ['http'] }
      );

      console.log(`📦 Flushed batch: ${batch.count} samples, avg confidence: ${batch.averageConfidence.toFixed(2)}`);

      // Clear buffer
      this.gazeBuffer = [];
      this.lastFlush = Date.now();
    }

    /**
     * Get processor metrics
     */
    getMetrics() {
      return {
        ...this.metrics,
        bufferSize: this.gazeBuffer.length,
        qualityRate: this.metrics.highQualitySamples / this.metrics.totalSamples || 0
      };
    }
  }

  // Create processor instance
  const processor = new NeonDataProcessor(sessionManager, 'production-neon');

  // Simulate real-world data stream
  console.log('\n📊 Simulating Real-World Neon Data Stream:\n');

  // Simulate 1 second of data at 200Hz
  for (let i = 0; i < 200; i++) {
    const gazeData = {
      x: 0.5 + Math.sin(i / 50) * 0.3, // Simulated gaze movement
      y: 0.5 + Math.cos(i / 50) * 0.2,
      confidence: 0.85 + Math.random() * 0.15, // 0.85-1.0 confidence
      timestamp: Date.now() + i * 5, // 5ms intervals (200Hz)
      worn: true
    };

    await processor.processGazeData(gazeData);

    // Simulate occasional events
    if (i % 50 === 0) {
      await processor.processEvent({
        type: 'fixation',
        x: gazeData.x,
        y: gazeData.y,
        duration: 250 + Math.random() * 100,
        timestamp: gazeData.timestamp
      });
    }

    // Small delay to simulate real timing
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  // Flush remaining data
  await processor.flushBuffer();

  // Show metrics
  console.log('\n📈 Processing Metrics:');
  const metrics = processor.getMetrics();
  console.log(`   Total samples: ${metrics.totalSamples}`);
  console.log(`   High quality: ${metrics.highQualitySamples} (${(metrics.qualityRate * 100).toFixed(1)}%)`);
  console.log(`   Low quality: ${metrics.lowQualitySamples}`);
  console.log(`   Dropped: ${metrics.droppedSamples}`);

  return { sessionManager, processor };
};

/**
 * Main demo runner
 */
const runNeonEyeTrackerDemo = async () => {
  console.log('👁️ Neon Eye Tracker Distribution Demo');
  console.log('='.repeat(80));
  console.log('Demonstrating how to route Neon eye tracker data through specific distributors\n');

  try {
    // Run basic example
    const { distributeNeonData } = await setupNeonEyeTrackerDistribution();
    
    // Run advanced example
    await advancedNeonDistribution();
    
    // Run real-world example
    const { processor } = await realWorldNeonIntegration();

    console.log('\n' + '='.repeat(80));
    console.log('🎉 NEON EYE TRACKER DISTRIBUTION DEMO COMPLETE');
    console.log('='.repeat(80));
    
    console.log('\n✅ Key Concepts Demonstrated:');
    console.log('   • Routing specific data types to specific distributors');
    console.log('   • MQTT configuration for eye tracking topics');
    console.log('   • Quality-based distribution decisions');
    console.log('   • Real-time vs batch data handling');
    console.log('   • Event-based routing configuration');
    console.log('   • Production-ready processing patterns');
    
    console.log('\n📊 Distribution Patterns:');
    console.log('   • High-frequency gaze → MQTT + WebSocket (real-time)');
    console.log('   • Events (fixations, saccades) → All channels');
    console.log('   • Calibration → HTTP (storage) + MQTT (notification)');
    console.log('   • Batch summaries → HTTP only');
    console.log('   • Quality alerts → MQTT + WebSocket');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
};

// Export for use as module
export { 
  setupNeonEyeTrackerDistribution,
  advancedNeonDistribution,
  realWorldNeonIntegration,
  runNeonEyeTrackerDemo
};

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runNeonEyeTrackerDemo()
    .then(() => {
      console.log('\n✨ Demo execution complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Demo crashed:', error);
      process.exit(1);
    });
}