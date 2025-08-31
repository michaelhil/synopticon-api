/**
 * Unit tests for telemetry infrastructure
 * Testing simulator connectors, streaming, and correlation
 */

import { expect, test, describe, beforeEach } from 'bun:test';
import { 
  createTelemetryManager,
  createMSFSConnector,
  createBeamNGConnector,
  createXPlaneConnector,
  createVATSIMConnector
} from '../../../src/core/telemetry';
import { createTelemetryStreamingService } from '../../../src/core/telemetry/streaming';
import { createCorrelationEngine } from '../../../src/core/telemetry/correlation';
import type { FrameData, TelemetryFrame } from '../../../src/core/common/types';

describe('Telemetry Manager', () => {
  let manager: ReturnType<typeof createTelemetryManager>;

  beforeEach(() => {
    manager = createTelemetryManager();
  });

  test('creates manager with correct methods', () => {
    expect(manager).toBeDefined();
    expect(typeof manager.addConnection).toBe('function');
    expect(typeof manager.removeConnection).toBe('function');
    expect(typeof manager.getConnection).toBe('function');
    expect(typeof manager.listConnections).toBe('function');
    expect(manager.size()).toBe(0);
  });

  test('manages connections correctly', () => {
    const connection = {
      id: 'test-msfs',
      simulator: 'msfs' as const,
      status: 'connected' as const,
      lastData: Date.now(),
      reliability: 0.95
    };

    manager.addConnection('test-msfs', connection);
    expect(manager.size()).toBe(1);
    expect(manager.getConnection('test-msfs')).toEqual(connection);
    
    const removed = manager.removeConnection('test-msfs');
    expect(removed).toBe(true);
    expect(manager.size()).toBe(0);
  });

  test('filters healthy connections', () => {
    manager.addConnection('good', {
      id: 'good',
      simulator: 'msfs',
      status: 'connected',
      lastData: Date.now(),
      reliability: 0.9
    });

    manager.addConnection('bad', {
      id: 'bad', 
      simulator: 'beamng',
      status: 'error',
      lastData: Date.now(),
      reliability: 0.3
    });

    const healthy = manager.getHealthyConnections();
    expect(healthy).toHaveLength(1);
    expect(healthy[0].id).toBe('good');
  });
});

describe('MSFS Connector', () => {
  test('creates connector with configuration', () => {
    const connector = createMSFSConnector({
      endpoint: 'localhost',
      port: 500,
      updateRate: 30
    });

    expect(connector).toBeDefined();
    expect(connector.id).toBe('msfs-connector');
    expect(connector.simulator).toBe('msfs');
    expect(typeof connector.connect).toBe('function');
    expect(typeof connector.subscribe).toBe('function');
  });

  test('connects and streams data', async () => {
    const connector = createMSFSConnector({ updateRate: 100 });
    
    const connected = await connector.connect();
    expect(connected).toBe(true);
    expect(connector.isConnected()).toBe(true);

    let dataReceived = false;
    const unsubscribe = connector.subscribe((data: TelemetryFrame) => {
      expect(data.simulator).toBe('msfs');
      expect(data.sourceType).toBe('telemetry');
      expect(data.vehicle).toBeDefined();
      dataReceived = true;
    });

    // Wait for data
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(dataReceived).toBe(true);

    unsubscribe();
    await connector.disconnect();
    expect(connector.isConnected()).toBe(false);
  });

  test('tracks connection status', async () => {
    const connector = createMSFSConnector();
    await connector.connect();
    
    const status = connector.getStatus();
    expect(status.connected).toBe(true);
    expect(status.reliability).toBeGreaterThan(0.8);
    expect(status.errors).toBe(0);
  });
});

describe('BeamNG Connector', () => {
  test('creates connector with vehicle physics data', async () => {
    const connector = createBeamNGConnector({ updateRate: 50 });
    
    await connector.connect();
    expect(connector.isConnected()).toBe(true);

    let receivedData = false;
    connector.subscribe((data: TelemetryFrame) => {
      expect(data.simulator).toBe('beamng');
      expect(data.vehicle.position).toHaveLength(3);
      expect(data.vehicle.velocity).toHaveLength(3);
      expect(data.controls?.throttle).toBeGreaterThanOrEqual(0);
      expect(data.performance?.speed).toBeGreaterThanOrEqual(0);
      receivedData = true;
    });

    await new Promise(resolve => setTimeout(resolve, 30));
    expect(receivedData).toBe(true);
    
    await connector.disconnect();
  });
});

describe('X-Plane Connector', () => {
  test('creates X-Plane flight data stream', async () => {
    const connector = createXPlaneConnector({ updateRate: 60 });
    
    await connector.connect();
    
    let dataCount = 0;
    connector.subscribe((data: TelemetryFrame) => {
      expect(data.simulator).toBe('xplane');
      expect(data.vehicle.heading).toBeGreaterThanOrEqual(0);
      expect(data.performance?.speed).toBeGreaterThan(0);
      dataCount++;
    });

    await new Promise(resolve => setTimeout(resolve, 40));
    expect(dataCount).toBeGreaterThan(0);
    
    await connector.disconnect();
  });
});

describe('VATSIM Connector', () => {
  test('creates network data stream', async () => {
    // Use mock mode for testing to avoid depending on real VATSIM API
    const connector = createVATSIMConnector({ 
      callsign: 'TEST123', 
      enableRealConnection: false, 
      fallbackToMock: true 
    });
    
    let networkData = false;
    
    // Set up subscriber first
    connector.subscribe((data: TelemetryFrame) => {
      expect(data.simulator).toBe('vatsim');
      expect(data.sourceType).toBe('telemetry');
      expect(data.vehicle).toBeDefined();
      expect(data.vehicle.position).toHaveLength(3);
      expect(data.vehicle.velocity).toHaveLength(3);
      expect(data.metadata?.callsign).toBeDefined();
      networkData = true;
    });

    await connector.connect();

    // Wait for the initial data call from stream processor
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(networkData).toBe(true);
    
    await connector.disconnect();
  });

  test('handles real VATSIM API connection', async () => {
    const connector = createVATSIMConnector({ 
      enableRealConnection: true, 
      fallbackToMock: true 
    });
    
    const connected = await connector.connect();
    expect(connected).toBe(true);
    
    const status = connector.getStatus();
    expect(status.connected).toBe(true);
    expect(typeof status.clientsOnline).toBe('number');
    expect(status.dataMode).toBe('real');
    
    await connector.disconnect();
    expect(connector.isConnected()).toBe(false);
  });
});

describe('Telemetry Streaming Service', () => {
  test('creates streaming service with buffer', () => {
    const service = createTelemetryStreamingService({
      bufferSize: 100,
      compressionEnabled: true,
      reliability: 'guaranteed',
      maxClients: 10
    });

    expect(service).toBeDefined();
    expect(typeof service.processFrame).toBe('function');
    expect(typeof service.addClient).toBe('function');
    expect(typeof service.getRecentFrames).toBe('function');
  });

  test('processes and buffers telemetry frames', async () => {
    const service = createTelemetryStreamingService({
      bufferSize: 50,
      compressionEnabled: false,
      reliability: 'best-effort',
      maxClients: 5
    });

    const mockFrame: TelemetryFrame = {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: 1,
      sourceId: 'test-sim',
      sourceType: 'telemetry',
      simulator: 'msfs',
      vehicle: {
        position: [0, 0, 10000],
        velocity: [100, 0, 0],
        rotation: [0, 0, 0, 1],
        heading: 90
      }
    };

    await service.processFrame(mockFrame);
    
    const recentFrames = service.getRecentFrames(1);
    expect(recentFrames).toHaveLength(1);
    expect(recentFrames[0].sourceId).toBe('test-sim');

    const metrics = service.getMetrics();
    expect(metrics.framesProcessed).toBe(1);
    expect(metrics.averageLatency).toBeGreaterThan(0);
  });

  test('manages clients', () => {
    const service = createTelemetryStreamingService({
      bufferSize: 10,
      compressionEnabled: true,
      reliability: 'guaranteed',
      maxClients: 3
    });

    const added = service.addClient('test-client-1');
    expect(added).toBe(true);

    const removed = service.removeClient('test-client-1');
    expect(removed).toBe(true);
  });
});

describe('Correlation Engine', () => {
  test('creates correlation engine', () => {
    const engine = createCorrelationEngine({
      timeWindow: 100,
      confidenceThreshold: 0.5,
      enableStressAnalysis: true,
      enablePerformanceAnalysis: true
    });

    expect(engine).toBeDefined();
    expect(typeof engine.correlate).toBe('function');
    expect(typeof engine.getMetrics).toBe('function');
  });

  test('correlates sensor and telemetry data', async () => {
    const engine = createCorrelationEngine({
      timeWindow: 1000,
      confidenceThreshold: 0.3,
      enableStressAnalysis: true,
      enablePerformanceAnalysis: true
    });

    const mockSensorFrame: FrameData = {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: 1,
      sourceId: 'camera-1',
      sourceType: 'sensor',
      width: 640,
      height: 480,
      format: 'rgb',
      data: new Uint8Array(640 * 480 * 3)
    };

    const mockTelemetryFrame: TelemetryFrame = {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: 1,
      sourceId: 'msfs-1',
      sourceType: 'telemetry',
      simulator: 'msfs',
      vehicle: {
        position: [0, 0, 10000],
        velocity: [200, 0, -5],
        acceleration: [2, 0, -1],
        rotation: [0, 0, 0, 1],
        heading: 90
      },
      controls: {
        throttle: 0.8,
        brake: 0.1,
        steering: 0.2
      }
    };

    const result = await engine.correlate([mockSensorFrame], [mockTelemetryFrame]);
    
    expect(result).toBeDefined();
    expect(result!.sensors).toHaveLength(1);
    expect(result!.telemetry).toHaveLength(1);
    expect(result!.derived).toBeDefined();
    expect(result!.confidence).toBeGreaterThan(0);
    
    if (result!.derived.stressLevel !== undefined) {
      expect(result!.derived.stressLevel).toBeGreaterThanOrEqual(0);
      expect(result!.derived.stressLevel).toBeLessThanOrEqual(1);
    }

    const metrics = engine.getMetrics();
    expect(metrics.totalCorrelations).toBe(1);
    expect(metrics.processingLatency).toBeGreaterThan(0);
  });

  test('handles empty data gracefully', async () => {
    const engine = createCorrelationEngine({
      timeWindow: 100,
      confidenceThreshold: 0.5,
      enableStressAnalysis: false,
      enablePerformanceAnalysis: false
    });

    const result = await engine.correlate([], []);
    expect(result).toBeNull();
    
    const metrics = engine.getMetrics();
    expect(metrics.totalCorrelations).toBe(1);
  });

  test('resets metrics', () => {
    const engine = createCorrelationEngine({
      timeWindow: 100,
      confidenceThreshold: 0.5,
      enableStressAnalysis: true,
      enablePerformanceAnalysis: true
    });

    // Get initial metrics to trigger correlation count
    const initialMetrics = engine.getMetrics();
    
    engine.reset();
    
    const resetMetrics = engine.getMetrics();
    expect(resetMetrics.totalCorrelations).toBe(0);
    expect(resetMetrics.successfulCorrelations).toBe(0);
    expect(resetMetrics.averageConfidence).toBe(0);
  });
});