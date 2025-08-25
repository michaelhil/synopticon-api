/**
 * Multimodal Integration Testing
 * Tests integration between eye tracking and existing face analysis systems
 * Validates synchronization, data correlation, and unified processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createFaceAnalysisEngine } from '../../src/core/face-analysis-engine.js';
import { createEyeTrackingSystem } from '../../src/features/eye-tracking/streaming.js';
import { createSynchronizationEngine } from '../../src/core/synchronization.js';
import { streamFactory } from '../../src/core/streams.js';
import { createEyeTracker } from '../../src/features/eye-tracking/index.js';

// Mock canvas for testing
const createMockCanvas = () => ({
  getContext: () => ({
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8Array(4) }),
    putImageData: () => {}
  }),
  width: 640,
  height: 480
});

describe('Multimodal Integration Tests', () => {
  let faceEngine;
  let eyeTracker;
  let syncEngine;
  let mockCanvas;
  let cleanup = [];

  beforeEach(async () => {
    mockCanvas = createMockCanvas();
    cleanup = [];
    
    // Initialize face analysis engine
    faceEngine = createFaceAnalysisEngine(mockCanvas, {
      enableStreaming: true,
      streamConfig: {
        sampleRate: 30,
        enableSynchronization: true
      }
    });

    // Initialize eye tracking system
    eyeTracker = createEyeTracker({
      useMockDevices: true,
      autoStart: true,
      enableSynchronization: true
    });

    // Initialize synchronization engine
    syncEngine = createSynchronizationEngine({
      tolerance: 10, // 10ms tolerance
      strategy: 'hardware_timestamp',
      bufferSize: 100
    });

    cleanup.push(
      () => faceEngine.cleanup?.(),
      () => eyeTracker.shutdown(),
      () => syncEngine.stop()
    );
  });

  afterEach(async () => {
    for (const cleanupFn of cleanup.reverse()) {
      try {
        await cleanupFn();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  describe('System Initialization and Coordination', () => {
    it('should initialize both systems without conflicts', async () => {
      await faceEngine.initialize();
      await eyeTracker.initialize();

      expect(faceEngine.getProcessingState().isInitialized).toBe(true);
      expect(eyeTracker.getSystemStats().initialized).toBe(true);
    });

    it('should create synchronized streams for both modalities', async () => {
      await faceEngine.initialize();
      await eyeTracker.initialize();
      await eyeTracker.autoConnectToFirstDevice();

      // Create streams
      const faceStream = streamFactory.create('video', {
        id: 'face-analysis',
        sampleRate: 30
      });

      const eyeStream = streamFactory.create('eyetracking', {
        id: 'eye-tracking',
        sampleRate: 200,
        enableMemoryOptimization: true,
        enableAdaptiveBatching: true
      });

      // Add streams to synchronization
      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', eyeStream);

      await faceStream.start();
      await eyeStream.start();

      expect(faceStream.isActive()).toBe(true);
      expect(eyeStream.isActive()).toBe(true);
      expect(syncEngine.getActiveStreams().length).toBe(2);

      await faceStream.stop();
      await eyeStream.stop();
    });

    it('should handle device discovery coordination', async () => {
      await eyeTracker.initialize();

      const devices = await eyeTracker.discoverDevices(2000);
      expect(devices.length).toBeGreaterThan(0);

      // Should not interfere with face analysis
      await faceEngine.initialize();
      const faceState = faceEngine.getProcessingState();
      expect(faceState.isInitialized).toBe(true);
    });
  });

  describe('Data Synchronization', () => {
    it('should synchronize face analysis and gaze data streams', async () => {
      await faceEngine.initialize();
      await eyeTracker.initialize();
      await eyeTracker.autoConnectToFirstDevice();

      const synchronizedData = [];
      
      syncEngine.onSynchronizedData((streams) => {
        synchronizedData.push({
          timestamp: Date.now(),
          streams: streams.map(s => ({
            type: s.streamType,
            timestamp: s.timestamp,
            data: s.data
          }))
        });
      });

      // Create and add streams
      const faceStream = streamFactory.create('video', { id: 'face', sampleRate: 30 });
      const gazeStream = streamFactory.create('eyetracking', { id: 'gaze', sampleRate: 200 });

      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      // Simulate concurrent data
      const baseTimestamp = Date.now();
      
      // Add face analysis data (30 FPS)
      for (let i = 0; i < 5; i++) {
        await faceStream.process({
          timestamp: baseTimestamp + i * 33, // 33ms intervals
          faces: [{
            bbox: { x: 100, y: 100, width: 200, height: 200 },
            confidence: 0.9,
            landmarks: []
          }]
        });
      }

      // Add gaze data (200 FPS)
      for (let i = 0; i < 30; i++) {
        await gazeStream.process({
          timestamp: baseTimestamp + i * 5, // 5ms intervals
          x: 0.5 + Math.sin(i * 0.1) * 0.2,
          y: 0.5 + Math.cos(i * 0.1) * 0.2,
          confidence: 0.8 + Math.random() * 0.2
        });
      }

      // Wait for synchronization
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(synchronizedData.length).toBeGreaterThan(0);
      
      // Check that synchronized data contains both types
      const hasMultipleTypes = synchronizedData.some(sync => 
        sync.streams.length > 1 && 
        sync.streams.some(s => s.type === 'video') && 
        sync.streams.some(s => s.type === 'eyetracking')
      );
      
      expect(hasMultipleTypes).toBe(true);

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });

    it('should maintain temporal alignment within tolerance', async () => {
      const alignedData = [];
      
      syncEngine.onSynchronizedData((streams) => {
        if (streams.length >= 2) {
          const timestamps = streams.map(s => s.timestamp);
          const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
          
          alignedData.push({
            maxTimeDiff: maxDiff,
            streamCount: streams.length,
            timestamps
          });
        }
      });

      const faceStream = streamFactory.create('video', { id: 'face' });
      const gazeStream = streamFactory.create('eyetracking', { id: 'gaze' });

      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      // Add synchronized data
      const baseTime = Date.now();
      for (let i = 0; i < 10; i++) {
        const timestamp = baseTime + i * 100; // 100ms intervals
        
        await faceStream.process({
          timestamp: timestamp + Math.random() * 5, // ±2.5ms jitter
          data: `face_${i}`
        });
        
        await gazeStream.process({
          timestamp: timestamp + Math.random() * 5, // ±2.5ms jitter
          x: Math.random(),
          y: Math.random(),
          confidence: 0.8
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(alignedData.length).toBeGreaterThan(0);
      
      // Most alignments should be within tolerance
      const withinTolerance = alignedData.filter(a => a.maxTimeDiff <= 10).length;
      const toleranceRatio = withinTolerance / alignedData.length;
      
      expect(toleranceRatio).toBeGreaterThan(0.8); // 80% within tolerance

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });

    it('should handle different sampling rates gracefully', async () => {
      const syncedData = [];
      
      syncEngine.onSynchronizedData((streams) => {
        syncedData.push({
          face: streams.filter(s => s.streamType === 'video').length,
          gaze: streams.filter(s => s.streamType === 'eyetracking').length,
          timestamp: streams[0]?.timestamp
        });
      });

      // High-frequency gaze (200Hz) vs low-frequency face (30Hz)
      const faceStream = streamFactory.create('video', { 
        id: 'face', 
        sampleRate: 30 
      });
      const gazeStream = streamFactory.create('eyetracking', { 
        id: 'gaze', 
        sampleRate: 200 
      });

      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      // Generate data at different rates
      const baseTime = Date.now();
      
      // Face data (30Hz)
      for (let i = 0; i < 10; i++) {
        await faceStream.process({
          timestamp: baseTime + i * 33,
          faces: [{ id: i, confidence: 0.9 }]
        });
      }

      // Gaze data (200Hz) - many more samples
      for (let i = 0; i < 66; i++) { // 333ms worth at 200Hz
        await gazeStream.process({
          timestamp: baseTime + i * 5,
          x: Math.random(),
          y: Math.random(),
          confidence: 0.8
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(syncedData.length).toBeGreaterThan(0);
      
      // Should handle rate differences properly
      const avgFacePerSync = syncedData.reduce((sum, s) => sum + s.face, 0) / syncedData.length;
      const avgGazePerSync = syncedData.reduce((sum, s) => sum + s.gaze, 0) / syncedData.length;
      
      expect(avgFacePerSync).toBeLessThanOrEqual(1); // At most 1 face sample per sync
      expect(avgGazePerSync).toBeGreaterThan(0); // At least some gaze samples

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });
  });

  describe('Coordinated Data Processing', () => {
    it('should correlate face landmarks with gaze positions', async () => {
      await faceEngine.initialize();
      await eyeTracker.initialize();
      await eyeTracker.autoConnectToFirstDevice();

      const correlations = [];

      syncEngine.onSynchronizedData((streams) => {
        const faceData = streams.find(s => s.streamType === 'video');
        const gazeData = streams.find(s => s.streamType === 'eyetracking');

        if (faceData && gazeData && faceData.data.faces) {
          const face = faceData.data.faces[0];
          if (face && face.bbox) {
            // Calculate if gaze is within face region
            const faceCenter = {
              x: (face.bbox.x + face.bbox.width / 2) / mockCanvas.width,
              y: (face.bbox.y + face.bbox.height / 2) / mockCanvas.height
            };
            
            const gazeDistance = Math.sqrt(
              Math.pow(gazeData.x - faceCenter.x, 2) + 
              Math.pow(gazeData.y - faceCenter.y, 2)
            );

            correlations.push({
              timestamp: faceData.timestamp,
              faceCenter,
              gazePosition: { x: gazeData.x, y: gazeData.y },
              distance: gazeDistance,
              lookingAtFace: gazeDistance < 0.1 // Within 10% screen distance
            });
          }
        }
      });

      const faceStream = streamFactory.create('video', { id: 'face' });
      const gazeStream = streamFactory.create('eyetracking', { id: 'gaze' });

      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      // Simulate coordinated data
      const baseTime = Date.now();
      for (let i = 0; i < 20; i++) {
        const timestamp = baseTime + i * 50;
        
        // Face in center of screen
        await faceStream.process({
          timestamp,
          faces: [{
            bbox: { x: 220, y: 140, width: 200, height: 200 }, // Centered
            confidence: 0.9,
            landmarks: []
          }]
        });

        // Gaze looking at face (center ± some variance)
        await gazeStream.process({
          timestamp: timestamp + 2, // Slight offset
          x: 0.5 + (Math.random() - 0.5) * 0.1, // Center ± 5%
          y: 0.5 + (Math.random() - 0.5) * 0.1,
          confidence: 0.8 + Math.random() * 0.2
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(correlations.length).toBeGreaterThan(0);
      
      // Most gaze points should be looking at face
      const lookingAtFace = correlations.filter(c => c.lookingAtFace).length;
      const lookingRatio = lookingAtFace / correlations.length;
      
      expect(lookingRatio).toBeGreaterThan(0.7); // 70% should be looking at face

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });

    it('should detect attention patterns based on face and gaze data', async () => {
      const attentionEvents = [];

      syncEngine.onSynchronizedData((streams) => {
        const faceData = streams.find(s => s.streamType === 'video');
        const gazeData = streams.find(s => s.streamType === 'eyetracking');

        if (faceData && gazeData) {
          // Detect engagement patterns
          const facePresent = faceData.data.faces && faceData.data.faces.length > 0;
          const highGazeConfidence = gazeData.confidence > 0.8;
          const gazeStable = gazeData.metadata?.velocity < 0.1; // Low velocity = stable gaze

          if (facePresent && highGazeConfidence && gazeStable) {
            attentionEvents.push({
              timestamp: faceData.timestamp,
              type: 'focused_attention',
              faceConfidence: faceData.data.faces[0].confidence,
              gazeConfidence: gazeData.confidence,
              gazeVelocity: gazeData.metadata?.velocity || 0
            });
          } else if (facePresent && !highGazeConfidence) {
            attentionEvents.push({
              timestamp: faceData.timestamp,
              type: 'distracted',
              reason: 'low_gaze_confidence'
            });
          }
        }
      });

      const faceStream = streamFactory.create('video', { id: 'face' });
      const gazeStream = streamFactory.create('eyetracking', { id: 'gaze' });

      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      const baseTime = Date.now();
      
      // Simulate attention pattern: focused -> distracted -> focused
      for (let phase = 0; phase < 3; phase++) {
        for (let i = 0; i < 10; i++) {
          const timestamp = baseTime + (phase * 10 + i) * 50;
          
          await faceStream.process({
            timestamp,
            faces: [{
              bbox: { x: 200, y: 150, width: 240, height: 180 },
              confidence: 0.85 + Math.random() * 0.1,
              landmarks: []
            }]
          });

          let gazeConfidence, gazeVelocity;
          switch (phase) {
            case 0: // Focused
            case 2:
              gazeConfidence = 0.85 + Math.random() * 0.1;
              gazeVelocity = 0.05 + Math.random() * 0.03;
              break;
            case 1: // Distracted
              gazeConfidence = 0.4 + Math.random() * 0.3;
              gazeVelocity = 0.2 + Math.random() * 0.2;
              break;
          }

          await gazeStream.process({
            timestamp: timestamp + 1,
            x: 0.5 + (Math.random() - 0.5) * 0.2,
            y: 0.5 + (Math.random() - 0.5) * 0.2,
            confidence: gazeConfidence,
            metadata: { velocity: gazeVelocity }
          });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(attentionEvents.length).toBeGreaterThan(0);
      
      // Should detect both focused and distracted states
      const focusedEvents = attentionEvents.filter(e => e.type === 'focused_attention');
      const distractedEvents = attentionEvents.filter(e => e.type === 'distracted');
      
      expect(focusedEvents.length).toBeGreaterThan(0);
      expect(distractedEvents.length).toBeGreaterThan(0);

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });

    it('should handle multimodal calibration coordination', async () => {
      await eyeTracker.initialize();
      await eyeTracker.autoConnectToFirstDevice();
      
      const deviceId = eyeTracker.getConnectedDevices()[0];
      
      // Start eye tracker calibration
      const eyeCalibration = await eyeTracker.startCalibration(deviceId);
      expect(eyeCalibration.success).toBe(true);
      
      // Face analysis should continue during eye calibration
      await faceEngine.initialize();
      const faceState = faceEngine.getProcessingState();
      expect(faceState.isInitialized).toBe(true);
      
      // Both systems should be able to operate simultaneously
      const eyeStats = eyeTracker.getSystemStats();
      expect(eyeStats.activeSessions.calibrations).toBe(1);
      
      // Complete calibration
      await eyeTracker.stopCalibration(deviceId, eyeCalibration.sessionId);
      
      const completedSessions = eyeTracker.getCalibrationSessions(deviceId);
      expect(completedSessions[0].status).toMatch(/completed|needs_recalibration/);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should maintain performance under multimodal load', async () => {
      const performanceMetrics = {
        faceProcessingTimes: [],
        gazeProcessingTimes: [],
        syncLatencies: []
      };

      // Monitor processing times
      syncEngine.onSynchronizedData((streams) => {
        const syncTime = Date.now();
        streams.forEach(stream => {
          const latency = syncTime - stream.timestamp;
          performanceMetrics.syncLatencies.push(latency);
        });
      });

      const faceStream = streamFactory.create('video', { id: 'face', sampleRate: 30 });
      const gazeStream = streamFactory.create('eyetracking', { 
        id: 'gaze', 
        sampleRate: 200,
        enableMemoryOptimization: true,
        enableAdaptiveBatching: true
      });

      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      // High-load scenario
      const startTime = Date.now();
      const promises = [];

      // Face processing load
      for (let i = 0; i < 50; i++) {
        promises.push((async () => {
          const procStart = performance.now();
          await faceStream.process({
            timestamp: Date.now(),
            faces: [{
              bbox: { x: 100 + i % 100, y: 100, width: 200, height: 200 },
              confidence: 0.8 + Math.random() * 0.2
            }]
          });
          performanceMetrics.faceProcessingTimes.push(performance.now() - procStart);
        })());
      }

      // Gaze processing load
      for (let i = 0; i < 300; i++) {
        promises.push((async () => {
          const procStart = performance.now();
          await gazeStream.process({
            timestamp: Date.now(),
            x: Math.random(),
            y: Math.random(),
            confidence: 0.8 + Math.random() * 0.2
          });
          performanceMetrics.gazeProcessingTimes.push(performance.now() - procStart);
        })());
      }

      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      console.log(`Multimodal processing completed in ${totalTime}ms`);

      // Performance validation
      const avgFaceTime = performanceMetrics.faceProcessingTimes.reduce((a, b) => a + b, 0) / performanceMetrics.faceProcessingTimes.length;
      const avgGazeTime = performanceMetrics.gazeProcessingTimes.reduce((a, b) => a + b, 0) / performanceMetrics.gazeProcessingTimes.length;
      
      expect(avgFaceTime).toBeLessThan(50); // Face processing under 50ms
      expect(avgGazeTime).toBeLessThan(10); // Gaze processing under 10ms
      
      if (performanceMetrics.syncLatencies.length > 0) {
        const avgSyncLatency = performanceMetrics.syncLatencies.reduce((a, b) => a + b, 0) / performanceMetrics.syncLatencies.length;
        expect(avgSyncLatency).toBeLessThan(100); // Sync latency under 100ms
      }

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });

    it('should manage memory efficiently across modalities', async () => {
      // Create memory-optimized streams
      const faceStream = streamFactory.create('video', { 
        id: 'face',
        bufferSize: 100
      });
      
      const gazeStream = streamFactory.create('eyetracking', { 
        id: 'gaze',
        enableMemoryOptimization: true,
        bufferSize: 500
      });

      await Promise.all([faceStream.start(), gazeStream.start()]);

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Process large amounts of data
      for (let i = 0; i < 1000; i++) {
        await faceStream.process({
          timestamp: Date.now(),
          faces: [{ 
            bbox: { x: i % 640, y: i % 480, width: 100, height: 100 },
            confidence: Math.random()
          }]
        });

        // Multiple gaze points per face frame
        for (let j = 0; j < 6; j++) {
          await gazeStream.process({
            timestamp: Date.now(),
            x: Math.random(),
            y: Math.random(),
            confidence: Math.random()
          });
        }
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory growth should be reasonable (under 50MB for this test)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);

      // Check memory optimizer stats if available
      if (gazeStream.getMemoryOptimizer) {
        const optimizerStats = gazeStream.getMemoryOptimizer().getStats();
        expect(optimizerStats.memoryPool.reuseHits).toBeGreaterThan(0);
      }

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });

    it('should handle stream coordination errors gracefully', async () => {
      const errors = [];
      
      syncEngine.onError((error) => {
        errors.push(error);
      });

      const faceStream = streamFactory.create('video', { id: 'face' });
      const gazeStream = streamFactory.create('eyetracking', { id: 'gaze' });

      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      // Simulate error conditions
      try {
        // Invalid face data
        await faceStream.process({
          timestamp: Date.now(),
          faces: null // Invalid data
        });
      } catch (error) {
        // Expected error
      }

      try {
        // Invalid gaze data
        await gazeStream.process({
          timestamp: Date.now(),
          x: 'invalid', // Invalid coordinate
          y: 0.5,
          confidence: 0.8
        });
      } catch (error) {
        // Expected error
      }

      // Streams should continue operating after errors
      await faceStream.process({
        timestamp: Date.now(),
        faces: [{ bbox: { x: 0, y: 0, width: 100, height: 100 }, confidence: 0.9 }]
      });

      await gazeStream.process({
        timestamp: Date.now(),
        x: 0.5,
        y: 0.5,
        confidence: 0.8
      });

      expect(faceStream.isActive()).toBe(true);
      expect(gazeStream.isActive()).toBe(true);

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should simulate user attention tracking session', async () => {
      await faceEngine.initialize();
      await eyeTracker.initialize();
      await eyeTracker.autoConnectToFirstDevice();

      const sessionData = {
        attentionEvents: [],
        gazeFixations: [],
        faceDetections: [],
        sessionDuration: 0
      };

      const deviceId = eyeTracker.getConnectedDevices()[0];
      
      // Start recording session
      const recording = await eyeTracker.startRecording(deviceId, {
        recordingId: 'attention-session'
      });

      // Monitor gaze data
      const unsubscribeGaze = eyeTracker.onGazeData((gazeData) => {
        sessionData.gazeFixations.push({
          timestamp: gazeData.timestamp,
          position: { x: gazeData.x, y: gazeData.y },
          confidence: gazeData.confidence,
          quality: gazeData.semantic?.quality || 'unknown'
        });
      });

      // Simulate 2-second attention session
      const sessionStart = Date.now();
      
      // Simulate face detection and gaze coordination
      const faceStream = streamFactory.create('video', { id: 'face' });
      const gazeStream = streamFactory.create('eyetracking', { id: 'gaze' });
      
      syncEngine.addStream('face', faceStream);
      syncEngine.addStream('gaze', gazeStream);

      await Promise.all([faceStream.start(), gazeStream.start()]);

      // Simulate realistic session data
      for (let i = 0; i < 60; i++) { // 2 seconds at 30fps
        const timestamp = sessionStart + i * 33;
        
        // Face detection
        await faceStream.process({
          timestamp,
          faces: [{
            bbox: { 
              x: 200 + Math.sin(i * 0.1) * 20, 
              y: 150 + Math.cos(i * 0.1) * 15, 
              width: 240, 
              height: 180 
            },
            confidence: 0.85 + Math.random() * 0.1
          }]
        });

        sessionData.faceDetections.push({
          timestamp,
          detected: true,
          confidence: 0.85 + Math.random() * 0.1
        });

        // Multiple gaze samples per face frame (200Hz)
        for (let j = 0; j < 6; j++) {
          await gazeStream.process({
            timestamp: timestamp + j * 5,
            x: 0.5 + Math.sin((i * 6 + j) * 0.05) * 0.15,
            y: 0.5 + Math.cos((i * 6 + j) * 0.05) * 0.1,
            confidence: 0.8 + Math.random() * 0.2
          });
        }
      }

      sessionData.sessionDuration = Date.now() - sessionStart;

      // Stop recording
      await eyeTracker.stopRecording(deviceId, recording.sessionId);
      unsubscribeGaze();

      // Validate session data
      expect(sessionData.faceDetections.length).toBe(60);
      expect(sessionData.gazeFixations.length).toBeGreaterThan(300); // ~360 expected
      expect(sessionData.sessionDuration).toBeGreaterThan(1800); // At least 1.8 seconds
      
      const recordingSessions = eyeTracker.getRecordingSessions(deviceId);
      expect(recordingSessions[0].status).toBe('completed');

      await Promise.all([faceStream.stop(), gazeStream.stop()]);
    });

    it('should handle calibration and validation workflow', async () => {
      await eyeTracker.initialize();
      await eyeTracker.autoConnectToFirstDevice();

      const deviceId = eyeTracker.getConnectedDevices()[0];
      
      // Perform calibration
      const calibration = await eyeTracker.startCalibration(deviceId);
      expect(calibration.success).toBe(true);
      
      // Monitor calibration progress
      const calibrationUpdates = [];
      const unsubscribe = eyeTracker.onCalibrationProgress((update) => {
        calibrationUpdates.push(update);
      });

      // Simulate calibration completion
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const result = await eyeTracker.stopCalibration(deviceId, calibration.sessionId);
      expect(result.success).toBe(true);
      
      unsubscribe();

      // Validation: Check if we can process gaze data with good quality
      const validationGazeData = [];
      const unsubscribeValidation = eyeTracker.onGazeData((gazeData) => {
        if (gazeData.confidence > 0.7) {
          validationGazeData.push(gazeData);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      unsubscribeValidation();

      expect(validationGazeData.length).toBeGreaterThan(50); // Good quality data
      expect(calibrationUpdates.length).toBeGreaterThan(0);

      const sessions = eyeTracker.getCalibrationSessions(deviceId);
      expect(sessions[0].status).toMatch(/completed|needs_recalibration/);
    });
  });
});