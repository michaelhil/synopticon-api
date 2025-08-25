/**
 * Eye Tracking Module - Main API Interface
 * Complete Device Control API Implementation
 * Following functional programming patterns with factory functions
 */

import { createDeviceDiscovery, discoveryFactory } from './discovery.js';
import { createEyeTrackerDevice } from './device.js';
import { createGazeProcessor } from './gaze-processing.js';
import { createEyeTrackingStreaming, createEyeTrackingSystem } from './streaming.js';
import { 
  createEyeTrackingResult, 
  createGazeData, 
  createDeviceStatus, 
  createCalibrationResult 
} from '../../core/types.js';

// Main eye tracking API factory
export const createEyeTrackingAPI = (config = {}) => {
  const state = {
    system: null,
    activeDevices: new Map(),
    calibrationSessions: new Map(),
    recordingSessions: new Map(),
    callbacks: {
      onSystemReady: [],
      onDeviceStatusChange: [],
      onCalibrationProgress: [],
      onRecordingProgress: [],
      onError: []
    }
  };

  // Initialize the eye tracking system
  const initialize = async (systemConfig = {}) => {
    if (state.system) {
      throw new Error('Eye tracking system already initialized');
    }

    state.system = createEyeTrackingSystem({
      ...config,
      ...systemConfig,
      enableSynchronization: true,
      autoStart: false // We control startup
    });

    // Setup system event handlers
    setupSystemHandlers();

    // Start the system
    await state.system.start();

    // Notify callbacks
    state.callbacks.onSystemReady.forEach(cb => {
      try {
        cb({ timestamp: Date.now(), config: systemConfig });
      } catch (error) {
        console.warn('System ready callback error:', error);
      }
    });

    return true;
  };

  // Setup system event handlers
  const setupSystemHandlers = () => {
    state.system.onDeviceConnection((event) => {
      handleDeviceConnectionEvent(event);
    });

    state.system.onError((error) => {
      notifyError(error);
    });
  };

  // Handle device connection events
  const handleDeviceConnectionEvent = (event) => {
    switch (event.event) {
      case 'discovered':
        console.log(`Device discovered: ${event.device.name}`);
        break;
      case 'connected':
        state.activeDevices.set(event.deviceId, {
          device: state.system.getDevice(event.deviceId),
          connectedAt: Date.now(),
          status: 'connected'
        });
        break;
      case 'disconnected':
        state.activeDevices.delete(event.deviceId);
        // Clean up any active sessions for this device
        cleanupDeviceSessions(event.deviceId);
        break;
    }

    // Notify status change callbacks
    state.callbacks.onDeviceStatusChange.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        console.warn('Device status change callback error:', error);
      }
    });
  };

  // Clean up sessions when device disconnects
  const cleanupDeviceSessions = (deviceId) => {
    // Stop any active calibration sessions
    for (const [sessionId, session] of state.calibrationSessions.entries()) {
      if (session.deviceId === deviceId) {
        session.status = 'aborted';
        state.calibrationSessions.delete(sessionId);
      }
    }

    // Stop any active recording sessions
    for (const [sessionId, session] of state.recordingSessions.entries()) {
      if (session.deviceId === deviceId) {
        session.status = 'aborted';
        state.recordingSessions.delete(sessionId);
      }
    }
  };

  // Device Discovery API
  const discoverDevices = async (timeout = 10000) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    // Discovery is automatically handled by the system
    // Wait for discovery timeout then return results
    await new Promise(resolve => setTimeout(resolve, timeout));
    return state.system.getDiscoveredDevices();
  };

  const getDiscoveredDevices = () => {
    if (!state.system) return [];
    return state.system.getDiscoveredDevices();
  };

  // Device Connection API
  const connectToDevice = async (deviceId) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    return await state.system.connectDevice(deviceId);
  };

  const disconnectFromDevice = (deviceId) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    state.system.disconnectDevice(deviceId);
  };

  const autoConnectToFirstDevice = async () => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    return await state.system.autoConnect();
  };

  // Device Status API
  const getDeviceStatus = async (deviceId) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const device = deviceInfo.device;
    return createDeviceStatus({
      deviceId,
      connectionState: device.getConnectionState(),
      lastHeartbeat: device.getLastHeartbeat(),
      connectedAt: deviceInfo.connectedAt,
      deviceInfo: device.getDeviceInfo()
    });
  };

  const getConnectedDevices = () => {
    return Array.from(state.activeDevices.keys());
  };

  // Recording Control API
  const startRecording = async (deviceId, recordingConfig = {}) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const recordingId = recordingConfig.recordingId || `recording-${Date.now()}`;
    const sessionId = `${deviceId}-${recordingId}`;

    // Start recording on device
    const result = await deviceInfo.device.startRecording(recordingId, recordingConfig);
    
    if (result.success) {
      // Track recording session
      state.recordingSessions.set(sessionId, {
        sessionId,
        deviceId,
        recordingId,
        startTime: Date.now(),
        status: 'recording',
        config: recordingConfig
      });

      // Notify progress callbacks
      state.callbacks.onRecordingProgress.forEach(cb => {
        try {
          cb({
            event: 'started',
            sessionId,
            deviceId,
            recordingId,
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn('Recording progress callback error:', error);
        }
      });
    }

    return { success: result.success, sessionId, recordingId };
  };

  const stopRecording = async (deviceId, sessionId = null) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    // Find session if not provided
    if (!sessionId) {
      const activeSessions = Array.from(state.recordingSessions.values())
        .filter(s => s.deviceId === deviceId && s.status === 'recording');
      
      if (activeSessions.length === 0) {
        throw new Error('No active recording session found');
      }
      
      sessionId = activeSessions[0].sessionId;
    }

    const session = state.recordingSessions.get(sessionId);
    if (!session) {
      throw new Error(`Recording session ${sessionId} not found`);
    }

    // Stop recording on device
    const result = await deviceInfo.device.stopRecording();
    
    if (result.success) {
      // Update session
      session.status = 'completed';
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;

      // Notify progress callbacks
      state.callbacks.onRecordingProgress.forEach(cb => {
        try {
          cb({
            event: 'completed',
            sessionId,
            deviceId: session.deviceId,
            recordingId: session.recordingId,
            duration: session.duration,
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn('Recording progress callback error:', error);
        }
      });
    }

    return { success: result.success, session };
  };

  const getRecordingSessions = (deviceId = null) => {
    const sessions = Array.from(state.recordingSessions.values());
    return deviceId ? sessions.filter(s => s.deviceId === deviceId) : sessions;
  };

  // Calibration Control API
  const startCalibration = async (deviceId, calibrationConfig = {}) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const sessionId = `${deviceId}-calibration-${Date.now()}`;

    // Start calibration on device
    const result = await deviceInfo.device.startCalibration();
    
    if (result.success) {
      // Track calibration session
      state.calibrationSessions.set(sessionId, {
        sessionId,
        deviceId,
        calibrationId: result.calibrationId,
        startTime: Date.now(),
        status: 'in_progress',
        config: calibrationConfig
      });

      // Setup calibration update handler
      const device = deviceInfo.device;
      device.onCalibrationUpdate((calibrationResult) => {
        const session = state.calibrationSessions.get(sessionId);
        if (session) {
          session.lastUpdate = Date.now();
          session.result = calibrationResult;
          
          if (calibrationResult.status === 'completed' || calibrationResult.status === 'failed') {
            session.status = calibrationResult.status;
            session.endTime = Date.now();
          }

          // Notify progress callbacks
          state.callbacks.onCalibrationProgress.forEach(cb => {
            try {
              cb({
                event: 'update',
                sessionId,
                deviceId,
                calibrationResult,
                timestamp: Date.now()
              });
            } catch (error) {
              console.warn('Calibration progress callback error:', error);
            }
          });
        }
      });

      // Notify start
      state.callbacks.onCalibrationProgress.forEach(cb => {
        try {
          cb({
            event: 'started',
            sessionId,
            deviceId,
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn('Calibration progress callback error:', error);
        }
      });
    }

    return { success: result.success, sessionId };
  };

  const stopCalibration = async (deviceId, sessionId = null) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    // Find session if not provided
    if (!sessionId) {
      const activeSessions = Array.from(state.calibrationSessions.values())
        .filter(s => s.deviceId === deviceId && s.status === 'in_progress');
      
      if (activeSessions.length === 0) {
        throw new Error('No active calibration session found');
      }
      
      sessionId = activeSessions[0].sessionId;
    }

    const session = state.calibrationSessions.get(sessionId);
    if (!session) {
      throw new Error(`Calibration session ${sessionId} not found`);
    }

    // Stop calibration on device
    const result = await deviceInfo.device.stopCalibration();
    
    if (result.success) {
      // Update session
      session.status = result.result.status;
      session.endTime = Date.now();
      session.result = result.result;

      // Notify progress callbacks
      state.callbacks.onCalibrationProgress.forEach(cb => {
        try {
          cb({
            event: 'completed',
            sessionId,
            deviceId: session.deviceId,
            result: session.result,
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn('Calibration progress callback error:', error);
        }
      });
    }

    return { success: result.success, session };
  };

  const getCalibrationSessions = (deviceId = null) => {
    const sessions = Array.from(state.calibrationSessions.values());
    return deviceId ? sessions.filter(s => s.deviceId === deviceId) : sessions;
  };

  // Streaming API
  const getGazeStream = (deviceId) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    return deviceInfo.device.getGazeStream();
  };

  const onGazeData = (callback, deviceId = null) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    if (deviceId) {
      // Subscribe to specific device
      const deviceInfo = state.activeDevices.get(deviceId);
      if (!deviceInfo) {
        throw new Error(`Device ${deviceId} not connected`);
      }
      return deviceInfo.device.onGazeData(callback);
    } else {
      // Subscribe to all devices
      return state.system.onGazeData(callback);
    }
  };

  // System API
  const getSystemStats = () => {
    if (!state.system) {
      return { initialized: false };
    }

    return {
      initialized: true,
      ...state.system.getStats(),
      activeSessions: {
        recordings: state.recordingSessions.size,
        calibrations: state.calibrationSessions.size
      }
    };
  };

  const shutdown = async () => {
    if (!state.system) return;

    // Stop all active sessions
    for (const session of state.recordingSessions.values()) {
      if (session.status === 'recording') {
        try {
          await stopRecording(session.deviceId, session.sessionId);
        } catch (error) {
          console.warn('Error stopping recording during shutdown:', error);
        }
      }
    }

    for (const session of state.calibrationSessions.values()) {
      if (session.status === 'in_progress') {
        try {
          await stopCalibration(session.deviceId, session.sessionId);
        } catch (error) {
          console.warn('Error stopping calibration during shutdown:', error);
        }
      }
    }

    // Stop the system
    state.system.stop();
    state.system = null;
    state.activeDevices.clear();
    state.calibrationSessions.clear();
    state.recordingSessions.clear();
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
  const onSystemReady = (callback) => {
    state.callbacks.onSystemReady.push(callback);
    return () => {
      const index = state.callbacks.onSystemReady.indexOf(callback);
      if (index !== -1) state.callbacks.onSystemReady.splice(index, 1);
    };
  };

  const onDeviceStatusChange = (callback) => {
    state.callbacks.onDeviceStatusChange.push(callback);
    return () => {
      const index = state.callbacks.onDeviceStatusChange.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceStatusChange.splice(index, 1);
    };
  };

  const onCalibrationProgress = (callback) => {
    state.callbacks.onCalibrationProgress.push(callback);
    return () => {
      const index = state.callbacks.onCalibrationProgress.indexOf(callback);
      if (index !== -1) state.callbacks.onCalibrationProgress.splice(index, 1);
    };
  };

  const onRecordingProgress = (callback) => {
    state.callbacks.onRecordingProgress.push(callback);
    return () => {
      const index = state.callbacks.onRecordingProgress.indexOf(callback);
      if (index !== -1) state.callbacks.onRecordingProgress.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  return {
    // System control
    initialize,
    shutdown,
    
    // Device discovery
    discoverDevices,
    getDiscoveredDevices,
    
    // Device connection
    connectToDevice,
    disconnectFromDevice,
    autoConnectToFirstDevice,
    
    // Device status
    getDeviceStatus,
    getConnectedDevices,
    
    // Recording control
    startRecording,
    stopRecording,
    getRecordingSessions,
    
    // Calibration control
    startCalibration,
    stopCalibration,
    getCalibrationSessions,
    
    // Streaming
    getGazeStream,
    onGazeData,
    
    // Event handlers
    onSystemReady,
    onDeviceStatusChange,
    onCalibrationProgress,
    onRecordingProgress,
    onError,
    
    // System status
    getSystemStats
  };
};

// Export all components for direct use
export {
  createDeviceDiscovery,
  createEyeTrackerDevice,
  createGazeProcessor,
  createEyeTrackingStreaming,
  createEyeTrackingSystem
};

// Default API instance factory
export const createEyeTracker = (config = {}) => {
  return createEyeTrackingAPI(config);
};