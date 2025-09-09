/**
 * @fileoverview Eye Tracker Device Connection Manager
 * 
 * Comprehensive device lifecycle management with auto-reconnection,
 * error recovery, and real-time streaming capabilities.
 * Following functional programming patterns with factory functions.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createHttpTransport, createWebSocketTransport } from '../../../../core/integration/transport.js';
import { createDataStream } from '../../../../core/state/streams.js';
import { createGazeProcessor } from '../../common/gaze-processing.js';
import { 
  createCalibrationResult, 
  createDeviceStatus, 
  createEyeTrackingResult 
} from '../../../../core/configuration/types.js';

/**
 * Device configuration interface
 */
export interface EyeTrackerDeviceConfig {
  deviceId?: string;
  address?: string;
  port?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  screenWidth?: number;
  screenHeight?: number;
  smoothingFactor?: number;
  deviceInfo?: Record<string, any>;
  mockMode?: boolean;
  mockConnectionDelay?: number;
}

/**
 * Connection state type
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error' | 'failed';

/**
 * Connection change event
 */
export interface ConnectionChangeEvent {
  deviceId: string;
  oldState: ConnectionState;
  newState: ConnectionState;
  timestamp: number;
}

/**
 * Recording configuration
 */
export interface RecordingConfig {
  format?: string;
  quality?: string;
  includeVideo?: boolean;
  includeIMU?: boolean;
  [key: string]: any;
}

/**
 * Calibration configuration
 */
export interface CalibrationConfig {
  pointCount?: number;
  duration?: number;
  pattern?: 'grid' | 'cross' | 'random';
  [key: string]: any;
}

/**
 * HTTP transport interface
 */
interface HttpTransport {
  getStatus: () => Promise<{ success: boolean; error?: string; data?: any }>;
  startRecording: (recordingId: string, config: RecordingConfig) => Promise<{ success: boolean; recordingId?: string }>;
  stopRecording: () => Promise<{ success: boolean }>;
  startCalibration: () => Promise<{ success: boolean; calibrationId?: string }>;
  stopCalibration: () => Promise<{ success: boolean; result?: any }>;
}

/**
 * WebSocket transport interface
 */
interface WebSocketTransport {
  connect: (url: string) => Promise<void>;
  stop: () => void;
  onMessage: (callback: (message: any) => void) => void;
  onDisconnect: (callback: () => void) => void;
  onError: (callback: (error: Error) => void) => void;
}

/**
 * Data stream interface
 */
interface DataStream {
  start: () => Promise<void>;
  stop: () => void;
  process: (data: any) => Promise<any>;
}

/**
 * Gaze processor interface
 */
interface GazeProcessor {
  processGazeData: (rawData: any) => any;
}

/**
 * Eye tracker device interface
 */
export interface EyeTrackerDevice {
  // Connection management
  connect: () => Promise<boolean>;
  disconnect: () => void;
  
  // Device control
  startRecording: (recordingId: string, config?: RecordingConfig) => Promise<{ success: boolean; recordingId?: string }>;
  stopRecording: () => Promise<{ success: boolean }>;
  startCalibration: () => Promise<{ success: boolean; calibrationId?: string }>;
  stopCalibration: () => Promise<{ success: boolean; result?: any }>;
  
  // Event handlers
  onConnectionChange: (callback: (change: ConnectionChangeEvent) => void) => () => void;
  onGazeData: (callback: (data: any) => void) => () => void;
  onDeviceStatus: (callback: (status: any) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
  onCalibrationUpdate: (callback: (result: any) => void) => () => void;
  
  // Status
  getConnectionState: () => ConnectionState;
  getDeviceId: () => string;
  getDeviceInfo: () => Record<string, any>;
  getLastHeartbeat: () => number | null;
  getGazeStream: () => DataStream;
  isConnected: () => boolean;
  
  // Configuration
  setReconnectionConfig: (config: Partial<ReconnectionConfig>) => void;
  
  // Cleanup
  cleanup: () => void;
}

/**
 * Reconnection configuration
 */
export interface ReconnectionConfig {
  enabled: boolean;
  interval: number;
  maxAttempts: number;
  attempts: number;
  backoffMultiplier: number;
  maxInterval: number;
}

/**
 * Internal device state
 */
interface DeviceState {
  deviceId: string;
  address: string;
  port: number;
  connectionState: ConnectionState;
  wsTransport: WebSocketTransport | null;
  httpTransport: HttpTransport | null;
  gazeStream: DataStream | null;
  gazeProcessor: GazeProcessor | null;
  reconnect: ReconnectionConfig;
  deviceInfo: Record<string, any>;
  lastHeartbeat: number | null;
  callbacks: {
    onConnectionChange: Array<(change: ConnectionChangeEvent) => void>;
    onGazeData: Array<(data: any) => void>;
    onDeviceStatus: Array<(status: any) => void>;
    onError: Array<(error: Error) => void>;
    onCalibrationUpdate: Array<(result: any) => void>;
  };
  mockMode: boolean;
  heartbeatInterval?: NodeJS.Timeout;
  mockStreamingInterval?: NodeJS.Timeout;
  reconnectTimeout?: NodeJS.Timeout;
}

/**
 * Mock eye state for development
 */
interface MockEyeState {
  center: { x: number; y: number };
  pupilDiameter: number;
}

/**
 * Mock gaze data structure
 */
interface MockGazeData {
  timestamp: number;
  x: number;
  y: number;
  confidence: number;
  worn: boolean;
  eyeStates: {
    left: MockEyeState;
    right: MockEyeState;
  };
}

/**
 * Streaming message interface
 */
interface StreamingMessage {
  topic: 'gaze' | 'video' | 'imu' | 'events';
  data: any;
}

/**
 * Eye tracker device factory with connection management
 */
export const createEyeTrackerDevice = (config: EyeTrackerDeviceConfig = {}): EyeTrackerDevice => {
  const state: DeviceState = {
    deviceId: config.deviceId || 'unknown',
    address: config.address || (process.env.NEON_DEVICE_ADDRESS || 'localhost'),
    port: config.port || 8080,
    connectionState: 'disconnected',
    wsTransport: null,
    httpTransport: null,
    gazeStream: null,
    gazeProcessor: null,
    reconnect: {
      enabled: config.autoReconnect !== false,
      interval: config.reconnectInterval || 5000,
      maxAttempts: config.maxReconnectAttempts || 10,
      attempts: 0,
      backoffMultiplier: 1.5,
      maxInterval: 30000
    },
    deviceInfo: config.deviceInfo || {},
    lastHeartbeat: null,
    callbacks: {
      onConnectionChange: [],
      onGazeData: [],
      onDeviceStatus: [],
      onError: [],
      onCalibrationUpdate: []
    },
    mockMode: config.mockMode !== false // Default to mock mode for development
  };

  // Initialize transports
  const initializeTransports = (): void => {
    const baseUrl = `http://${state.address}:${state.port}`;
    const wsUrl = `ws://${state.address}:${state.port}/websocket`;

    // HTTP transport for device control
    state.httpTransport = createHttpTransport({
      baseUrl,
      timeout: 10000
    }) as HttpTransport;

    // WebSocket transport for real-time streaming
    state.wsTransport = createWebSocketTransport({
      isServer: false,
      autoReconnect: false // We handle reconnection at device level
    }) as WebSocketTransport;

    // Initialize gaze processor
    state.gazeProcessor = createGazeProcessor({
      screenWidth: config.screenWidth || 1920,
      screenHeight: config.screenHeight || 1080,
      smoothingFactor: config.smoothingFactor || 0.3
    }) as GazeProcessor;

    // Create gaze stream
    state.gazeStream = createDataStream({
      id: `${state.deviceId}-gaze`,
      type: 'eyetracking',
      sampleRate: 200,
      bufferSize: 2000,
      processors: [state.gazeProcessor]
    }) as DataStream;
  };

  // Connection management
  const connect = async (): Promise<boolean> => {
    if (state.connectionState === 'connected' || state.connectionState === 'connecting') {
      return true;
    }

    setConnectionState('connecting');
    
    try {
      if (state.mockMode) {
        return await connectMock();
      } else {
        return await connectReal();
      }
    } catch (error) {
      setConnectionState('error');
      notifyError(error as Error);
      
      // Schedule reconnection if enabled
      if (state.reconnect.enabled && state.reconnect.attempts < state.reconnect.maxAttempts) {
        scheduleReconnect();
      }
      
      throw error;
    }
  };

  // Real device connection
  const connectReal = async (): Promise<boolean> => {
    const wsUrl = `ws://${state.address}:${state.port}/websocket`;
    
    // Test HTTP connection first
    if (!state.httpTransport) {
      throw new Error('HTTP transport not initialized');
    }
    
    const statusResponse = await state.httpTransport.getStatus();
    if (!statusResponse.success) {
      throw new Error(`HTTP connection failed: ${statusResponse.error}`);
    }

    // Connect WebSocket for streaming
    if (!state.wsTransport) {
      throw new Error('WebSocket transport not initialized');
    }
    
    await state.wsTransport.connect(wsUrl);
    
    // Setup WebSocket event handlers
    setupWebSocketHandlers();
    
    // Start gaze stream
    if (state.gazeStream) {
      await state.gazeStream.start();
    }
    
    setConnectionState('connected');
    state.reconnect.attempts = 0;
    startHeartbeat();
    
    return true;
  };

  // Mock device connection for development
  const connectMock = async (): Promise<boolean> => {
    // Simulate connection delay - reduced for better test performance
    const delay = config.mockConnectionDelay || 100;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Setup mock data streaming
    setupMockStreaming();
    
    // Start gaze stream
    if (state.gazeStream) {
      await state.gazeStream.start();
    }
    
    setConnectionState('connected');
    state.reconnect.attempts = 0;
    startMockHeartbeat();
    
    return true;
  };

  const disconnect = (): void => {
    setConnectionState('disconnecting');
    
    // Stop heartbeat
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
      state.heartbeatInterval = undefined;
    }
    
    // Stop streaming
    if (state.mockStreamingInterval) {
      clearInterval(state.mockStreamingInterval);
      state.mockStreamingInterval = undefined;
    }
    
    // Stop gaze stream
    if (state.gazeStream) {
      state.gazeStream.stop();
    }
    
    // Disconnect transports
    if (state.wsTransport) {
      state.wsTransport.stop();
    }
    
    setConnectionState('disconnected');
  };

  // Connection state management
  const setConnectionState = (newState: ConnectionState): void => {
    const oldState = state.connectionState;
    state.connectionState = newState;
    
    state.callbacks.onConnectionChange.forEach(cb => {
      try {
        cb({ 
          deviceId: state.deviceId, 
          oldState, 
          newState, 
          timestamp: Date.now() 
        });
      } catch (error) {
        console.warn('Connection change callback error:', error);
      }
    });
  };

  // WebSocket event handlers
  const setupWebSocketHandlers = (): void => {
    if (!state.wsTransport) return;
    
    state.wsTransport.onMessage((message: StreamingMessage) => {
      handleStreamingMessage(message);
    });
    
    state.wsTransport.onDisconnect(() => {
      if (state.connectionState === 'connected') {
        setConnectionState('disconnected');
        if (state.reconnect.enabled) {
          scheduleReconnect();
        }
      }
    });
    
    state.wsTransport.onError((error: Error) => {
      notifyError(error);
    });
  };

  // Mock streaming for development
  const setupMockStreaming = (): void => {
    let gazeX = 0.5;
    let gazeY = 0.5;
    const direction = { x: 0.02, y: 0.01 };
    
    state.mockStreamingInterval = setInterval(async () => {
      if (state.connectionState !== 'connected') return;
      
      // Generate realistic gaze movement
      gazeX += direction.x + (Math.random() - 0.5) * 0.01;
      gazeY += direction.y + (Math.random() - 0.5) * 0.01;
      
      // Bounce off edges
      if (gazeX <= 0 || gazeX >= 1) direction.x *= -1;
      if (gazeY <= 0 || gazeY >= 1) direction.y *= -1;
      
      // Keep in bounds
      gazeX = Math.max(0, Math.min(1, gazeX));
      gazeY = Math.max(0, Math.min(1, gazeY));
      
      const mockGazeData: MockGazeData = {
        timestamp: Date.now(),
        x: gazeX,
        y: gazeY,
        confidence: 0.8 + Math.random() * 0.2,
        worn: true,
        eyeStates: {
          left: {
            center: { x: gazeX - 0.01, y: gazeY },
            pupilDiameter: 3.2 + Math.sin(Date.now() / 5000) * 0.5
          },
          right: {
            center: { x: gazeX + 0.01, y: gazeY },
            pupilDiameter: 3.1 + Math.sin(Date.now() / 5000) * 0.5
          }
        }
      };
      
      await handleGazeData(mockGazeData);
    }, 5); // 200Hz = 5ms interval
  };

  // Handle incoming streaming messages
  const handleStreamingMessage = async (message: StreamingMessage): Promise<void> => {
    try {
      switch (message.topic) {
      case 'gaze':
        await handleGazeData(message.data);
        break;
      case 'video':
        await handleVideoFrame(message.data);
        break;
      case 'imu':
        await handleIMUData(message.data);
        break;
      case 'events':
        await handleEyeEvent(message.data);
        break;
      default:
        console.warn('Unknown message topic:', message.topic);
      }
    } catch (error) {
      notifyError(new Error(`Message handling error: ${(error as Error).message}`));
    }
  };

  // Gaze data processing
  const handleGazeData = async (rawGazeData: any): Promise<void> => {
    try {
      // Process through gaze processor
      if (!state.gazeStream) {
        throw new Error('Gaze stream not initialized');
      }
      
      const processedGaze = await state.gazeStream.process(rawGazeData);
      
      // Notify callbacks
      state.callbacks.onGazeData.forEach(cb => {
        try {
          cb(processedGaze);
        } catch (error) {
          console.warn('Gaze data callback error:', error);
        }
      });
      
    } catch (error) {
      notifyError(new Error(`Gaze processing error: ${(error as Error).message}`));
    }
  };

  // Placeholder handlers for other data types
  const handleVideoFrame = async (videoData: any): Promise<void> => {
    // Implementation for video frame processing
  };
  
  const handleIMUData = async (imuData: any): Promise<void> => {
    // Implementation for IMU data processing
  };
  
  const handleEyeEvent = async (eventData: any): Promise<void> => {
    // Implementation for eye event processing
  };

  // Heartbeat management
  const startHeartbeat = (): void => {
    state.heartbeatInterval = setInterval(async () => {
      try {
        if (state.mockMode) {
          // Mock heartbeat
          state.lastHeartbeat = Date.now();
          return;
        }
        
        if (!state.httpTransport) {
          throw new Error('HTTP transport not available');
        }
        
        const response = await state.httpTransport.getStatus();
        if (response.success) {
          state.lastHeartbeat = Date.now();
          
          // Update device status
          const deviceStatus = createDeviceStatus({
            deviceId: state.deviceId,
            connectionState: 'connected',
            ...response.data
          });
          
          state.callbacks.onDeviceStatus.forEach(cb => {
            try {
              cb(deviceStatus);
            } catch (error) {
              console.warn('Device status callback error:', error);
            }
          });
        } else {
          throw new Error('Heartbeat failed');
        }
      } catch (error) {
        // Heartbeat failure indicates connection issue
        if (state.connectionState === 'connected') {
          setConnectionState('disconnected');
          if (state.reconnect.enabled) {
            scheduleReconnect();
          }
        }
      }
    }, 5000); // 5 second heartbeat
  };

  const startMockHeartbeat = (): void => {
    state.heartbeatInterval = setInterval(() => {
      state.lastHeartbeat = Date.now();
      
      // Generate mock device status
      const deviceStatus = createDeviceStatus({
        deviceId: state.deviceId,
        connectionState: 'connected',
        battery: Math.max(0, 100 - (Date.now() % 100000) / 1000),
        charging: Math.random() > 0.7,
        temperature: 25 + Math.sin(Date.now() / 10000) * 2,
        calibration: {
          status: 'valid',
          timestamp: Date.now() - 300000
        }
      });
      
      state.callbacks.onDeviceStatus.forEach(cb => {
        try {
          cb(deviceStatus);
        } catch (error) {
          console.warn('Device status callback error:', error);
        }
      });
    }, 5000);
  };

  // Reconnection management
  const scheduleReconnect = (): void => {
    if (state.reconnectTimeout) return; // Already scheduled
    
    state.reconnect.attempts++;
    const delay = Math.min(
      state.reconnect.interval * Math.pow(state.reconnect.backoffMultiplier, state.reconnect.attempts - 1),
      state.reconnect.maxInterval
    );
    
    console.log(`Scheduling reconnection attempt ${state.reconnect.attempts}/${state.reconnect.maxAttempts} in ${delay}ms`);
    
    state.reconnectTimeout = setTimeout(async () => {
      state.reconnectTimeout = undefined;
      
      if (state.reconnect.attempts >= state.reconnect.maxAttempts) {
        setConnectionState('failed');
        return;
      }
      
      try {
        await connect();
      } catch (error) {
        // connect() handles reconnection scheduling on failure
      }
    }, delay);
  };

  // Device control methods
  const startRecording = async (recordingId: string, config: RecordingConfig = {}): Promise<{ success: boolean; recordingId?: string }> => {
    if (state.mockMode) {
      // Mock recording start
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, recordingId };
    }
    
    if (!state.httpTransport) {
      throw new Error('HTTP transport not available');
    }
    
    return await state.httpTransport.startRecording(recordingId, config);
  };

  const stopRecording = async (): Promise<{ success: boolean }> => {
    if (state.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    }
    
    if (!state.httpTransport) {
      throw new Error('HTTP transport not available');
    }
    
    return await state.httpTransport.stopRecording();
  };

  const startCalibration = async (): Promise<{ success: boolean; calibrationId?: string }> => {
    if (state.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, calibrationId: 'mock-calibration' };
    }
    
    if (!state.httpTransport) {
      throw new Error('HTTP transport not available');
    }
    
    return await state.httpTransport.startCalibration();
  };

  const stopCalibration = async (): Promise<{ success: boolean; result?: any }> => {
    if (state.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const calibrationResult = createCalibrationResult({
        status: 'completed',
        quality: 'good',
        timestamp: Date.now()
      });
      
      state.callbacks.onCalibrationUpdate.forEach(cb => {
        try {
          cb(calibrationResult);
        } catch (error) {
          console.warn('Calibration update callback error:', error);
        }
      });
      
      return { success: true, result: calibrationResult };
    }
    
    if (!state.httpTransport) {
      throw new Error('HTTP transport not available');
    }
    
    return await state.httpTransport.stopCalibration();
  };

  // Error handling
  const notifyError = (error: Error): void => {
    state.callbacks.onError.forEach(cb => {
      try {
        cb(error);
      } catch (cbError) {
        console.warn('Error callback failed:', cbError);
      }
    });
  };

  // Event handlers
  const onConnectionChange = (callback: (change: ConnectionChangeEvent) => void): (() => void) => {
    state.callbacks.onConnectionChange.push(callback);
    return () => {
      const index = state.callbacks.onConnectionChange.indexOf(callback);
      if (index !== -1) state.callbacks.onConnectionChange.splice(index, 1);
    };
  };

  const onGazeData = (callback: (data: any) => void): (() => void) => {
    state.callbacks.onGazeData.push(callback);
    return () => {
      const index = state.callbacks.onGazeData.indexOf(callback);
      if (index !== -1) state.callbacks.onGazeData.splice(index, 1);
    };
  };

  const onDeviceStatus = (callback: (status: any) => void): (() => void) => {
    state.callbacks.onDeviceStatus.push(callback);
    return () => {
      const index = state.callbacks.onDeviceStatus.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceStatus.splice(index, 1);
    };
  };

  const onError = (callback: (error: Error) => void): (() => void) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  const onCalibrationUpdate = (callback: (result: any) => void): (() => void) => {
    state.callbacks.onCalibrationUpdate.push(callback);
    return () => {
      const index = state.callbacks.onCalibrationUpdate.indexOf(callback);
      if (index !== -1) state.callbacks.onCalibrationUpdate.splice(index, 1);
    };
  };

  // Cleanup
  const cleanup = (): void => {
    disconnect();
    
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
      state.reconnectTimeout = undefined;
    }
  };

  // Initialize transports
  initializeTransports();

  return {
    // Connection management
    connect,
    disconnect,
    
    // Device control
    startRecording,
    stopRecording,
    startCalibration,
    stopCalibration,
    
    // Event handlers
    onConnectionChange,
    onGazeData,
    onDeviceStatus,
    onError,
    onCalibrationUpdate,
    
    // Status
    getConnectionState: () => state.connectionState,
    getDeviceId: () => state.deviceId,
    getDeviceInfo: () => ({ ...state.deviceInfo }),
    getLastHeartbeat: () => state.lastHeartbeat,
    getGazeStream: () => state.gazeStream!,
    isConnected: () => state.connectionState === 'connected',
    
    // Configuration
    setReconnectionConfig: (config: Partial<ReconnectionConfig>) => {
      Object.assign(state.reconnect, config);
    },
    
    // Cleanup
    cleanup
  };
};

/**
 * Device utility functions
 */
export const DeviceUtils = {
  /**
   * Validate device configuration
   */
  validateConfig: (config: EyeTrackerDeviceConfig): boolean => {
    if (config.port !== undefined && (config.port < 1 || config.port > 65535)) {
      return false;
    }
    
    if (config.reconnectInterval !== undefined && config.reconnectInterval < 0) {
      return false;
    }
    
    if (config.maxReconnectAttempts !== undefined && config.maxReconnectAttempts < 0) {
      return false;
    }
    
    if (config.screenWidth !== undefined && config.screenWidth <= 0) {
      return false;
    }
    
    if (config.screenHeight !== undefined && config.screenHeight <= 0) {
      return false;
    }
    
    if (config.smoothingFactor !== undefined && (config.smoothingFactor < 0 || config.smoothingFactor > 1)) {
      return false;
    }
    
    return true;
  },

  /**
   * Create mock device configuration for testing
   */
  createMockConfig: (overrides: Partial<EyeTrackerDeviceConfig> = {}): EyeTrackerDeviceConfig => ({
    deviceId: 'mock-device',
    address: 'localhost',
    port: 8080,
    mockMode: true,
    mockConnectionDelay: 50,
    autoReconnect: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 3,
    screenWidth: 1920,
    screenHeight: 1080,
    smoothingFactor: 0.3,
    ...overrides
  }),

  /**
   * Generate device ID from network address
   */
  generateDeviceId: (address: string, port: number): string => {
    return `device-${address.replace(/\./g, '-')}-${port}`;
  },

  /**
   * Parse device address from URL
   */
  parseDeviceAddress: (url: string): { address: string; port: number } | null => {
    try {
      const parsed = new URL(url);
      return {
        address: parsed.hostname,
        port: parseInt(parsed.port) || 8080
      };
    } catch {
      return null;
    }
  }
};
