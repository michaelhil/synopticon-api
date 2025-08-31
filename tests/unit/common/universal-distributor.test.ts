/**
 * Unit tests for Universal Distributor
 * Testing multi-data-type distribution with factory function pattern
 */

import { expect, test, describe, beforeEach } from 'bun:test';
import { createUniversalDistributor } from '../../../src/core/common/distribution/universal-distributor';
import type { FrameData, TelemetryFrame, ClientSubscription } from '../../../src/core/common/distribution/universal-distributor';

describe('Universal Distributor', () => {
  let distributor: ReturnType<typeof createUniversalDistributor>;

  beforeEach(() => {
    distributor = createUniversalDistributor({
      maxClients: 10,
      bufferSize: 100
    });
  });

  test('creates distributor with correct configuration', () => {
    expect(distributor).toBeDefined();
    expect(typeof distributor.addClient).toBe('function');
    expect(typeof distributor.distribute).toBe('function');
    expect(distributor.getClientCount()).toBe(0);
  });

  test('adds and removes clients correctly', () => {
    const subscription: ClientSubscription = {
      clientId: 'test-client-1',
      dataTypes: ['frame', 'telemetry']
    };

    const added = distributor.addClient(subscription);
    expect(added).toBe(true);
    expect(distributor.getClientCount()).toBe(1);

    const removed = distributor.removeClient('test-client-1');
    expect(removed).toBe(true);
    expect(distributor.getClientCount()).toBe(0);
  });

  test('distributes frame data to interested clients', async () => {
    const frameSubscription: ClientSubscription = {
      clientId: 'frame-client',
      dataTypes: ['frame']
    };

    distributor.addClient(frameSubscription);

    const frameData: FrameData = {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: 1,
      sourceId: 'camera-1',
      sourceType: 'sensor',
      width: 640,
      height: 480,
      format: 'rgb',
      data: new Uint8Array(640 * 480 * 3)
    };

    const result = await distributor.distributeFrameData(frameData);
    
    expect(result.success).toBe(true);
    expect(result.clientsReached).toBe(1);
    expect(result.duration).toBeGreaterThan(0);
  });

  test('distributes telemetry data to interested clients', async () => {
    const telemetrySubscription: ClientSubscription = {
      clientId: 'telemetry-client', 
      dataTypes: ['telemetry']
    };

    distributor.addClient(telemetrySubscription);

    const telemetryData: TelemetryFrame = {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: 1,
      sourceId: 'msfs-1',
      sourceType: 'telemetry',
      simulator: 'msfs',
      vehicle: {
        position: [0, 0, 10000],
        velocity: [100, 0, 0],
        rotation: [0, 0, 0, 1],
        heading: 90
      }
    };

    const result = await distributor.distributeTelemetryData(telemetryData);
    
    expect(result.success).toBe(true);
    expect(result.clientsReached).toBe(1);
  });

  test('tracks statistics correctly', async () => {
    const subscription: ClientSubscription = {
      clientId: 'stats-client',
      dataTypes: ['telemetry']
    };

    distributor.addClient(subscription);

    const telemetryData: TelemetryFrame = {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: 1,
      sourceId: 'test-sim',
      sourceType: 'telemetry',
      simulator: 'beamng',
      vehicle: {
        position: [100, 200, 0],
        velocity: [20, 0, 0],
        rotation: [0, 0, 0.707, 0.707],
        heading: 45
      }
    };

    await distributor.distributeTelemetryData(telemetryData);
    
    const stats = distributor.getStats();
    expect(stats.totalSent).toBe(1);
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.clientCount).toBe(1);
  });

  test('cleans up resources properly', async () => {
    const subscription: ClientSubscription = {
      clientId: 'cleanup-client',
      dataTypes: ['frame']
    };

    distributor.addClient(subscription);
    expect(distributor.getClientCount()).toBe(1);

    await distributor.cleanup();
    expect(distributor.getClientCount()).toBe(0);
    
    const stats = distributor.getStats();
    expect(stats.clientCount).toBe(0);
  });
});