/**
 * Eye Tracking Module - Main API Interface
 * Complete Device Control API Implementation
 * Following functional programming patterns with factory functions
 */

import { createDeviceDiscovery, discoveryFactory } from './devices/neon/discovery.js';
import { createEyeTrackerDevice } from './devices/neon/device.js';
import { createGazeProcessor } from './common/gaze-processing.js';
import { createEyeTrackingStreaming, createEyeTrackingSystem } from './devices/neon/streaming.js';
import { 
  createEyeTrackingResult, 
  createGazeData, 
  createDeviceStatus, 
  createCalibrationResult 
} from '../../core/configuration/types.ts';

// Import modular components
import { createDeviceManager } from './core/device-manager.js';
import { createSessionManager } from './core/session-manager.js';
import { createRecordingController } from './core/recording-controller.js';
import { createCalibrationController } from './core/calibration-controller.js';
import { createStreamingController } from './core/streaming-controller.js';
import { createEventNotifier } from './core/event-notifier.js';

// Main eye tracking API factory
export const createEyeTrackingAPI = (config = {}) => {
  const state = {
    system: null,
    activeDevices: new Map(),
    calibrationSessions: new Map(),
    recordingSessions: new Map(),
    createDeviceStatus,
    callbacks: {
      onSystemReady: [],
      onDeviceStatusChange: [],
      onCalibrationProgress: [],
      onRecordingProgress: [],
      onError: []
    }
  };

  // Create modular components
  const eventNotifier = createEventNotifier(state);
  const sessionManager = createSessionManager(state);
  const recordingController = createRecordingController(state, sessionManager, eventNotifier);
  const calibrationController = createCalibrationController(state, sessionManager, eventNotifier);
  const streamingController = createStreamingController(state);
  const deviceManager = createDeviceManager(state, { cleanupDeviceSessions: sessionManager.cleanupDeviceSessions });

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
      deviceManager.handleDeviceConnectionEvent(event);
    });

    state.system.onError((error) => {
      eventNotifier.notifyError(error);
    });
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
          await recordingController.stopRecording(session.deviceId, session.sessionId);
        } catch (error) {
          console.warn('Error stopping recording during shutdown:', error);
        }
      }
    }

    for (const session of state.calibrationSessions.values()) {
      if (session.status === 'in_progress') {
        try {
          await calibrationController.stopCalibration(session.deviceId, session.sessionId);
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

  return {
    // System control
    initialize,
    shutdown,
    
    // Device discovery - delegated to deviceManager
    discoverDevices: deviceManager.discoverDevices,
    getDiscoveredDevices: deviceManager.getDiscoveredDevices,
    
    // Device connection - delegated to deviceManager  
    connectToDevice: deviceManager.connectToDevice,
    disconnectFromDevice: deviceManager.disconnectFromDevice,
    autoConnectToFirstDevice: deviceManager.autoConnectToFirstDevice,
    
    // Device status - delegated to deviceManager
    getDeviceStatus: deviceManager.getDeviceStatus,
    getConnectedDevices: deviceManager.getConnectedDevices,
    
    // Recording control - delegated to recordingController
    startRecording: recordingController.startRecording,
    stopRecording: recordingController.stopRecording,
    getRecordingSessions: sessionManager.getRecordingSessions,
    
    // Calibration control - delegated to calibrationController
    startCalibration: calibrationController.startCalibration,
    stopCalibration: calibrationController.stopCalibration,
    getCalibrationSessions: sessionManager.getCalibrationSessions,
    
    // Streaming - delegated to streamingController
    getGazeStream: streamingController.getGazeStream,
    onGazeData: streamingController.onGazeData,
    
    // Event handlers - delegated to eventNotifier
    onSystemReady: eventNotifier.onSystemReady,
    onDeviceStatusChange: eventNotifier.onDeviceStatusChange,
    onCalibrationProgress: eventNotifier.onCalibrationProgress,
    onRecordingProgress: eventNotifier.onRecordingProgress,
    onError: eventNotifier.onError,
    
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