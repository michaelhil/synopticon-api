/**
 * Multi-modal System Integration Test
 * Tests the complete sensor + telemetry + correlation pipeline
 */

import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { createUniversalDistributor } from '../../src/core/common/distribution/universal-distributor';
import { createCameraSensor } from '../../src/core/sensors/camera';
import { createMSFSConnector } from '../../src/core/telemetry/simulators/msfs-connector';
import { createTelemetryStreamingService } from '../../src/core/telemetry/streaming';
import { createCorrelationEngine } from '../../src/core/telemetry/correlation';
import type { FrameData, TelemetryFrame, CorrelatedFrame } from '../../src/core/common/types';

describe('Multi-modal System Integration', () => {
  test('end-to-end sensor-telemetry correlation', async () => {
    // Initialize components
    const distributor = createUniversalDistributor({ maxClients: 10 });
    const telemetryStreaming = createTelemetryStreamingService({
      bufferSize: 50,
      compressionEnabled: true,
      reliability: 'guaranteed',
      maxClients: 5
    });
    
    const correlationEngine = createCorrelationEngine({
      timeWindow: 1000,
      confidenceThreshold: 0.3,
      enableStressAnalysis: true,
      enablePerformanceAnalysis: true
    });

    const msfsConnector = createMSFSConnector({ updateRate: 10 });

    // Connect telemetry source
    await msfsConnector.connect();
    expect(msfsConnector.isConnected()).toBe(true);

    // Collect data for correlation
    const sensorFrames: FrameData[] = [];
    const telemetryFrames: TelemetryFrame[] = [];

    // Generate mock sensor data
    const mockSensorFrame: FrameData = {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: 1,
      sourceId: 'integration-camera',
      sourceType: 'sensor',
      width: 1920,
      height: 1080,
      format: 'rgb',
      data: new Uint8Array(1920 * 1080 * 3)
    };
    sensorFrames.push(mockSensorFrame);

    // Collect telemetry data
    const telemetryPromise = new Promise<void>((resolve) => {
      const unsubscribe = msfsConnector.subscribe((frame: TelemetryFrame) => {
        telemetryFrames.push(frame);
        telemetryStreaming.processFrame(frame);
        
        if (telemetryFrames.length >= 2) {
          unsubscribe();
          resolve();
        }
      });
    });

    await telemetryPromise;

    // Verify we have telemetry data
    expect(telemetryFrames).toHaveLength(2);
    expect(telemetryFrames[0].simulator).toBe('msfs');
    expect(telemetryFrames[0].vehicle).toBeDefined();

    // Test correlation
    const correlationResult = await correlationEngine.correlate(sensorFrames, telemetryFrames);
    expect(correlationResult).toBeDefined();
    expect(correlationResult!.sensors).toHaveLength(1);
    expect(correlationResult!.telemetry).toHaveLength(2);
    expect(correlationResult!.derived).toBeDefined();
    expect(correlationResult!.confidence).toBeGreaterThan(0);

    // Add a client for distribution
    distributor.addClient({
      clientId: 'integration-test-client',
      dataTypes: ['correlated']
    });
    
    // Test data distribution
    const distributionResult = await distributor.distribute(correlationResult as any);
    expect(distributionResult.success).toBe(true);
    expect(distributionResult.clientsReached).toBe(1);

    // Verify streaming metrics
    const streamingMetrics = telemetryStreaming.getMetrics();
    expect(streamingMetrics.framesProcessed).toBe(2);
    expect(streamingMetrics.bytesStreamed).toBeGreaterThan(0);

    // Verify correlation metrics
    const correlationMetrics = correlationEngine.getMetrics();
    expect(correlationMetrics.totalCorrelations).toBe(1);
    expect(correlationMetrics.processingLatency).toBeGreaterThan(0);

    // Cleanup
    await msfsConnector.disconnect();
    await telemetryStreaming.cleanup();
    await distributor.cleanup();
  });

  test('handles high-frequency data streams', async () => {
    const streamingService = createTelemetryStreamingService({
      bufferSize: 100,
      compressionEnabled: false,
      reliability: 'best-effort',
      maxClients: 1
    });

    const connector = createMSFSConnector({ updateRate: 50 }); // 50 Hz
    await connector.connect();

    let frameCount = 0;
    const startTime = Date.now();

    const dataPromise = new Promise<void>((resolve) => {
      const unsubscribe = connector.subscribe((frame: TelemetryFrame) => {
        streamingService.processFrame(frame);
        frameCount++;
        
        if (frameCount >= 10) {
          unsubscribe();
          resolve();
        }
      });
    });

    await dataPromise;

    const elapsed = Date.now() - startTime;
    const metrics = streamingService.getMetrics();
    
    expect(frameCount).toBe(10);
    expect(metrics.framesProcessed).toBe(10);
    expect(metrics.dataRate).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000); // Should process 10 frames in under 1 second

    // Test buffer functionality
    const recentFrames = streamingService.getRecentFrames(5);
    expect(recentFrames).toHaveLength(5);

    await connector.disconnect();
    await streamingService.cleanup();
  });

  test('multi-simulator correlation', async () => {
    const correlationEngine = createCorrelationEngine({
      timeWindow: 500,
      confidenceThreshold: 0.2,
      enableStressAnalysis: true,
      enablePerformanceAnalysis: true
    });

    // Create multiple simulators
    const msfsConnector = createMSFSConnector({ updateRate: 20 });
    
    await msfsConnector.connect();

    const telemetryFrames: TelemetryFrame[] = [];
    const sensorFrames: FrameData[] = [];

    // Generate multiple sensor frames
    for (let i = 0; i < 3; i++) {
      sensorFrames.push({
        timestamp: BigInt((Date.now() + i * 10) * 1000),
        sequenceNumber: i,
        sourceId: `camera-${i}`,
        sourceType: 'sensor',
        width: 640,
        height: 480,
        format: 'rgb',
        data: new Uint8Array(640 * 480 * 3)
      });
    }

    // Collect telemetry from MSFS
    const telemetryPromise = new Promise<void>((resolve) => {
      const unsubscribe = msfsConnector.subscribe((frame: TelemetryFrame) => {
        telemetryFrames.push(frame);
        
        if (telemetryFrames.length >= 3) {
          unsubscribe();
          resolve();
        }
      });
    });

    await telemetryPromise;

    // Test correlation with multiple data sources
    const result = await correlationEngine.correlate(sensorFrames, telemetryFrames);
    
    expect(result).toBeDefined();
    expect(result!.sensors).toHaveLength(3);
    expect(result!.telemetry).toHaveLength(3);
    expect(result!.derived.workloadIndex).toBeGreaterThan(0.4); // Higher workload with more data
    expect(result!.events).toBeDefined();

    // Verify cross-modal events can be generated
    if (result!.events.length > 0) {
      const event = result!.events[0];
      expect(event.type).toBeDefined();
      expect(event.sources.length).toBeGreaterThan(0);
      expect(event.confidence).toBeGreaterThan(0);
    }

    await msfsConnector.disconnect();
  });
});