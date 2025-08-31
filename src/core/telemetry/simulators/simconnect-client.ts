/**
 * Native SimConnect Client
 * High-level interface for MSFS SimConnect communication
 */

import type { SimConnectTransport, TransportConfig } from './simconnect-transport';
import { createSimConnectTransport, createConnectionHelper } from './simconnect-transport';
import {
  createMessageParser,
  createMessageBuilders,
  createErrorHandler,
  createFlightDataDefinition,
  SIMCONNECT_PROTOCOL,
  SIMCONNECT_MESSAGE_ID,
  type DataDefinition,
  type SimConnectError,
} from './simconnect-protocol';

export interface SimConnectClientConfig extends TransportConfig {
  applicationName?: string;
  applicationVersion?: string;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  enableDataStreaming?: boolean;
  dataUpdateRate?: number;
  remoteHosts?: string[]; // For remote MSFS connections
}

export interface SimConnectStatus {
  connected: boolean;
  transport: 'tcp' | 'namedpipe' | 'disconnected';
  applicationName: string;
  protocolVersion: number;
  lastHeartbeat: number;
  errors: number;
  dataDefinitions: number;
  activeRequests: number;
}

export interface FlightData {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  airspeed: number;
  verticalSpeed: number;
  engineRpm: number;
  fuelQuantity: number;
  timestamp: number;
  sequenceNumber: number;
}

// Helper function to create client state
const createClientState = (settings: Required<SimConnectClientConfig>) => {
  const status: SimConnectStatus = {
    connected: false,
    transport: 'disconnected',
    applicationName: settings.applicationName,
    protocolVersion: SIMCONNECT_PROTOCOL.VERSION,
    lastHeartbeat: 0,
    errors: 0,
    dataDefinitions: 0,
    activeRequests: 0,
  };
  
  return {
    transport: null as SimConnectTransport | null,
    isConnected: false,
    callIndex: 0,
    dataSubscribers: [] as Array<(data: FlightData) => void>,
    errorSubscribers: [] as Array<(error: SimConnectError) => void>,
    status,
    heartbeatInterval: null as Timer | null,
    sequenceNumber: 0,
    dataDefinitions: new Map<number, DataDefinition>(),
  };
};

// SimConnect client implementation
export const createSimConnectClient = (config: SimConnectClientConfig = {}) => {
  const settings: Required<SimConnectClientConfig> = {
    endpoint: 'localhost',
    port: 500,
    useNamedPipes: process.platform === 'win32',
    timeout: 5000,
    reconnectAttempts: 3,
    reconnectDelay: 2000,
    applicationName: 'Synopticon-MSFS-Connector',
    applicationVersion: '1.0.0',
    autoReconnect: true,
    heartbeatInterval: 30000, // 30 seconds
    enableDataStreaming: true,
    dataUpdateRate: 60, // Hz
    remoteHosts: [],
    ...config,
  };

  const state = createClientState(settings);
  
  // Initialize protocol helpers
  const parser = createMessageParser();
  const messageBuilder = createMessageBuilders();
  const errorHandler = createErrorHandler();

  const getNextCallIndex = (): number => {
    state.callIndex = (state.callIndex + 1) % 0xFFFFFFFF;
    return state.callIndex;
  };

  const sendMessage = async (message: Uint8Array): Promise<boolean> => {
    if (!state.transport || !state.isConnected) {
      console.warn('SimConnect: Attempted to send message while disconnected');
      return false;
    }
    
    state.status.activeRequests++;
    const success = await state.transport.send(message);
    if (!success) {
      state.status.errors++;
    }
    return success;
  };

  const handleIncomingMessage = (messageData: Uint8Array) => {
    try {
      const header = parser.parseHeader(messageData);
      
      switch (header.id) {
        case SIMCONNECT_PROTOCOL.RECV_ID_OPEN:
          handleOpenMessage(messageData);
          break;
          
        case SIMCONNECT_PROTOCOL.RECV_ID_EXCEPTION:
          handleExceptionMessage(messageData);
          break;
          
        case SIMCONNECT_PROTOCOL.RECV_ID_SIMOBJECT_DATA:
          handleSimObjectDataMessage(messageData);
          break;
          
        case SIMCONNECT_PROTOCOL.RECV_ID_QUIT:
          handleQuitMessage();
          break;
          
        default:
          console.log(`SimConnect: Unhandled message type: 0x${header.id.toString(16)}`);
      }
    } catch (error) {
      console.error('SimConnect: Message processing error:', error);
      state.status.errors++;
    }
  };

  const handleOpenMessage = (messageData: Uint8Array) => {
    console.log('SimConnect: Connection opened successfully');
    state.status.lastHeartbeat = Date.now();
    
    if (settings.enableDataStreaming) {
      setupDataStreaming();
    }
  };

  const handleExceptionMessage = (messageData: Uint8Array) => {
    const error = errorHandler.parseException(messageData, 0);
    console.error(`SimConnect Exception: ${error.name} - ${error.description}`);
    state.status.errors++;
    
    state.errorSubscribers.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        console.error('Error subscriber callback failed:', err);
      }
    });
  };

  const parseSimObjectData = (messageData: Uint8Array): FlightData | null => {
    let offset = 16; // Skip header
    const requestId = parser.parseInt32(messageData, offset);
    offset += 4;
    const objectId = parser.parseInt32(messageData, offset);
    offset += 4;
    const defineId = parser.parseInt32(messageData, offset);
    offset += 4;
    const defineCount = parser.parseInt32(messageData, offset);
    offset += 4;
    const entryNumber = parser.parseInt32(messageData, offset);
    offset += 4;
    const outOf = parser.parseInt32(messageData, offset);
    offset += 4;
    const flags = parser.parseInt32(messageData, offset);
    offset += 4;
    
    // Extract flight data (assuming standard flight data definition)
    if (defineId === 1) {
      return {
        latitude: parser.parseFloat64(messageData, offset),
        longitude: parser.parseFloat64(messageData, offset + 8),
        altitude: parser.parseFloat64(messageData, offset + 16),
        heading: parser.parseFloat64(messageData, offset + 24),
        airspeed: parser.parseFloat64(messageData, offset + 32),
        verticalSpeed: parser.parseFloat64(messageData, offset + 40),
        engineRpm: parser.parseFloat64(messageData, offset + 48),
        fuelQuantity: parser.parseFloat64(messageData, offset + 56),
        timestamp: Date.now(),
        sequenceNumber: state.sequenceNumber++,
      };
    }
    
    return null;
  };
  
  const handleSimObjectDataMessage = (messageData: Uint8Array) => {
    try {
      const flightData = parseSimObjectData(messageData);
      if (flightData) {
        state.dataSubscribers.forEach(callback => {
          try {
            callback(flightData);
          } catch (error) {
            console.error('Data subscriber callback failed:', error);
            state.status.errors++;
          }
        });
      }
    } catch (error) {
      console.error('SimConnect: Failed to parse sim object data:', error);
      state.status.errors++;
    }
  };

  const handleQuitMessage = () => {
    console.log('SimConnect: Received quit message from simulator');
    disconnect();
  };

  const setupDataStreaming = async () => {
    try {
      // Create flight data definition
      const flightDef = createFlightDataDefinition();
      state.dataDefinitions.set(flightDef.id, flightDef);
      
      // Send data definition to simulator
      const defMessage = messageBuilder.buildDataDefinitionMessage(flightDef);
      await sendMessage(defMessage);
      
      // Request continuous data updates
      const requestMessage = messageBuilder.buildDataRequestMessage(flightDef.id, 1);
      await sendMessage(requestMessage);
      
      state.status.dataDefinitions++;
      console.log('SimConnect: Data streaming enabled');
    } catch (error) {
      console.error('SimConnect: Failed to setup data streaming:', error);
      state.status.errors++;
    }
  };

  const startHeartbeat = () => {
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
    }
    
    state.heartbeatInterval = setInterval(() => {
      state.status.lastHeartbeat = Date.now();
      
      // Could send a heartbeat message here if needed
      // For now, just update the timestamp
    }, settings.heartbeatInterval);
  };

  const stopHeartbeat = () => {
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
      state.heartbeatInterval = null;
    }
  };

  const establishTransport = async (autoDiscover: boolean) => {
    if (autoDiscover) {
      const helper = createConnectionHelper(settings.remoteHosts);
      return await helper.discoverConnection();
    } else {
      const transport = createSimConnectTransport(settings);
      const connected = await transport.connect();
      return connected ? transport : null;
    }
  };
  
  const connect = async (autoDiscover = true): Promise<boolean> => {
    try {
      console.log(`SimConnect: Connecting to MSFS (${settings.applicationName})`);
      
      state.transport = await establishTransport(autoDiscover);
      
      if (!state.transport) {
        console.error('SimConnect: Failed to establish transport connection');
        return false;
      }
      
      // Set up message handler
      state.transport.onMessage(handleIncomingMessage);
      
      state.isConnected = true;
      state.status.connected = true;
      state.status.transport = state.transport.getStatus().transport;
      
      startHeartbeat();
      
      console.log('SimConnect: Client connected successfully');
      return true;
    } catch (error) {
      console.error('SimConnect: Connection failed:', error);
      state.status.errors++;
      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    if (state.transport) {
      await state.transport.disconnect();
      state.transport = null;
    }
    
    state.isConnected = false;
    state.status.connected = false;
    state.status.transport = 'disconnected';
    state.status.activeRequests = 0;
    
    stopHeartbeat();
    state.dataSubscribers = [];
    state.errorSubscribers = [];
    state.dataDefinitions.clear();
    
    console.log('SimConnect: Client disconnected');
  };

  const subscribeToData = (callback: (data: FlightData) => void): (() => void) => {
    state.dataSubscribers.push(callback);
    return () => {
      state.dataSubscribers = state.dataSubscribers.filter(cb => cb !== callback);
    };
  };

  const subscribeToErrors = (callback: (error: SimConnectError) => void): (() => void) => {
    state.errorSubscribers.push(callback);
    return () => {
      state.errorSubscribers = state.errorSubscribers.filter(cb => cb !== callback);
    };
  };

  const sendCommand = async (eventName: string, data?: number): Promise<boolean> => {
    if (!state.isConnected || !state.transport) {
      return false;
    }
    
    // Implementation would build command message and send
    // This is a placeholder for command functionality
    console.log(`SimConnect: Would send command ${eventName} with data ${data}`);
    return true;
  };

  const getStatus = (): SimConnectStatus => ({
    ...state.status,
    dataDefinitions: state.dataDefinitions.size,
    activeRequests: state.status.activeRequests,
  });

  const isConnectedStatus = (): boolean => state.isConnected;

  return {
    connect,
    disconnect,
    subscribeToData,
    subscribeToErrors,
    sendCommand,
    getStatus,
    isConnected: isConnectedStatus,
  };
};

// Helper function to create configured client with common settings
export const createMSFSClient = (config: Partial<SimConnectClientConfig> = {}) => {
  return createSimConnectClient({
    applicationName: 'Synopticon-MSFS-Native',
    enableDataStreaming: true,
    dataUpdateRate: 60,
    autoReconnect: true,
    ...config,
  });
};