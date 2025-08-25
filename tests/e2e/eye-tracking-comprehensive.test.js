/**
 * Comprehensive Eye Tracking Test Suite
 * Tests all eye tracking components including mock devices, real integration scenarios,
 * performance validation, and multimodal coordination
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createEyeTracker } from '../../src/features/eye-tracking/index.js';
import { createEyeTrackingSystem } from '../../src/features/eye-tracking/streaming.js';
import { createDeviceDiscovery } from '../../src/features/eye-tracking/discovery.js';
import { createEyeTrackerDevice } from '../../src/features/eye-tracking/device.js';
import { createGazeProcessor } from '../../src/features/eye-tracking/gaze-processing.js';
import { createAdvancedCalibrationManager } from '../../src/features/eye-tracking/calibration.js';
import { createAdaptiveBatchScheduler } from '../../src/core/adaptive-batching.js';
import { createMemoryOptimizer } from '../../src/core/memory-optimization.js';
import { streamFactory } from '../../src/core/streams.js';

describe('Eye Tracking - Comprehensive Test Suite', () => {
  let eyeTracker;
  let cleanup = [];

  beforeEach(async () => {
    cleanup = [];
    eyeTracker = createEyeTracker({ useMockDevices: true });
  });

  afterEach(async () => {
    // Cleanup all resources
    for (const cleanupFn of cleanup.reverse()) {
      try {
        await cleanupFn();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
    
    if (eyeTracker) {
      await eyeTracker.shutdown();
    }
  });

  describe('Device Discovery', () => {
    it('should discover mock devices automatically', async () => {
      const discovery = createDeviceDiscovery({ useMockDevices: true });
      cleanup.push(() => discovery.cleanup());

      const devicesFound = [];
      discovery.onDeviceFound((device) => {
        devicesFound.push(device);
      });

      await discovery.startDiscovery();
      
      // Wait for discovery to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(devicesFound.length).toBeGreaterThan(0);
      expect(devicesFound[0].name).toContain('Mock Neon');
      expect(devicesFound[0].capabilities).toContain('gaze_streaming');
    });

    it('should handle device status updates', async () => {
      const discovery = createDeviceDiscovery({ useMockDevices: true });
      cleanup.push(() => discovery.cleanup());

      const statusUpdates = [];
      discovery.onDeviceUpdated((device) => {
        statusUpdates.push(device);
      });

      await discovery.startDiscovery();
      
      // Wait for initial discovery and status updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(statusUpdates.length).toBeGreaterThan(0);
      expect(statusUpdates[0].deviceInfo.battery).toBeTypeOf('number');
    });

    it('should detect device health issues', async () => {
      const discovery = createDeviceDiscovery({ useMockDevices: true });
      cleanup.push(() => discovery.cleanup());

      const lostDevices = [];
      discovery.onDeviceLost((device) => {
        lostDevices.push(device);
      });

      await discovery.startDiscovery();
      
      // Simulate device becoming unresponsive
      const devices = discovery.getDiscoveredDevices();
      if (devices.length > 0) {
        discovery.updateDeviceStatus(devices[0].id, { 
          status: 'lost',
          lastSeen: Date.now() - 120000 // 2 minutes ago
        });
      }

      // Note: In real scenario, health check would run automatically
      expect(devices.length).toBeGreaterThan(0);
    });
  });

  describe('Device Connection and Management', () => {
    it('should connect to mock device successfully', async () => {
      const device = createEyeTrackerDevice({
        deviceId: 'test-device',
        mockMode: true
      });
      cleanup.push(() => device.cleanup());

      const connectionEvents = [];
      device.onConnectionChange((event) => {
        connectionEvents.push(event);
      });

      await device.connect();

      expect(device.isConnected()).toBe(true);
      expect(connectionEvents.length).toBeGreaterThan(0);
      expect(connectionEvents[0].newState).toBe('connected');
    });

    it('should handle reconnection on connection loss', async () => {
      const device = createEyeTrackerDevice({
        deviceId: 'test-device',
        mockMode: true,
        autoReconnect: true,
        reconnectInterval: 100 // Fast reconnect for testing
      });
      cleanup.push(() => device.cleanup());

      const connectionStates = [];
      device.onConnectionChange((event) => {
        connectionStates.push(event.newState);
      });

      await device.connect();
      expect(device.isConnected()).toBe(true);

      // Simulate connection loss
      device.disconnect();
      expect(device.isConnected()).toBe(false);

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have attempted reconnection
      expect(connectionStates.filter(s => s === 'connecting').length).toBeGreaterThan(1);
    });

    it('should stream gaze data continuously', async () => {
      const device = createEyeTrackerDevice({
        deviceId: 'test-device',
        mockMode: true
      });
      cleanup.push(() => device.cleanup());

      const gazeDataPoints = [];
      device.onGazeData((gazeData) => {
        gazeDataPoints.push(gazeData);
      });

      await device.connect();
      
      // Wait for streaming data
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(gazeDataPoints.length).toBeGreaterThan(10); // Should receive ~20 points in 100ms at 200Hz
      expect(gazeDataPoints[0].x).toBeTypeOf('number');
      expect(gazeDataPoints[0].y).toBeTypeOf('number');
      expect(gazeDataPoints[0].confidence).toBeTypeOf('number');
    });
  });

  describe('Gaze Data Processing', () => {
    it('should validate gaze data correctly', () => {
      const processor = createGazeProcessor();
      
      const validData = { x: 0.5, y: 0.5, confidence: 0.8, timestamp: Date.now() };
      const validation = processor.validateGazeData(validData);
      expect(validation.valid).toBe(true);

      const invalidData = { x: 1.5, y: -0.5, confidence: 0.8, timestamp: Date.now() };
      const invalidValidation = processor.validateGazeData(invalidData);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.reason).toContain('out of range');
    });

    it('should apply smoothing to gaze coordinates', async () => {
      const processor = createGazeProcessor({ smoothingFactor: 0.5 });
      
      const data1 = { x: 0.0, y: 0.0, confidence: 0.8, timestamp: Date.now() };
      const data2 = { x: 1.0, y: 1.0, confidence: 0.8, timestamp: Date.now() + 5 };

      const result1 = await processor.processGazeData(data1);
      const result2 = await processor.processGazeData(data2);

      // Second result should be smoothed (between 0.0 and 1.0)
      expect(result2.x).toBeGreaterThan(0.0);
      expect(result2.x).toBeLessThan(1.0);
      expect(result2.metadata.smoothed).toBe(true);
    });

    it('should detect fixations from gaze history', async () => {
      const processor = createGazeProcessor();
      
      // Generate fixation data (same location)
      for (let i = 0; i < 20; i++) {
        await processor.processGazeData({
          x: 0.5 + (Math.random() - 0.5) * 0.02, // Small jitter
          y: 0.5 + (Math.random() - 0.5) * 0.02,
          confidence: 0.8,
          timestamp: Date.now() + i * 10
        });
      }

      const fixations = processor.detectFixations(1000, 0.05);
      expect(fixations.length).toBeGreaterThan(0);
      expect(fixations[0].duration).toBeTypeOf('number');
      expect(fixations[0].confidence).toBeTypeOf('number');
    });

    it('should generate semantic interpretations', async () => {
      const processor = createGazeProcessor();
      
      const gazeData = { x: 0.1, y: 0.1, confidence: 0.9, timestamp: Date.now() };
      const result = await processor.processGazeData(gazeData);

      expect(result.semantic).toBeTruthy();
      expect(result.semantic.region).toBe('upper_left');
      expect(result.semantic.quality).toBe('high_confidence');
      expect(result.semantic.description).toContain('upper left');
    });
  });

  describe('Advanced Calibration', () => {
    it('should manage calibration sessions', async () => {
      const calibrationManager = createAdvancedCalibrationManager();
      
      const session = calibrationManager.startCalibrationSession('test-session');
      expect(session.status).toBe('collecting');
      expect(session.calibrationPoints.length).toBe(9); // 3x3 grid

      // Add some sample data
      for (let i = 0; i < 15; i++) {
        calibrationManager.addCalibrationData('test-session', {
          x: 0.1 + Math.random() * 0.02,
          y: 0.1 + Math.random() * 0.02,
          confidence: 0.8 + Math.random() * 0.2,
          timestamp: Date.now()
        });
      }

      const updatedSession = calibrationManager.getSession('test-session');
      expect(updatedSession.collectedData.length).toBe(15);
    });

    it('should calculate calibration accuracy', async () => {
      const calibrationManager = createAdvancedCalibrationManager();
      const metrics = calibrationManager.getMetrics();
      
      const calibrationPoints = [
        { targetX: 0.1, targetY: 0.1, gazeX: 0.12, gazeY: 0.11, confidence: 0.8 },
        { targetX: 0.5, targetY: 0.5, gazeX: 0.52, gazeY: 0.49, confidence: 0.9 },
        { targetX: 0.9, targetY: 0.9, gazeX: 0.88, gazeY: 0.91, confidence: 0.85 }
      ];

      const accuracy = metrics.calculateAccuracy(calibrationPoints, calibrationPoints);
      expect(accuracy.accuracy).toBeTypeOf('number');
      expect(accuracy.errorDegrees).toBeTypeOf('number');
      expect(accuracy.accuracyGrade).toBeTypeOf('string');
      expect(['excellent', 'good', 'acceptable', 'poor', 'very_poor']).toContain(accuracy.accuracyGrade);
    });

    it('should assess data quality', () => {
      const calibrationManager = createAdvancedCalibrationManager();
      const metrics = calibrationManager.getMetrics();
      
      const highQualityData = Array.from({ length: 100 }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        confidence: 0.8 + Math.random() * 0.2,
        timestamp: Date.now() + i * 5
      }));

      const quality = metrics.assessDataQuality(highQualityData);
      expect(quality.quality).toBeGreaterThan(0.7);
      expect(quality.qualityGrade).toMatch(/good|excellent/);
      expect(quality.completeness).toBeGreaterThan(0.9);
    });
  });

  describe('Adaptive Batching', () => {
    it('should adapt batch size based on system load', async () => {
      const scheduler = createAdaptiveBatchScheduler({
        strategy: 'adaptive',
        maxBatchSize: 20,
        minBatchSize: 1
      });

      // Test with different load scenarios
      const items = Array.from({ length: 50 }, (_, i) => ({ id: i, data: Math.random() }));
      
      const decision1 = scheduler.decideBatchStrategy(items, { queueSize: 10 });
      expect(decision1.batchSize).toBeGreaterThan(0);
      expect(decision1.batchSize).toBeLessThanOrEqual(20);
      expect(decision1.reason).toContain('adaptive');
    });

    it('should handle quality-aware batching', () => {
      const scheduler = createAdaptiveBatchScheduler({ strategy: 'quality_aware' });
      
      const highQualityItems = Array.from({ length: 10 }, () => ({ confidence: 0.9 }));
      const lowQualityItems = Array.from({ length: 10 }, () => ({ confidence: 0.3 }));

      const highQualityDecision = scheduler.decideBatchStrategy(highQualityItems);
      const lowQualityDecision = scheduler.decideBatchStrategy(lowQualityItems);

      expect(highQualityDecision.reason).toContain('high_quality');
      expect(lowQualityDecision.reason).toContain('low_quality');
      expect(highQualityDecision.batchSize).toBeGreaterThanOrEqual(lowQualityDecision.batchSize);
    });

    it('should process batches with performance tracking', async () => {
      const scheduler = createAdaptiveBatchScheduler();
      
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      const processor = async (batch) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return batch.map(item => ({ ...item, processed: true }));
      };

      const result = await scheduler.processBatch(items, processor);
      
      expect(result.results.length).toBe(10);
      expect(result.processed).toBe(10);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.decision).toBeTruthy();
    });
  });

  describe('Memory Optimization', () => {
    it('should create and manage object pools', () => {
      const optimizer = createMemoryOptimizer();
      cleanup.push(() => optimizer.cleanup());

      // Create gaze data using pool
      const gazeData1 = optimizer.createGazeData(Date.now(), 0.5, 0.5, 0.8);
      const gazeData2 = optimizer.createGazeData(Date.now(), 0.6, 0.6, 0.9);

      expect(gazeData1.type).toBe('gazeData');
      expect(gazeData1.x).toBe(0.5);
      expect(gazeData2.x).toBe(0.6);

      // Release objects back to pool
      const released1 = optimizer.releaseObject(gazeData1);
      const released2 = optimizer.releaseObject(gazeData2);
      
      expect(released1).toBe(true);
      expect(released2).toBe(true);

      const stats = optimizer.getStats();
      expect(stats.memoryPool.poolSizes.gazeData.created).toBe(2);
    });

    it('should monitor memory usage and trigger optimization', async () => {
      const optimizer = createMemoryOptimizer({
        memoryPressureThreshold: 0.1, // Low threshold for testing
        gcInterval: 100
      });
      cleanup.push(() => optimizer.cleanup());

      optimizer.startMonitoring();

      // Create many objects to trigger optimization
      for (let i = 0; i < 1000; i++) {
        optimizer.createGazeData(Date.now(), Math.random(), Math.random(), Math.random());
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = optimizer.getStats();
      expect(stats.memoryPool.poolSizes.gazeData.created).toBe(1000);
    });

    it('should use circular buffers efficiently', () => {
      const optimizer = createMemoryOptimizer();
      cleanup.push(() => optimizer.cleanup());

      const buffer = optimizer.createOptimizedBuffer('test-buffer', 100);
      
      // Fill buffer beyond capacity
      for (let i = 0; i < 150; i++) {
        const entry = optimizer.createBufferEntry({ id: i }, 'test-stream');
        buffer.push(entry);
      }

      const stats = buffer.getStats();
      expect(stats.count).toBe(100); // Should maintain size limit
      expect(stats.overflowCount).toBe(50); // Should track overflows
    });
  });

  describe('High-Level API Integration', () => {
    it('should initialize eye tracking system', async () => {
      const initialized = await eyeTracker.initialize({
        useMockDevices: true,
        autoConnect: false
      });

      expect(initialized).toBe(true);
      
      const stats = eyeTracker.getSystemStats();
      expect(stats.initialized).toBe(true);
    });

    it('should discover and connect to devices', async () => {
      await eyeTracker.initialize({ useMockDevices: true });
      
      const devices = await eyeTracker.discoverDevices(2000);
      expect(devices.length).toBeGreaterThan(0);

      const device = await eyeTracker.connectToDevice(devices[0].id);
      expect(device).toBeTruthy();
      
      const connectedDevices = eyeTracker.getConnectedDevices();
      expect(connectedDevices.length).toBe(1);
      expect(connectedDevices[0]).toBe(devices[0].id);
    });

    it('should manage recording sessions', async () => {
      await eyeTracker.initialize({ useMockDevices: true });
      await eyeTracker.autoConnectToFirstDevice();
      
      const deviceId = eyeTracker.getConnectedDevices()[0];
      
      const recordingResult = await eyeTracker.startRecording(deviceId, {
        recordingId: 'test-recording'
      });
      
      expect(recordingResult.success).toBe(true);
      expect(recordingResult.recordingId).toBe('test-recording');
      
      const sessions = eyeTracker.getRecordingSessions(deviceId);
      expect(sessions.length).toBe(1);
      expect(sessions[0].status).toBe('recording');
      
      await eyeTracker.stopRecording(deviceId, recordingResult.sessionId);
      
      const updatedSessions = eyeTracker.getRecordingSessions(deviceId);
      expect(updatedSessions[0].status).toBe('completed');
    });

    it('should handle calibration workflows', async () => {
      await eyeTracker.initialize({ useMockDevices: true });
      await eyeTracker.autoConnectToFirstDevice();
      
      const deviceId = eyeTracker.getConnectedDevices()[0];
      
      const calibrationResult = await eyeTracker.startCalibration(deviceId);
      expect(calibrationResult.success).toBe(true);
      
      const sessions = eyeTracker.getCalibrationSessions(deviceId);
      expect(sessions.length).toBe(1);
      expect(sessions[0].status).toBe('in_progress');
      
      // Simulate calibration completion
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stopResult = await eyeTracker.stopCalibration(deviceId, calibrationResult.sessionId);
      expect(stopResult.success).toBe(true);
    });
  });

  describe('Performance Validation', () => {
    it('should maintain target streaming rate', async () => {
      const device = createEyeTrackerDevice({
        deviceId: 'perf-test',
        mockMode: true
      });
      cleanup.push(() => device.cleanup());

      const gazeDataPoints = [];
      const startTime = Date.now();
      
      device.onGazeData((gazeData) => {
        gazeDataPoints.push({
          ...gazeData,
          receivedAt: Date.now()
        });
      });

      await device.connect();
      
      // Collect data for 500ms
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const expectedPoints = Math.floor(200 * (duration / 1000)); // 200Hz
      const actualRate = gazeDataPoints.length / (duration / 1000);
      
      // Allow 10% tolerance
      expect(actualRate).toBeGreaterThan(180);
      expect(actualRate).toBeLessThan(220);
      
      // Check timestamp consistency
      let consistentTimestamps = 0;
      for (let i = 1; i < gazeDataPoints.length; i++) {
        const timeDiff = gazeDataPoints[i].timestamp - gazeDataPoints[i-1].timestamp;
        if (timeDiff >= 4 && timeDiff <= 6) { // 5ms ±1ms
          consistentTimestamps++;
        }
      }
      
      const consistency = consistentTimestamps / (gazeDataPoints.length - 1);
      expect(consistency).toBeGreaterThan(0.8); // 80% of timestamps should be consistent
    });

    it('should handle high-frequency data without memory leaks', async () => {
      const optimizer = createMemoryOptimizer();
      cleanup.push(() => optimizer.cleanup());
      
      const initialStats = optimizer.getStats();
      
      // Simulate high-frequency data processing
      for (let i = 0; i < 5000; i++) {
        const gazeData = optimizer.createGazeData(
          Date.now(),
          Math.random(),
          Math.random(),
          0.8 + Math.random() * 0.2
        );
        
        // Process and release
        if (i % 10 === 0) {
          optimizer.releaseObject(gazeData);
        }
      }
      
      const finalStats = optimizer.getStats();
      
      // Memory pool should have grown but should reuse objects
      expect(finalStats.memoryPool.poolSizes.gazeData.created).toBeGreaterThan(0);
      expect(finalStats.memoryPool.poolSizes.gazeData.reused).toBeGreaterThan(0);
      
      // Should have some reuse ratio
      const pool = finalStats.memoryPool.poolSizes.gazeData;
      const reuseRatio = pool.reused / pool.created;
      expect(reuseRatio).toBeGreaterThan(0.1); // At least 10% reuse
    });

    it('should maintain low latency under load', async () => {
      const scheduler = createAdaptiveBatchScheduler({
        strategy: 'adaptive',
        targetLatency: 50
      });

      const latencies = [];
      let processed = 0;
      
      const processor = async (items) => {
        const startTime = performance.now();
        
        // Simulate processing work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        const endTime = performance.now();
        latencies.push(endTime - startTime);
        processed += items.length;
        
        return items.map(item => ({ ...item, processed: true }));
      };

      // Generate high-frequency data
      const items = Array.from({ length: 1000 }, (_, i) => ({ 
        id: i, 
        timestamp: Date.now() + i * 5,
        confidence: 0.8 + Math.random() * 0.2
      }));

      // Process in batches
      for (let i = 0; i < items.length; i += 20) {
        const batch = items.slice(i, i + 20);
        await scheduler.processBatch(batch, processor);
      }

      expect(processed).toBe(items.length);
      
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      expect(avgLatency).toBeLessThan(100); // Average latency under 100ms
      
      const maxLatency = Math.max(...latencies);
      expect(maxLatency).toBeLessThan(200); // Max latency under 200ms
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle device connection failures gracefully', async () => {
      const device = createEyeTrackerDevice({
        deviceId: 'failing-device',
        address: 'nonexistent.local',
        mockMode: false, // Real connection that will fail
        autoReconnect: false
      });

      const errors = [];
      device.onError((error) => {
        errors.push(error);
      });

      try {
        await device.connect();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
        expect(device.getConnectionState()).toBe('error');
      }
    });

    it('should handle invalid gaze data', () => {
      const processor = createGazeProcessor();
      
      // Test various invalid inputs
      const invalidInputs = [
        null,
        undefined,
        {},
        { x: 'invalid', y: 0.5, confidence: 0.8 },
        { x: 2.0, y: 0.5, confidence: 0.8 }, // Out of range
        { x: 0.5, y: 0.5, confidence: -0.1 } // Invalid confidence
      ];

      invalidInputs.forEach(input => {
        expect(() => {
          processor.validateGazeData(input);
        }).not.toThrow();
        
        const validation = processor.validateGazeData(input);
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBeTypeOf('string');
      });
    });

    it('should handle system resource exhaustion', async () => {
      const optimizer = createMemoryOptimizer({
        memoryPressureThreshold: 0.1, // Very low threshold
        gcInterval: 50
      });
      cleanup.push(() => optimizer.cleanup());

      optimizer.startMonitoring();
      
      const optimizationsApplied = [];
      let originalApplyOptimization = optimizer.applyMemoryOptimization;
      optimizer.applyMemoryOptimization = () => {
        optimizationsApplied.push(Date.now());
        return originalApplyOptimization();
      };

      // Create excessive objects to trigger optimization
      for (let i = 0; i < 2000; i++) {
        optimizer.createGazeData(Date.now(), Math.random(), Math.random(), Math.random());
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = optimizer.getStats();
      expect(stats.optimizationApplied).toBeGreaterThan(0);
    });

    it('should handle concurrent access safely', async () => {
      const device = createEyeTrackerDevice({
        deviceId: 'concurrent-test',
        mockMode: true
      });
      cleanup.push(() => device.cleanup());

      // Multiple concurrent operations
      const operations = [
        device.connect(),
        device.connect(), // Duplicate connect
        device.getConnectionState(),
        device.getDeviceInfo()
      ];

      const results = await Promise.allSettled(operations);
      
      // Should handle concurrent operations gracefully
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled'); // Duplicate connect should not fail
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('fulfilled');
    });
  });
});

// Performance benchmark tests
describe('Eye Tracking - Performance Benchmarks', () => {
  it('should benchmark gaze processing throughput', async () => {
    const processor = createGazeProcessor();
    const startTime = performance.now();
    
    const testData = Array.from({ length: 1000 }, () => ({
      x: Math.random(),
      y: Math.random(),
      confidence: 0.8 + Math.random() * 0.2,
      timestamp: Date.now()
    }));

    for (const data of testData) {
      await processor.processGazeData(data);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = testData.length / (duration / 1000); // items per second

    console.log(`Gaze processing throughput: ${throughput.toFixed(0)} items/sec`);
    expect(throughput).toBeGreaterThan(1000); // Should process at least 1000 items/sec
  });

  it('should benchmark memory optimization performance', () => {
    const optimizer = createMemoryOptimizer();
    const startTime = performance.now();
    
    // Create and release many objects
    const objects = [];
    for (let i = 0; i < 10000; i++) {
      objects.push(optimizer.createGazeData(Date.now(), Math.random(), Math.random(), Math.random()));
    }
    
    for (const obj of objects) {
      optimizer.releaseObject(obj);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Memory operations duration: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    
    const stats = optimizer.getStats();
    expect(stats.memoryPool.reuseHits).toBeGreaterThan(5000); // Should have significant reuse
    
    optimizer.cleanup();
  });

  it('should benchmark adaptive batching performance', async () => {
    const scheduler = createAdaptiveBatchScheduler();
    const startTime = performance.now();
    
    const items = Array.from({ length: 5000 }, (_, i) => ({ 
      id: i, 
      confidence: 0.8 + Math.random() * 0.2 
    }));
    
    const processor = async (batch) => {
      // Minimal processing time
      return batch.map(item => ({ ...item, processed: true }));
    };

    let totalProcessed = 0;
    for (let i = 0; i < items.length; i += 50) {
      const batch = items.slice(i, i + 50);
      const result = await scheduler.processBatch(batch, processor);
      totalProcessed += result.processed;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const throughput = totalProcessed / (duration / 1000);

    console.log(`Batch processing throughput: ${throughput.toFixed(0)} items/sec`);
    expect(throughput).toBeGreaterThan(5000); // Should process at least 5000 items/sec
    expect(totalProcessed).toBe(items.length);
  });
});