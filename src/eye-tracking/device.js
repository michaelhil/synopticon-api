/**
 * Eye Tracker Device Connection Manager
 * Connection lifecycle management, auto-reconnection, error recovery
 * Following functional programming patterns with factory functions
 */

import { createWebSocketTransport, createHttpTransport } from '../core/transport.js';
import { createDataStream } from '../core/streams.js';
import { createGazeProcessor } from './gaze-processing.js';
import { 
  createDeviceStatus, 
  createCalibrationResult, 
  createEyeTrackingResult 
} from '../core/types.js';

// Eye tracker device factory with connection management
export const createEyeTrackerDevice = (config = {}) => {
  const state = {
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
  const initializeTransports = () => {
    const baseUrl = `http://${state.address}:${state.port}`;
    const wsUrl = `ws://${state.address}:${state.port}/websocket`;

    // HTTP transport for device control
    state.httpTransport = createHttpTransport({
      baseUrl,
      timeout: 10000
    });

    // WebSocket transport for real-time streaming
    state.wsTransport = createWebSocketTransport({
      isServer: false,
      autoReconnect: false // We handle reconnection at device level
    });

    // Initialize gaze processor
    state.gazeProcessor = createGazeProcessor({
      screenWidth: config.screenWidth || 1920,
      screenHeight: config.screenHeight || 1080,
      smoothingFactor: config.smoothingFactor || 0.3
    });

    // Create gaze stream
    state.gazeStream = createDataStream({
      id: `${state.deviceId}-gaze`,
      type: 'eyetracking',
      sampleRate: 200,
      bufferSize: 2000,
      processors: [state.gazeProcessor]
    });
  };

  // Connection management
  const connect = async () => {
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
      notifyError(error);
      
      // Schedule reconnection if enabled
      if (state.reconnect.enabled && state.reconnect.attempts < state.reconnect.maxAttempts) {
        scheduleReconnect();
      }
      
      throw error;
    }
  };

  // Real device connection
  const connectReal = async () => {
    const wsUrl = `ws://${state.address}:${state.port}/websocket`;
    
    // Test HTTP connection first
    const statusResponse = await state.httpTransport.getStatus();
    if (!statusResponse.success) {
      throw new Error(`HTTP connection failed: ${statusResponse.error}`);
    }

    // Connect WebSocket for streaming
    await state.wsTransport.connect(wsUrl);
    
    // Setup WebSocket event handlers
    setupWebSocketHandlers();
    
    // Start gaze stream
    await state.gazeStream.start();
    
    setConnectionState('connected');
    state.reconnect.attempts = 0;
    startHeartbeat();
    
    return true;
  };

  // Mock device connection for development
  const connectMock = async () => {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Setup mock data streaming
    setupMockStreaming();
    
    // Start gaze stream
    await state.gazeStream.start();
    
    setConnectionState('connected');
    state.reconnect.attempts = 0;
    startMockHeartbeat();
    
    return true;
  };

  const disconnect = () => {
    setConnectionState('disconnecting');
    
    // Stop heartbeat
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
      state.heartbeatInterval = null;
    }
    
    // Stop streaming
    if (state.mockStreamingInterval) {
      clearInterval(state.mockStreamingInterval);
      state.mockStreamingInterval = null;
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
  const setConnectionState = (newState) => {
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
  const setupWebSocketHandlers = () => {
    state.wsTransport.onMessage((message) => {
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
    
    state.wsTransport.onError((error) => {
      notifyError(error);
    });
  };

  // Mock streaming for development
  const setupMockStreaming = () => {
    let gazeX = 0.5;
    let gazeY = 0.5;
    let direction = { x: 0.02, y: 0.01 };
    
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
      
      const mockGazeData = {
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
  const handleStreamingMessage = async (message) => {
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
      notifyError(new Error(`Message handling error: ${error.message}`));
    }
  };

  // Gaze data processing
  const handleGazeData = async (rawGazeData) => {
    try {
      // Process through gaze processor
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
      notifyError(new Error(`Gaze processing error: ${error.message}`));
    }
  };

  // Placeholder handlers for other data types
  const handleVideoFrame = async (videoData) => {
    // Implementation for video frame processing
  };
  
  const handleIMUData = async (imuData) => {
    // Implementation for IMU data processing
  };
  
  const handleEyeEvent = async (eventData) => {
    // Implementation for eye event processing
  };

  // Heartbeat management
  const startHeartbeat = () => {
    state.heartbeatInterval = setInterval(async () => {
      try {
        if (state.mockMode) {
          // Mock heartbeat
          state.lastHeartbeat = Date.now();
          return;
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

  const startMockHeartbeat = () => {
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
  const scheduleReconnect = () => {
    if (state.reconnectTimeout) return; // Already scheduled
    
    state.reconnect.attempts++;
    const delay = Math.min(
      state.reconnect.interval * Math.pow(state.reconnect.backoffMultiplier, state.reconnect.attempts - 1),
      state.reconnect.maxInterval
    );
    
    console.log(`Scheduling reconnection attempt ${state.reconnect.attempts}/${state.reconnect.maxAttempts} in ${delay}ms`);
    
    state.reconnectTimeout = setTimeout(async () => {
      state.reconnectTimeout = null;
      
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
  const startRecording = async (recordingId, config = {}) => {
    if (state.mockMode) {
      // Mock recording start
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, recordingId };
    }
    
    return await state.httpTransport.startRecording(recordingId, config);
  };

  const stopRecording = async () => {
    if (state.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    }
    
    return await state.httpTransport.stopRecording();
  };

  const startCalibration = async () => {
    if (state.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, calibrationId: 'mock-calibration' };
    }
    
    return await state.httpTransport.startCalibration();
  };

  const stopCalibration = async () => {
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
    
    return await state.httpTransport.stopCalibration();
  };

  // Error handling
  const notifyError = (error) => {
    state.callbacks.onError.forEach(cb => {
      try {
        cb(error);
      } catch (cbError) {
        console.warn('Error callback failed:', cbError);
      }
    });
  };

  // Event handlers
  const onConnectionChange = (callback) => {
    state.callbacks.onConnectionChange.push(callback);
    return () => {
      const index = state.callbacks.onConnectionChange.indexOf(callback);
      if (index !== -1) state.callbacks.onConnectionChange.splice(index, 1);
    };
  };

  const onGazeData = (callback) => {
    state.callbacks.onGazeData.push(callback);
    return () => {
      const index = state.callbacks.onGazeData.indexOf(callback);
      if (index !== -1) state.callbacks.onGazeData.splice(index, 1);
    };
  };

  const onDeviceStatus = (callback) => {
    state.callbacks.onDeviceStatus.push(callback);
    return () => {
      const index = state.callbacks.onDeviceStatus.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceStatus.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  const onCalibrationUpdate = (callback) => {
    state.callbacks.onCalibrationUpdate.push(callback);
    return () => {
      const index = state.callbacks.onCalibrationUpdate.indexOf(callback);
      if (index !== -1) state.callbacks.onCalibrationUpdate.splice(index, 1);
    };
  };

  // Cleanup
  const cleanup = () => {
    disconnect();
    
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
      state.reconnectTimeout = null;
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
    getGazeStream: () => state.gazeStream,
    isConnected: () => state.connectionState === 'connected',
    
    // Configuration
    setReconnectionConfig: (config) => {
      Object.assign(state.reconnect, config);
    },
    
    // Cleanup
    cleanup
  };
};