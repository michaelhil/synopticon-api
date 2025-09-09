/**
 * @fileoverview Eye Tracking Module - Main API Interface
 * 
 * Complete Device Control API Implementation following functional programming patterns
 * with comprehensive TypeScript support for type-safe eye tracking operations.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createDeviceDiscovery, discoveryFactory } from './devices/neon/discovery.js';
import { createEyeTrackerDevice } from './devices/neon/device.js';
import { createGazeProcessor } from './common/gaze-processing.js';
import { createEyeTrackingStreaming, createEyeTrackingSystem } from './devices/neon/streaming.js';
import { 
  createCalibrationResult, 
  createDeviceStatus, 
  createEyeTrackingResult, 
  createGazeData 
} from '../../core/configuration/types.js';

// Import modular components
import { createDeviceManager } from './core/device-manager.js';
import { createSessionManager } from './core/session-manager.js';
import { createRecordingController } from './core/recording-controller.js';
import { createCalibrationController } from './core/calibration-controller.js';
import { createStreamingController } from './core/streaming-controller.js';
import { createEventNotifier } from './core/event-notifier.js';

/**
 * Eye tracking API configuration
 */
export interface EyeTrackingConfig {
  enableSynchronization?: boolean;
  autoStart?: boolean;
  deviceTimeout?: number;
  calibrationPoints?: number;
  samplingRate?: number;
  [key: string]: unknown;
}

/**
 * Device connection event
 */
export interface DeviceConnectionEvent {
  deviceId: string;
  status: 'connected' | 'disconnected' | 'error';
  timestamp: number;
  error?: string;
}

/**
 * System statistics
 */
export interface SystemStats {
  initialized: boolean;
  activeSessions?: {
    recordings: number;
    calibrations: number;
  };
  connectedDevices?: number;
  totalDataPoints?: number;
  uptime?: number;
}

/**
 * Recording session information
 */
export interface RecordingSession {
  deviceId: string;
  sessionId: string;
  status: 'recording' | 'stopped' | 'paused';
  startTime: number;
  duration: number;
}

/**
 * Calibration session information
 */
export interface CalibrationSession {
  deviceId: string;
  sessionId: string;
  status: 'in_progress' | 'completed' | 'failed';
  progress: number;
  points?: number;
}

/**
 * Eye tracking API state
 */
export interface EyeTrackingState {
  system: any | null;
  activeDevices: Map<string, any>;
  calibrationSessions: Map<string, CalibrationSession>;
  recordingSessions: Map<string, RecordingSession>;
  createDeviceStatus: any;
  callbacks: {
    onSystemReady: Array<(event: { timestamp: number; config: any }) => void>;
    onDeviceStatusChange: Array<(event: any) => void>;
    onCalibrationProgress: Array<(event: any) => void>;
    onRecordingProgress: Array<(event: any) => void>;
    onError: Array<(error: Error) => void>;
  };
}

/**
 * Eye tracking API interface
 */
export interface EyeTrackingAPI {
  // System control
  initialize: (systemConfig?: Partial<EyeTrackingConfig>) => Promise<boolean>;
  shutdown: () => Promise<void>;
  
  // Device discovery
  discoverDevices: () => Promise<any[]>;
  getDiscoveredDevices: () => any[];
  
  // Device connection
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnectFromDevice: (deviceId: string) => Promise<void>;
  autoConnectToFirstDevice: () => Promise<boolean>;
  
  // Device status
  getDeviceStatus: (deviceId: string) => any;
  getConnectedDevices: () => any[];
  
  // Recording control
  startRecording: (deviceId: string, options?: any) => Promise<string>;
  stopRecording: (deviceId: string, sessionId: string) => Promise<void>;
  getRecordingSessions: () => RecordingSession[];
  
  // Calibration control
  startCalibration: (deviceId: string, options?: any) => Promise<string>;
  stopCalibration: (deviceId: string, sessionId: string) => Promise<void>;
  getCalibrationSessions: () => CalibrationSession[];
  
  // Streaming
  getGazeStream: (deviceId: string) => any;
  onGazeData: (deviceId: string, callback: (data: any) => void) => void;
  
  // Event handlers
  onSystemReady: (callback: (event: { timestamp: number; config: any }) => void) => void;
  onDeviceStatusChange: (callback: (event: any) => void) => void;
  onCalibrationProgress: (callback: (event: any) => void) => void;
  onRecordingProgress: (callback: (event: any) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  
  // System status
  getSystemStats: () => SystemStats;
}

/**
 * Main eye tracking API factory
 */
export const createEyeTrackingAPI = (config: EyeTrackingConfig = {}): EyeTrackingAPI => {
  const state: EyeTrackingState = {
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
  const initialize = async (systemConfig: Partial<EyeTrackingConfig> = {}): Promise<boolean> => {
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
  const setupSystemHandlers = (): void => {
    state.system.onDeviceConnection((event: DeviceConnectionEvent) => {
      deviceManager.handleDeviceConnectionEvent(event);
    });

    state.system.onError((error: Error) => {
      eventNotifier.notifyError(error);
    });
  };

  // System API
  const getSystemStats = (): SystemStats => {
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

  const shutdown = async (): Promise<void> => {
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

// Export Tobii 5 integration
export {
  createTobii5Device,
  createTobii5Discovery,
  createRemoteTobiiClient,
  tobii5DeviceFactory
} from './devices/tobii5/index.js';

/**
 * Default API instance factory
 */
export const createEyeTracker = (config: EyeTrackingConfig = {}): EyeTrackingAPI => {
  return createEyeTrackingAPI(config);
};

/**
 * Eye tracking utilities
 */
export const EyeTrackingUtils = {
  /**
   * Validate eye tracking configuration
   */
  validateConfig: (config: EyeTrackingConfig): boolean => {
    if (typeof config !== 'object' || config === null) {
      return false;
    }
    
    // Check optional fields have correct types
    if (config.enableSynchronization !== undefined && typeof config.enableSynchronization !== 'boolean') {
      return false;
    }
    
    if (config.autoStart !== undefined && typeof config.autoStart !== 'boolean') {
      return false;
    }
    
    if (config.deviceTimeout !== undefined && (typeof config.deviceTimeout !== 'number' || config.deviceTimeout <= 0)) {
      return false;
    }
    
    if (config.calibrationPoints !== undefined && (typeof config.calibrationPoints !== 'number' || config.calibrationPoints < 5)) {
      return false;
    }
    
    if (config.samplingRate !== undefined && (typeof config.samplingRate !== 'number' || config.samplingRate <= 0)) {
      return false;
    }
    
    return true;
  },

  /**
   * Create default configuration
   */
  createDefaultConfig: (): EyeTrackingConfig => ({
    enableSynchronization: true,
    autoStart: false,
    deviceTimeout: 30000,
    calibrationPoints: 9,
    samplingRate: 120
  }),

  /**
   * Calculate session duration
   */
  calculateSessionDuration: (session: RecordingSession | CalibrationSession): number => {
    return Date.now() - session.startTime;
  },

  /**
   * Format session statistics
   */
  formatSessionStats: (sessions: (RecordingSession | CalibrationSession)[]): {
    total: number;
    active: number;
    completed: number;
    averageDuration: number;
  } => {
    const total = sessions.length;
    const active = sessions.filter(s => 
      s.status === 'recording' || s.status === 'in_progress'
    ).length;
    const completed = sessions.filter(s => 
      s.status === 'stopped' || s.status === 'completed'
    ).length;
    
    const durations = sessions.map(s => EyeTrackingUtils.calculateSessionDuration(s));
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    
    return {
      total,
      active,
      completed,
      averageDuration: Math.round(averageDuration)
    };
  }
};
