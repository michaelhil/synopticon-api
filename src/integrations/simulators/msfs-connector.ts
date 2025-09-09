/**
 * Microsoft Flight Simulator Telemetry Connector
 * Real-time flight data collection from MSFS via native SimConnect protocol
 */

import type { TelemetryFrame, VehicleState } from '../../common/types';
import type { SimulatorConnector, SimulatorCommand, CommandResult, CommandCapabilities, SimulatorEvent } from './index';
import { createMSFSClient, type SimConnectClientConfig, type FlightData } from './simconnect-client';
import { createMSFSCommandProcessor } from './msfs-commands';
import { createCommandQueue, createEventEmitter } from '../commands/command-system';

export interface MSFSConfig {
  endpoint?: string;
  port?: number;
  updateRate?: number;
  dataFields?: string[];
  useNativeProtocol?: boolean;
  useNamedPipes?: boolean;
  autoReconnect?: boolean;
  fallbackToMock?: boolean;
  remoteHosts?: string[]; // Array of remote MSFS server IPs to try
}

// MSFS-specific data structures
interface MSFSData {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  airspeed: number;
  verticalSpeed: number;
  throttlePosition: number;
  rudderPosition: number;
  elevatorPosition: number;
  aileronPosition: number;
  fuelQuantity: number;
  engineRpm: number;
}

// Convert MSFS data to universal telemetry format
const convertMSFSToTelemetry = (msfsData: MSFSData, sequenceNumber: number): TelemetryFrame => ({
  timestamp: BigInt(Date.now() * 1000),
  sequenceNumber,
  sourceId: 'msfs-simconnect',
  sourceType: 'telemetry',
  simulator: 'msfs',
  vehicle: {
    position: [msfsData.longitude, msfsData.latitude, msfsData.altitude],
    velocity: [msfsData.airspeed * 0.514444, 0, msfsData.verticalSpeed * 0.00508],
    rotation: [0, 0, msfsData.heading * Math.PI / 180, 1],
    heading: msfsData.heading
  },
  controls: {
    throttle: msfsData.throttlePosition,
    brake: 0,
    steering: msfsData.rudderPosition,
    custom: {
      elevator: msfsData.elevatorPosition,
      aileron: msfsData.aileronPosition
    }
  },
  performance: {
    speed: msfsData.airspeed,
    fuel: msfsData.fuelQuantity,
    engineRpm: msfsData.engineRpm
  }
});

// Factory function for MSFS connector
export const createMSFSConnector = (config: MSFSConfig = {}): SimulatorConnector => {
  const settings = {
    endpoint: 'localhost',
    port: 500,
    updateRate: 30,
    dataFields: ['latitude', 'longitude', 'altitude', 'heading', 'airspeed'],
    useNativeProtocol: false, // Disabled by default until transport is stable
    useNamedPipes: process.platform === 'win32',
    autoReconnect: true,
    fallbackToMock: true,
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
  let nativeClient: ReturnType<typeof createMSFSClient> | null = null;
  let mockInterval: Timer | null = null;
  let commandProcessor: ReturnType<typeof createMSFSCommandProcessor> | null = null;
  const commandQueue = createCommandQueue();
  const eventEmitter = createEventEmitter();

  // Connect to MSFS using native SimConnect or fallback to mock
  const connect = async (): Promise<boolean> => {
    try {
      console.log(`Connecting to MSFS on ${settings.endpoint}:${settings.port}`);
      
      if (settings.useNativeProtocol) {
        nativeClient = createMSFSClient({
          endpoint: settings.endpoint,
          port: settings.port,
          useNamedPipes: settings.useNamedPipes,
          autoReconnect: settings.autoReconnect,
          dataUpdateRate: settings.updateRate,
          remoteHosts: settings.remoteHosts || []
        });
        
        const connected = await nativeClient.connect();
        if (connected) {
          console.log('MSFS connected via native SimConnect protocol');
          setupNativeDataStream();
          setupCommandProcessor();
          isConnected = true;
          return true;
        } else if (settings.fallbackToMock) {
          console.warn('Native SimConnect failed, falling back to mock data');
          nativeClient = null;
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
      console.error('MSFS connection failed:', error);
      connectionStats.errors++;
      
      if (settings.fallbackToMock) {
        console.warn('Connection error, falling back to mock data');
        isConnected = true;
        startMockDataStream();
        return true;
      }
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    isConnected = false;
    
    if (nativeClient) {
      await nativeClient.disconnect();
      nativeClient = null;
    }
    
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
    }
    
    subscribers = [];
    console.log('MSFS connection closed');
  };

  // Set up native SimConnect data streaming
  const setupNativeDataStream = () => {
    if (!nativeClient) return;
    
    nativeClient.subscribeToData((flightData: FlightData) => {
      const telemetryFrame = convertNativeToTelemetry(flightData);
      connectionStats.lastData = Date.now();
      
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('MSFS native data subscriber error:', error);
          connectionStats.errors++;
        }
      });
    });
    
    nativeClient.subscribeToErrors((error) => {
      console.error('MSFS SimConnect error:', error);
      connectionStats.errors++;
    });
  };
  
  // Set up command processor
  const setupCommandProcessor = () => {
    if (!nativeClient) return;
    
    commandProcessor = createMSFSCommandProcessor(async (message: Uint8Array) => {
      // Send message through the native client's transport
      const transport = (nativeClient as any)?.state?.transport;
      if (transport) {
        return await transport.send(message);
      }
      return false;
    });
    
    commandProcessor.subscribeToEvents((event: SimulatorEvent) => {
      eventEmitter.emit(event);
    });
  };
  
  // Fallback mock data stream
  const startMockDataStream = () => {
    mockInterval = setInterval(() => {
      if (!isConnected) {
        if (mockInterval) clearInterval(mockInterval);
        return;
      }

      // Generate realistic flight data
      const mockData: MSFSData = {
        latitude: 47.6062 + (Math.random() - 0.5) * 0.01,
        longitude: -122.3321 + (Math.random() - 0.5) * 0.01,
        altitude: 10000 + (Math.random() - 0.5) * 1000,
        heading: (Date.now() / 1000) % 360,
        airspeed: 250 + (Math.random() - 0.5) * 50,
        verticalSpeed: (Math.random() - 0.5) * 500,
        throttlePosition: 0.8 + (Math.random() - 0.5) * 0.2,
        rudderPosition: (Math.random() - 0.5) * 0.1,
        elevatorPosition: (Math.random() - 0.5) * 0.2,
        aileronPosition: (Math.random() - 0.5) * 0.3,
        fuelQuantity: 0.75 - (Date.now() % 1000000) / 2000000,
        engineRpm: 2400 + (Math.random() - 0.5) * 200
      };

      const telemetryFrame = convertMSFSToTelemetry(mockData, sequenceNumber++);
      
      connectionStats.lastData = Date.now();
      
      // Notify subscribers
      subscribers.forEach(callback => {
        try {
          callback(telemetryFrame);
        } catch (error) {
          console.error('MSFS mock subscriber error:', error);
          connectionStats.errors++;
        }
      });
    }, 1000 / settings.updateRate);
  };

  const subscribe = (callback: (data: TelemetryFrame) => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter(cb => cb !== callback);
    };
  };

  const getStatus = () => {
    const baseStatus = {
      connected: isConnected,
      lastData: connectionStats.lastData,
      reliability: Math.max(0, 1.0 - (connectionStats.errors * 0.1)),
      errors: connectionStats.errors,
      dataMode: nativeClient ? 'native' : 'mock'
    };
    
    if (nativeClient) {
      const nativeStatus = nativeClient.getStatus();
      return {
        ...baseStatus,
        transport: nativeStatus.transport,
        protocolVersion: nativeStatus.protocolVersion,
        lastHeartbeat: nativeStatus.lastHeartbeat
      };
    }
    
    return baseStatus;
  };

  // Convert native SimConnect data to telemetry frame
  const convertNativeToTelemetry = (flightData: FlightData): TelemetryFrame => ({
    timestamp: BigInt(flightData.timestamp * 1000),
    sequenceNumber: flightData.sequenceNumber,
    sourceId: 'msfs-native-simconnect',
    sourceType: 'telemetry',
    simulator: 'msfs',
    vehicle: {
      position: [flightData.longitude, flightData.latitude, flightData.altitude * 0.3048], // Convert feet to meters
      velocity: [flightData.airspeed * 0.514444, 0, flightData.verticalSpeed * 0.00508], // Convert knots and fpm to m/s
      rotation: [0, 0, flightData.heading * Math.PI / 180, 1],
      heading: flightData.heading
    },
    performance: {
      speed: flightData.airspeed,
      fuel: flightData.fuelQuantity,
      engineRpm: flightData.engineRpm
    },
    metadata: {
      aircraft: 'Unknown',
      dataSource: 'Native SimConnect'
    }
  });
  
  // Command and control implementation
  const sendCommand = async (command: SimulatorCommand): Promise<CommandResult> => {
    if (!commandProcessor) {
      return {
        commandId: command.id,
        success: false,
        executedAt: Date.now(),
        error: {
          code: 'NOT_CONNECTED',
          message: 'MSFS native client not connected'
        }
      };
    }
    
    return await commandProcessor.processCommand(command);
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
  
  const getCapabilities = (): CommandCapabilities => {
    return commandProcessor?.getCapabilities() || {
      supportedTypes: [],
      supportedActions: {},
      maxConcurrentCommands: 0,
      supportsQueuing: false,
      supportsUndo: false
    };
  };
  
  const subscribeToEvents = (callback: (event: SimulatorEvent) => void): (() => void) => {
    return eventEmitter.on('*', callback);
  };

  return {
    id: 'msfs-connector',
    simulator: 'msfs',
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
