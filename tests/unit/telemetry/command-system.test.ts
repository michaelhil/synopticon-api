/**
 * Unit tests for universal command system
 * Testing standardized simulator commands and event system
 */

import { expect, test, describe, beforeEach } from 'bun:test';
import {
  createCommand,
  createFlightCommand,
  createVehicleCommand,
  createCommandQueue,
  createEventEmitter,
  FLIGHT_COMMANDS,
  VEHICLE_COMMANDS,
  validateCommand,
  VALIDATORS
} from '../../../src/core/telemetry/commands/command-system';
import { createMSFSConnector } from '../../../src/core/telemetry/simulators/msfs-connector';
import { createBeamNGConnector } from '../../../src/core/telemetry/simulators/beamng-connector';

describe('Command System', () => {
  test('creates basic commands correctly', () => {
    const command = createCommand('flight-control', 'test-action', { value: 0.5 });
    
    expect(command.type).toBe('flight-control');
    expect(command.action).toBe('test-action');
    expect(command.parameters?.value).toBe(0.5);
    expect(command.priority).toBe('normal');
    expect(command.id).toBeDefined();
    expect(command.timestamp).toBeDefined();
  });

  test('creates flight commands with factory', () => {
    const command = createFlightCommand(FLIGHT_COMMANDS.SET_THROTTLE, { value: 0.8 });
    
    expect(command.type).toBe('flight-control');
    expect(command.action).toBe(FLIGHT_COMMANDS.SET_THROTTLE);
    expect(command.parameters?.value).toBe(0.8);
  });

  test('creates vehicle commands with factory', () => {
    const command = createVehicleCommand(VEHICLE_COMMANDS.SET_STEERING, { angle: -0.3 });
    
    expect(command.type).toBe('vehicle-control');
    expect(command.action).toBe(VEHICLE_COMMANDS.SET_STEERING);
    expect(command.parameters?.angle).toBe(-0.3);
  });

  test('validates commands correctly', () => {
    const validCommand = createCommand('flight-control', 'test', {});
    const validation = validateCommand(validCommand);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('validates command parameters', () => {
    expect(VALIDATORS.throttle(0.5)).toBe(true);
    expect(VALIDATORS.throttle(1.5)).toBe(false);
    expect(VALIDATORS.angle(-0.5)).toBe(true);
    expect(VALIDATORS.angle(2)).toBe(false);
    expect(VALIDATORS.heading(180)).toBe(true);
    expect(VALIDATORS.heading(400)).toBe(false);
  });
});

describe('Command Queue', () => {
  let queue: ReturnType<typeof createCommandQueue>;

  beforeEach(() => {
    queue = createCommandQueue(5);
  });

  test('adds and retrieves commands', () => {
    const command = createCommand('flight-control', 'test', {});
    
    expect(queue.add(command)).toBe(true);
    expect(queue.size()).toBe(1);
    
    const retrieved = queue.next();
    expect(retrieved?.id).toBe(command.id);
    expect(queue.size()).toBe(0);
  });

  test('respects priority ordering', () => {
    const lowPri = createCommand('flight-control', 'low', {}, { priority: 'low' });
    const highPri = createCommand('flight-control', 'high', {}, { priority: 'high' });
    const normalPri = createCommand('flight-control', 'normal', {});
    
    queue.add(lowPri);
    queue.add(normalPri);
    queue.add(highPri);
    
    expect(queue.next()?.action).toBe('high');
    expect(queue.next()?.action).toBe('normal');
    expect(queue.next()?.action).toBe('low');
  });

  test('handles queue overflow', () => {
    // Fill queue to capacity
    for (let i = 0; i < 5; i++) {
      const cmd = createCommand('flight-control', `cmd${i}`, {});
      expect(queue.add(cmd)).toBe(true);
    }
    
    // Add one more normal priority - should replace oldest
    const newCmd = createCommand('flight-control', 'new', {});
    expect(queue.add(newCmd)).toBe(true);
    expect(queue.size()).toBe(5);
  });
});

describe('Event Emitter', () => {
  let emitter: ReturnType<typeof createEventEmitter>;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  test('subscribes and emits events', () => {
    let received = null;
    
    emitter.on('test-event', (event) => {
      received = event;
    });
    
    const testEvent = {
      id: 'test',
      type: 'test-event' as const,
      timestamp: Date.now(),
      source: 'test',
      data: { message: 'hello' }
    };
    
    emitter.emit(testEvent);
    expect(received).toEqual(testEvent);
  });

  test('handles multiple subscribers', () => {
    let count = 0;
    
    emitter.on('test', () => count++);
    emitter.on('test', () => count++);
    
    emitter.emit({
      id: 'test',
      type: 'test',
      timestamp: Date.now(),
      source: 'test',
      data: {}
    });
    
    expect(count).toBe(2);
  });

  test('unsubscribes correctly', () => {
    let count = 0;
    const unsubscribe = emitter.on('test', () => count++);
    
    emitter.emit({
      id: 'test',
      type: 'test',
      timestamp: Date.now(),
      source: 'test',
      data: {}
    });
    expect(count).toBe(1);
    
    unsubscribe();
    emitter.emit({
      id: 'test',
      type: 'test',
      timestamp: Date.now(),
      source: 'test',
      data: {}
    });
    expect(count).toBe(1); // Should not increment
  });
});

describe('Simulator Command Integration', () => {
  test('MSFS connector has command capabilities', async () => {
    const msfsConnector = createMSFSConnector({
      useNativeProtocol: false,
      fallbackToMock: true
    });
    
    await msfsConnector.connect();
    
    // Check if command methods exist (should always be present)
    expect(typeof msfsConnector.sendCommand).toBe('function');
    expect(typeof msfsConnector.getCapabilities).toBe('function');
    expect(typeof msfsConnector.subscribeToEvents).toBe('function');
    
    // Check capabilities (in mock mode, capabilities may be limited)
    const capabilities = msfsConnector.getCapabilities!();
    expect(capabilities).toBeDefined();
    expect(Array.isArray(capabilities.supportedTypes)).toBe(true);
    expect(typeof capabilities.supportedActions).toBe('object');
    
    await msfsConnector.disconnect();
  });

  test('BeamNG connector has vehicle command capabilities', async () => {
    const beamngConnector = createBeamNGConnector({
      useRealProtocol: false,
      fallbackToMock: true
    });
    
    await beamngConnector.connect();
    
    // Check if command methods exist
    expect(typeof beamngConnector.sendCommand).toBe('function');
    expect(typeof beamngConnector.getCapabilities).toBe('function');
    
    // Check capabilities
    const capabilities = beamngConnector.getCapabilities!();
    expect(capabilities.supportedTypes).toContain('vehicle-control');
    expect(capabilities.supportedActions['vehicle-control']).toContain(VEHICLE_COMMANDS.SET_STEERING);
    
    await beamngConnector.disconnect();
  });

  test('Command execution returns proper results', async () => {
    const msfsConnector = createMSFSConnector({
      useNativeProtocol: false,
      fallbackToMock: true
    });
    
    await msfsConnector.connect();
    
    const command = createFlightCommand(FLIGHT_COMMANDS.SET_THROTTLE, { value: 0.75 });
    const result = await msfsConnector.sendCommand!(command);
    
    expect(result).toBeDefined();
    expect(result.commandId).toBe(command.id);
    expect(typeof result.success).toBe('boolean');
    expect(result.executedAt).toBeDefined();
    
    await msfsConnector.disconnect();
  });
});