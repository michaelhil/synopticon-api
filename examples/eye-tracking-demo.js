#!/usr/bin/env bun

/**
 * Eye Tracking Integration Demo
 * Demonstrates complete eye tracking functionality including:
 * - Device discovery and connection
 * - Real-time gaze streaming
 * - Calibration procedures
 * - Data recording and export
 * - Integration with face analysis
 */

import { createEyeTracker } from '../src/eye-tracking/index.js';
import { createFaceAnalysisEngine } from '../src/face-analysis-engine.js';
import { createSynchronizationEngine } from '../src/core/synchronization.js';
import { streamFactory } from '../src/core/streams.js';

// Mock canvas for face analysis
const createMockCanvas = () => ({
  getContext: () => ({
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8Array(4) }),
    putImageData: () => {},
    clearRect: () => {}
  }),
  width: 1920,
  height: 1080
});

class EyeTrackingDemo {
  constructor() {
    this.eyeTracker = null;
    this.faceEngine = null;
    this.syncEngine = null;
    this.isRunning = false;
    this.sessionData = {
      gazePoints: [],
      faceDetections: [],
      correlations: [],
      startTime: null,
      endTime: null
    };
  }

  async initialize() {
    console.log('🚀 Initializing Eye Tracking Demo...\n');

    try {
      // Initialize eye tracking system
      console.log('📡 Initializing eye tracking system...');
      this.eyeTracker = createEyeTracker({
        useMockDevices: true, // Use mock devices for demo
        autoStart: true,
        enableSynchronization: true
      });

      await this.eyeTracker.initialize();
      console.log('✅ Eye tracking system initialized\n');

      // Initialize face analysis engine
      console.log('🎭 Initializing face analysis engine...');
      const mockCanvas = createMockCanvas();
      this.faceEngine = createFaceAnalysisEngine(mockCanvas, {
        enableStreaming: true,
        streamConfig: {
          sampleRate: 30,
          enableSynchronization: true
        }
      });

      await this.faceEngine.initialize();
      console.log('✅ Face analysis engine initialized\n');

      // Initialize synchronization engine
      console.log('⚡ Setting up multimodal synchronization...');
      this.syncEngine = createSynchronizationEngine({
        tolerance: 10, // 10ms tolerance
        strategy: 'hardware_timestamp',
        bufferSize: 100
      });
      console.log('✅ Synchronization engine ready\n');

      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      return false;
    }
  }

  async discoverAndConnect() {
    console.log('🔍 Discovering eye tracking devices...\n');

    try {
      // Discover devices
      const devices = await this.eyeTracker.discoverDevices(3000);
      
      if (devices.length === 0) {
        console.log('⚠️  No devices found. Make sure your eye tracker is connected.\n');
        return false;
      }

      console.log(`📱 Found ${devices.length} device(s):`);
      devices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.name} (${device.id})`);
        console.log(`     Address: ${device.address}:${device.port}`);
        console.log(`     Status: ${device.status}`);
        console.log(`     Capabilities: ${device.capabilities.join(', ')}`);
        console.log('');
      });

      // Connect to first device
      console.log('🔌 Connecting to first device...');
      await this.eyeTracker.connectToDevice(devices[0].id);
      
      const connectedDevices = this.eyeTracker.getConnectedDevices();
      console.log(`✅ Connected to device: ${devices[0].name}\n`);

      return true;
    } catch (error) {
      console.error('❌ Device connection failed:', error.message);
      return false;
    }
  }

  async performCalibration() {
    console.log('🎯 Starting calibration procedure...\n');

    const deviceId = this.eyeTracker.getConnectedDevices()[0];
    if (!deviceId) {
      console.log('❌ No device connected for calibration\n');
      return false;
    }

    try {
      // Start calibration
      const calibration = await this.eyeTracker.startCalibration(deviceId, {
        calibrationType: '9-point',
        validationEnabled: true
      });

      if (!calibration.success) {
        console.log('❌ Failed to start calibration\n');
        return false;
      }

      console.log('📐 Calibration started. Please follow the on-screen instructions...');
      
      // Monitor calibration progress
      const progressUpdates = [];
      const unsubscribe = this.eyeTracker.onCalibrationProgress((update) => {
        progressUpdates.push(update);
        console.log(`   📊 Calibration ${update.event}: ${update.timestamp}`);
      });

      // Wait for calibration to complete (simulated)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complete calibration
      const result = await this.eyeTracker.stopCalibration(deviceId, calibration.sessionId);
      unsubscribe();

      if (result.success) {
        console.log('✅ Calibration completed successfully!');
        console.log(`   📈 Quality: ${result.session.result?.quality || 'Unknown'}`);
        console.log(`   🎯 Accuracy: ${result.session.result?.accuracy || 'Unknown'}`);
        console.log('');
        return true;
      } else {
        console.log('⚠️  Calibration completed with issues. You may want to recalibrate.\n');
        return false;
      }

    } catch (error) {
      console.error('❌ Calibration failed:', error.message);
      return false;
    }
  }

  async startDataCollection() {
    console.log('📊 Starting multimodal data collection...\n');

    const deviceId = this.eyeTracker.getConnectedDevices()[0];
    if (!deviceId) {
      console.log('❌ No device connected for data collection\n');
      return;
    }

    try {
      // Start recording session
      const recording = await this.eyeTracker.startRecording(deviceId, {
        recordingId: `demo-session-${Date.now()}`,
        duration: 10000, // 10 seconds
        includeVideo: false,
        includeIMU: false
      });

      if (!recording.success) {
        console.log('❌ Failed to start recording\n');
        return;
      }

      console.log(`🎬 Recording started: ${recording.recordingId}`);
      this.sessionData.startTime = Date.now();
      this.isRunning = true;

      // Create and configure streams
      const gazeStream = streamFactory.create('eyetracking', { 
        id: 'demo-gaze',
        enableMemoryOptimization: true,
        enableAdaptiveBatching: true
      });

      const faceStream = streamFactory.create('video', { 
        id: 'demo-face',
        sampleRate: 30 
      });

      // Setup synchronization
      this.syncEngine.addStream('gaze', gazeStream);
      this.syncEngine.addStream('face', faceStream);

      await Promise.all([gazeStream.start(), faceStream.start()]);

      // Setup data collection handlers
      this.setupDataHandlers(gazeStream, faceStream);

      console.log('👁️  Collecting gaze and face data for 10 seconds...');
      console.log('   (Look around naturally - data is being recorded)\n');

      // Simulate data collection
      await this.simulateDataCollection(gazeStream, faceStream);

      // Stop recording
      await this.eyeTracker.stopRecording(deviceId, recording.sessionId);
      await Promise.all([gazeStream.stop(), faceStream.stop()]);

      this.sessionData.endTime = Date.now();
      this.isRunning = false;

      console.log('✅ Data collection completed!\n');
      this.displayResults();

    } catch (error) {
      console.error('❌ Data collection failed:', error.message);
    }
  }

  setupDataHandlers(gazeStream, faceStream) {
    // Collect gaze data
    gazeStream.onData((gazeData) => {
      this.sessionData.gazePoints.push({
        timestamp: gazeData.timestamp,
        x: gazeData.x,
        y: gazeData.y,
        confidence: gazeData.confidence,
        semantic: gazeData.semantic
      });
    });

    // Collect face data
    faceStream.onData((faceData) => {
      if (faceData.faces && faceData.faces.length > 0) {
        this.sessionData.faceDetections.push({
          timestamp: faceData.timestamp,
          faceCount: faceData.faces.length,
          primaryFace: faceData.faces[0]
        });
      }
    });

    // Collect synchronized correlations
    this.syncEngine.onSynchronizedData((streams) => {
      const gazeData = streams.find(s => s.streamType === 'eyetracking');
      const faceData = streams.find(s => s.streamType === 'video');

      if (gazeData && faceData) {
        this.sessionData.correlations.push({
          timestamp: streams[0].timestamp,
          gazePosition: { x: gazeData.x, y: gazeData.y },
          facePresent: faceData.faces && faceData.faces.length > 0,
          quality: this.calculateCorrelationQuality(gazeData, faceData)
        });
      }
    });
  }

  calculateCorrelationQuality(gazeData, faceData) {
    if (!faceData.faces || faceData.faces.length === 0) {
      return { score: 0, reason: 'no_face_detected' };
    }

    const face = faceData.faces[0];
    const faceCenter = {
      x: (face.bbox.x + face.bbox.width / 2) / 1920, // Normalize to screen
      y: (face.bbox.y + face.bbox.height / 2) / 1080
    };

    const distance = Math.sqrt(
      Math.pow(gazeData.x - faceCenter.x, 2) + 
      Math.pow(gazeData.y - faceCenter.y, 2)
    );

    let score = Math.max(0, 1 - distance * 5); // Scale distance to score
    let reason = distance < 0.1 ? 'looking_at_face' : 
                 distance < 0.2 ? 'near_face' : 'looking_elsewhere';

    return { score, reason, distance };
  }

  async simulateDataCollection(gazeStream, faceStream) {
    const duration = 10000; // 10 seconds
    const startTime = Date.now();

    // Simulate realistic gaze and face data
    let gazeX = 0.5, gazeY = 0.5;
    let gazeVelocity = { x: 0.01, y: 0.005 };

    while (Date.now() - startTime < duration) {
      const currentTime = Date.now();
      
      // Generate realistic gaze movement
      gazeX += gazeVelocity.x + (Math.random() - 0.5) * 0.01;
      gazeY += gazeVelocity.y + (Math.random() - 0.5) * 0.01;

      // Bounce off screen edges
      if (gazeX <= 0 || gazeX >= 1) gazeVelocity.x *= -1;
      if (gazeY <= 0 || gazeY >= 1) gazeVelocity.y *= -1;

      // Keep in bounds
      gazeX = Math.max(0, Math.min(1, gazeX));
      gazeY = Math.max(0, Math.min(1, gazeY));

      // Process gaze data (200Hz)
      await gazeStream.process({
        timestamp: currentTime,
        x: gazeX,
        y: gazeY,
        confidence: 0.8 + Math.random() * 0.2,
        eyeStates: {
          left: { pupilDiameter: 3.2 + Math.sin(currentTime / 1000) * 0.3 },
          right: { pupilDiameter: 3.1 + Math.sin(currentTime / 1000) * 0.3 }
        }
      });

      // Process face data occasionally (30Hz)
      if (currentTime % 33 < 5) { // Approximately every 33ms
        await faceStream.process({
          timestamp: currentTime,
          faces: [{
            bbox: { 
              x: 700 + Math.sin(currentTime / 2000) * 100,
              y: 400 + Math.cos(currentTime / 2000) * 50,
              width: 240,
              height: 180
            },
            confidence: 0.85 + Math.random() * 0.1,
            landmarks: []
          }]
        });
      }

      await new Promise(resolve => setTimeout(resolve, 5)); // 200Hz rate
    }
  }

  displayResults() {
    const duration = (this.sessionData.endTime - this.sessionData.startTime) / 1000;
    
    console.log('📈 Session Results:');
    console.log('==================');
    console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
    console.log(`👁️  Gaze points collected: ${this.sessionData.gazePoints.length}`);
    console.log(`🎭 Face detections: ${this.sessionData.faceDetections.length}`);
    console.log(`🔗 Synchronized correlations: ${this.sessionData.correlations.length}`);
    
    if (this.sessionData.gazePoints.length > 0) {
      const avgConfidence = this.sessionData.gazePoints.reduce((sum, p) => sum + p.confidence, 0) / this.sessionData.gazePoints.length;
      const gazeRate = this.sessionData.gazePoints.length / duration;
      console.log(`📊 Average gaze confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`⚡ Gaze sampling rate: ${gazeRate.toFixed(0)} Hz`);
    }

    if (this.sessionData.faceDetections.length > 0) {
      const faceRate = this.sessionData.faceDetections.length / duration;
      const avgFaceConfidence = this.sessionData.faceDetections.reduce((sum, f) => sum + f.primaryFace.confidence, 0) / this.sessionData.faceDetections.length;
      console.log(`🎭 Face detection rate: ${faceRate.toFixed(0)} Hz`);
      console.log(`🎯 Average face confidence: ${(avgFaceConfidence * 100).toFixed(1)}%`);
    }

    if (this.sessionData.correlations.length > 0) {
      const lookingAtFace = this.sessionData.correlations.filter(c => c.quality.reason === 'looking_at_face').length;
      const attentionRatio = lookingAtFace / this.sessionData.correlations.length;
      console.log(`👀 Time looking at face: ${(attentionRatio * 100).toFixed(1)}%`);
    }

    // Display sample semantic interpretations
    console.log('\n🧠 Sample Gaze Semantics:');
    this.sessionData.gazePoints
      .filter(p => p.semantic)
      .slice(0, 5)
      .forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.semantic.description} (${p.semantic.quality})`);
      });

    console.log('\n📊 Data Quality Analysis:');
    this.analyzeDataQuality();
    
    console.log('\n💾 Session data can be exported for further analysis.');
    console.log('   Use exportData() method to save results.\n');
  }

  analyzeDataQuality() {
    const gaze = this.sessionData.gazePoints;
    const face = this.sessionData.faceDetections;

    // Gaze quality analysis
    if (gaze.length > 0) {
      const highConfidenceGaze = gaze.filter(p => p.confidence > 0.8).length;
      const gazeQualityRatio = highConfidenceGaze / gaze.length;
      
      console.log(`   👁️  High-quality gaze samples: ${(gazeQualityRatio * 100).toFixed(1)}%`);
      
      // Temporal stability
      let stableIntervals = 0;
      for (let i = 1; i < gaze.length; i++) {
        const interval = gaze[i].timestamp - gaze[i-1].timestamp;
        if (interval >= 4 && interval <= 6) stableIntervals++; // Expected 5ms ±1ms
      }
      
      const temporalStability = stableIntervals / (gaze.length - 1);
      console.log(`   ⏰ Temporal stability: ${(temporalStability * 100).toFixed(1)}%`);
    }

    // Face detection quality
    if (face.length > 0) {
      const highConfidenceFace = face.filter(f => f.primaryFace.confidence > 0.8).length;
      const faceQualityRatio = highConfidenceFace / face.length;
      console.log(`   🎭 High-quality face detections: ${(faceQualityRatio * 100).toFixed(1)}%`);
    }

    // Synchronization quality
    if (this.sessionData.correlations.length > 0) {
      const goodCorrelations = this.sessionData.correlations.filter(c => c.quality.score > 0.7).length;
      const syncQualityRatio = goodCorrelations / this.sessionData.correlations.length;
      console.log(`   🔗 Synchronization quality: ${(syncQualityRatio * 100).toFixed(1)}%`);
    }
  }

  exportData(filename = `eye-tracking-session-${Date.now()}.json`) {
    const exportData = {
      metadata: {
        sessionId: `demo-${this.sessionData.startTime}`,
        startTime: this.sessionData.startTime,
        endTime: this.sessionData.endTime,
        duration: this.sessionData.endTime - this.sessionData.startTime,
        deviceInfo: this.eyeTracker.getSystemStats(),
        exportTime: Date.now()
      },
      data: this.sessionData,
      summary: {
        gazePointCount: this.sessionData.gazePoints.length,
        faceDetectionCount: this.sessionData.faceDetections.length,
        correlationCount: this.sessionData.correlations.length,
        averageGazeConfidence: this.sessionData.gazePoints.length > 0 
          ? this.sessionData.gazePoints.reduce((s, p) => s + p.confidence, 0) / this.sessionData.gazePoints.length
          : 0
      }
    };

    // In a real implementation, this would write to file
    console.log(`📁 Data exported to ${filename}`);
    console.log(`📊 Export size: ${JSON.stringify(exportData).length} bytes`);
    
    return exportData;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up demo resources...');
    
    if (this.eyeTracker) {
      await this.eyeTracker.shutdown();
    }
    
    if (this.faceEngine && this.faceEngine.cleanup) {
      this.faceEngine.cleanup();
    }
    
    if (this.syncEngine) {
      this.syncEngine.stop();
    }
    
    console.log('✅ Cleanup completed\n');
  }
}

// Main demo execution
async function runDemo() {
  console.log('👁️  Eye Tracking Integration Demo');
  console.log('=================================\n');

  const demo = new EyeTrackingDemo();

  try {
    // Initialize systems
    const initialized = await demo.initialize();
    if (!initialized) {
      console.log('❌ Demo initialization failed. Exiting.\n');
      return;
    }

    // Discover and connect to devices
    const connected = await demo.discoverAndConnect();
    if (!connected) {
      console.log('⚠️  Continuing with demo using mock data only.\n');
    }

    // Perform calibration
    if (connected) {
      await demo.performCalibration();
    }

    // Collect multimodal data
    await demo.startDataCollection();

    // Export results
    const exportedData = demo.exportData();
    
    console.log('🎉 Demo completed successfully!');
    console.log('\n📚 Next Steps:');
    console.log('   1. Connect a real Pupil Labs Neon device for actual data');
    console.log('   2. Integrate with your application using the same APIs');
    console.log('   3. Customize calibration and data processing parameters');
    console.log('   4. Add custom semantic interpretations for your use case');

  } catch (error) {
    console.error('❌ Demo failed with error:', error.message);
  } finally {
    await demo.cleanup();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received interrupt signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Received termination signal. Shutting down gracefully...');
  process.exit(0);
});

// Run the demo
if (import.meta.main) {
  runDemo().catch(console.error);
}