/**
 * BeamNG.drive Telemetry Connector
 * Real-time vehicle physics data from BeamNG.drive with bi-directional control
 */

import type { TelemetryFrame } from '../../common/types';
import type { SimulatorConnector, SimulatorCommand, CommandResult, CommandCapabilities, SimulatorEvent } from './index';
import { createBeamNGProtocolClient, type BeamNGVehicleData, type BeamNGConnectionConfig } from './beamng-protocol';
import { VEHICLE_COMMANDS, createCommandQueue, createEventEmitter } from '../commands/command-system';

export interface BeamNGConfig {
  endpoint?: string;
  port?: number;
  updateRate?: number;
  vehicleId?: string;
  useRealProtocol?: boolean;
  fallbackToMock?: boolean;
  protocol?: 'tcp' | 'udp';
  timeout?: number;
  reconnectDelay?: number;
}

// BeamNG-specific data structures (for mock fallback)
interface BeamNGData {
  position: [number, number, number];
  velocity: [number, number, number];
  acceleration: [number, number, number];
  rotation: [number, number, number, number];
  wheelSpeed: number[];
  engineRpm: number;
  throttle: number;
  brake: number;
  steering: number;
  gear: number;
  fuel: number;
  damage: number;
}

// Convert mock BeamNG data to universal telemetry format
const convertBeamNGToTelemetry = (beamData: BeamNGData, sequenceNumber: number): TelemetryFrame => ({
  timestamp: BigInt(Date.now() * 1000),
  sequenceNumber,
  sourceId: 'beamng-drive-mock',
  sourceType: 'telemetry',
  simulator: 'beamng',
  vehicle: {
    position: beamData.position,
    velocity: beamData.velocity,
    acceleration: beamData.acceleration,
    rotation: beamData.rotation,
    heading: Math.atan2(beamData.rotation[1], beamData.rotation[0]) * 180 / Math.PI
  },
  controls: {
    throttle: beamData.throttle,
    brake: beamData.brake,
    steering: beamData.steering,
    gear: beamData.gear
  },
  performance: {
    speed: Math.sqrt(beamData.velocity[0]**2 + beamData.velocity[1]**2 + beamData.velocity[2]**2),
    fuel: beamData.fuel,
    engineRpm: beamData.engineRpm,
    damage: beamData.damage
  },
  metadata: {
    vehicleId: 'mock_vehicle',
    dataSource: 'Mock Data'
  }
});

// Factory function for BeamNG connector
export const createBeamNGConnector = (config: BeamNGConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'localhost',
    port: 64256,
    updateRate: 60,
    vehicleId: 'ego_vehicle',
    useRealProtocol: false, // Disabled by default until tested
    fallbackToMock: true,
    protocol: 'tcp' as const,
    timeout: 5000,
    reconnectDelay: 3000,
    ...config
  };

  let isConnected = false;
  let sequenceNumber = 0;
  let subscribers: Array<(data: TelemetryFrame) => void> = [];
  const connectionStats = {
    lastData: 0,
    reliability: 1.0,
    errors: 0
  };
  let protocolClient: ReturnType<typeof createBeamNGProtocolClient> | null = null;
  let mockInterval: Timer | null = null;
  const commandQueue = createCommandQueue();
  const eventEmitter = createEventEmitter();

  // Mock vehicle state for simulation
  const vehicleState = {
    x: 0, y: 0, z: 0,
    speed: 0,
    heading: 0,
    throttle: 0,
    brake: 0,
    steering: 0,
    gear: 1
  };

  // Connect to BeamNG.drive
  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to BeamNG.drive on ${settings.endpoint}:${settings.port}`);
      
      if (settings.useRealProtocol) {
        const protocolConfig: BeamNGConnectionConfig = {
          host: settings.endpoint,
          port: settings.port,
          protocol: settings.protocol,
          timeout: settings.timeout,
          reconnectDelay: settings.reconnectDelay,
          heartbeatInterval: 1000 / settings.updateRate
        };
        
        protocolClient = createBeamNGProtocolClient(protocolConfig);
        const connected = await protocolClient.connect();
        
        if (connected) {
          console.log('BeamNG connected via real protocol');
          setupRealDataStream();
          isConnected = true;
          return true;
        } else if (settings.fallbackToMock) {
          console.warn('BeamNG real protocol failed, using mock data');
          isConnected = true;
          startMockDataStream();
          return true;
        }
        return false;
      } else {
        // Direct mock mode
        isConnected = true;
        startMockDataStream();
        return true;
      }
    } catch (error) {
      console.error('BeamNG connection failed:', error);
      connectionStats.errors++;
      
      if (settings.fallbackToMock) {
        console.warn('BeamNG connection error, using mock data');
        isConnected = true;
        startMockDataStream();
        return true;
      }
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    
    if (protocolClient) {
      await protocolClient.disconnect();
      protocolClient = null;
    }
    
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
    }
    
    subscribers = [];
    console.log('BeamNG connection closed');
  };

  // Set up real protocol data streaming
  const setupRealDataStream = () => {
    if (!protocolClient) return;
    
    protocolClient.onData((vehicleData: BeamNGVehicleData) => {
      const telemetryFrame = convertRealDataToTelemetry(vehicleData);
      connectionStats.lastData = Date.now();
      
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('BeamNG real data subscriber error:', error);
          connectionStats.errors++;
        }
      });
    });
    
    protocolClient.subscribeToEvents((event: SimulatorEvent) => {
      eventEmitter.emit(event);
    });
  };
  
  // Simulate BeamNG vehicle physics data (fallback)
  const startMockDataStream = () => {
    mockInterval = setInterval(() => {
      if (!isConnected) {
        if (mockInterval) clearInterval(mockInterval);
        return;
      }

      // Simulate realistic vehicle physics
      const timestamp = Date.now();
      const speed = 25 + Math.sin(timestamp / 5000) * 15; // Variable speed
      const turning = Math.sin(timestamp / 3000) * 0.3; // Gentle turning
      
      // Update mock vehicle state
      vehicleState.x += Math.cos(vehicleState.heading) * speed * 0.016;
      vehicleState.y += Math.sin(vehicleState.heading) * speed * 0.016;
      vehicleState.heading += turning * 0.016;
      vehicleState.speed = speed;
      
      const mockData: BeamNGData = {
        position: [vehicleState.x, vehicleState.y, 0.5],
        velocity: [speed * Math.cos(turning), speed * Math.sin(turning), 0],
        acceleration: [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0],
        rotation: [0, 0, turning, 1],
        wheelSpeed: [speed, speed, speed, speed],
        engineRpm: Math.max(800, speed * 50 + Math.random() * 200),
        throttle: Math.max(0.1, (speed - 10) / 30),
        brake: Math.random() > 0.9 ? 0.3 : 0,
        steering: turning,
        gear: speed > 5 ? Math.floor(speed / 20) + 1 : 1,
        fuel: 0.8 - (timestamp % 300000) / 500000,
        damage: Math.random() * 0.1
      };

      const telemetryFrame = convertBeamNGToTelemetry(mockData, sequenceNumber++);
      connectionStats.lastData = Date.now();
      
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('BeamNG mock subscriber error:', error);
          connectionStats.errors++;
        }
      });
    }, 1000 / settings.updateRate);
  };

  // Convert real BeamNG data to telemetry frame
  const convertRealDataToTelemetry = (vehicleData: BeamNGVehicleData): TelemetryFrame => ({
    timestamp: BigInt(Date.now() * 1000),
    sequenceNumber: sequenceNumber++,
    sourceId: `beamng-real-${vehicleData.id}`,
    sourceType: 'telemetry',
    simulator: 'beamng',
    vehicle: {
      position: vehicleData.position,
      velocity: vehicleData.velocity,
      acceleration: vehicleData.acceleration,
      rotation: vehicleData.rotation,
      heading: Math.atan2(vehicleData.rotation[1], vehicleData.rotation[0]) * 180 / Math.PI
    },
    controls: {
      throttle: vehicleData.throttleInput,
      brake: vehicleData.brakeInput,
      steering: vehicleData.steeringInput,
      gear: vehicleData.gear,
      custom: {
        clutch: vehicleData.clutchInput,
        wheelSpeed: vehicleData.wheelSpeed
      }
    },
    performance: {
      speed: Math.sqrt(vehicleData.velocity[0]**2 + vehicleData.velocity[1]**2 + vehicleData.velocity[2]**2),
      fuel: vehicleData.fuel,
      engineRpm: vehicleData.engineRpm,
      damage: vehicleData.damage
    },
    environment: {
      temperature: vehicleData.engineTemp,
      custom: {
        wheelTemp: vehicleData.wheelTemp,
        tirePressure: vehicleData.tirePressure
      }
    },
    metadata: {
      vehicleId: vehicleData.id,
      dataSource: 'Real BeamNG Protocol'
    }
  }); 
  
  // Command and control implementation
  const sendCommand = async (command: SimulatorCommand): Promise<CommandResult> => {
    if (!protocolClient) {
      return {
        commandId: command.id,
        success: false,
        executedAt: Date.now(),
        error: {
          code: 'NOT_CONNECTED',
          message: 'BeamNG real protocol not connected - commands only work with real protocol'
        }
      };
    }
    
    return await protocolClient.sendControlInput(command);
  };
  
  const sendCommands = async (commands: SimulatorCommand[]): Promise<CommandResult[]> => {
    const results: CommandResult[] = [];
    for (const command of commands) {
      results.push(await sendCommand(command));
    }
    return results;
  };
  
  const queueCommand = (command: SimulatorCommand): boolean => {
    return commandQueue.add(command);
  };
  
  const clearCommandQueue = (): void => {
    commandQueue.clear();
  };
  
  const getCapabilities = (): CommandCapabilities => ({
    supportedTypes: ['vehicle-control', 'simulation'],
    supportedActions: {
      'vehicle-control': [
        VEHICLE_COMMANDS.SET_STEERING,
        VEHICLE_COMMANDS.SET_THROTTLE,
        VEHICLE_COMMANDS.SET_BRAKE,
        VEHICLE_COMMANDS.SET_HANDBRAKE,
        VEHICLE_COMMANDS.SET_GEAR,
        VEHICLE_COMMANDS.SHIFT_UP,
        VEHICLE_COMMANDS.SHIFT_DOWN,
        VEHICLE_COMMANDS.TOGGLE_ENGINE,
        VEHICLE_COMMANDS.RESET_VEHICLE
      ],
      'simulation': ['reset-vehicle', 'lua-execute'],
      'flight-control': [], // Not applicable
      'system-control': [],
      'navigation': [],
      'environment': [],
      'custom': ['lua-execute']
    },
    maxConcurrentCommands: 5,
    supportsQueuing: true,
    supportsUndo: false
  });
  
  const subscribeToEvents = (callback: (event: SimulatorEvent) => void): (() => void) => {
    return eventEmitter.on('*', callback);
  };
  
  const getStatus = () => {
    const baseStatus = {
      connected: isConnected,
      lastData: connectionStats.lastData,
      reliability: Math.max(0, 1.0 - (connectionStats.errors * 0.1)),
      errors: connectionStats.errors,
      dataMode: protocolClient ? 'real' : 'mock',
      protocol: settings.protocol
    };
    
    return baseStatus;
  };

  const subscribe = (callback: (data: TelemetryFrame) => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter(cb => cb !== callback);
    };
  };

  return {
    id: 'beamng-connector',
    simulator: 'beamng',
    connect,
    disconnect,
    isConnected: () => isConnected,
    subscribe,
    getStatus,
    sendCommand,
    sendCommands,
    queueCommand,
    clearCommandQueue,
    getCapabilities,
    subscribeToEvents
  };
};
