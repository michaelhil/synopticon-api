/**
 * Eye Tracking Distribution Integration
 * Shows how to use Synopticon's eye tracking API with the distribution system
 */

import { createEyeTrackerDevice } from '../../src/eye-tracking/device.js';
import { createDistributionSessionManager } from '../../src/core/distribution/index.js';

/**
 * Integration example: Connect Synopticon's eye tracking to distribution system
 */
export const createEyeTrackingDistributor = (config = {}) => {
  let eyeTracker = null;
  let sessionManager = null;
  let sessionId = null;
  
  // Initialize the integrated system
  const initialize = async () => {
    // 1. Create the distribution session manager
    sessionManager = createDistributionSessionManager();
    
    // 2. Configure distribution for eye tracking data
    const distributionConfig = {
      distributors: {
        mqtt: {
          broker: config.mqttBroker || 'mqtt://localhost:1883',
          clientId: config.clientId || 'synopticon-eyetracker',
          topics: {
            gaze: config.gazeTopic || 'synopticon/eyetracking/gaze',
            calibration: config.calibrationTopic || 'synopticon/eyetracking/calibration',
            events: config.eventsTopic || 'synopticon/eyetracking/events'
          }
        },
        websocket: config.websocket || { port: 8080 },
        http: config.http || null
      },
      eventRouting: {
        'gaze_data': config.gazeRouting || ['mqtt'],
        'calibration_result': config.calibrationRouting || ['mqtt', 'http'],
        'device_status': config.statusRouting || ['websocket'],
        'tracking_events': config.eventsRouting || ['mqtt', 'websocket']
      }
    };
    
    // 3. Create the session
    sessionId = config.sessionId || `eyetracking-${Date.now()}`;
    await sessionManager.createSession(sessionId, distributionConfig);
    
    // 4. Create Synopticon's eye tracker device
    eyeTracker = createEyeTrackerDevice({
      deviceId: config.deviceId || 'neon-001',
      address: config.deviceAddress || 'localhost',
      port: config.devicePort || 8080,
      mockMode: config.mockMode !== false, // Default to mock for development
      autoReconnect: config.autoReconnect !== false
    });
    
    // 5. Connect eye tracker events to distribution system
    setupEventHandlers();
    
    console.log('✅ Eye tracking distribution system initialized');
  };
  
  // Connect Synopticon's eye tracker callbacks to distribution
  const setupEventHandlers = () => {
    // Gaze data → Distribution system
    eyeTracker.onGazeData(async (gazeData) => {
      await sessionManager.routeEvent(sessionId, 'gaze_data', {
        x: gazeData.x,
        y: gazeData.y,
        confidence: gazeData.confidence,
        timestamp: gazeData.timestamp || Date.now(),
        deviceId: eyeTracker.getDeviceId(),
        worn: gazeData.worn,
        eyeStates: gazeData.eyeStates
      });
    });
    
    // Device status → Distribution system
    eyeTracker.onDeviceStatus(async (status) => {
      await sessionManager.routeEvent(sessionId, 'device_status', {
        deviceId: status.deviceId,
        connectionState: status.connectionState,
        battery: status.battery,
        temperature: status.temperature,
        calibration: status.calibration,
        timestamp: Date.now()
      });
    });
    
    // Calibration updates → Distribution system
    eyeTracker.onCalibrationUpdate(async (calibrationResult) => {
      await sessionManager.routeEvent(sessionId, 'calibration_result', {
        status: calibrationResult.status,
        quality: calibrationResult.quality,
        timestamp: calibrationResult.timestamp,
        deviceId: eyeTracker.getDeviceId()
      });
    });
    
    // Connection changes → Distribution system
    eyeTracker.onConnectionChange(async (connectionData) => {
      await sessionManager.routeEvent(sessionId, 'tracking_events', {
        type: 'connection_change',
        oldState: connectionData.oldState,
        newState: connectionData.newState,
        deviceId: connectionData.deviceId,
        timestamp: connectionData.timestamp
      });
    });
    
    // Errors → Distribution system
    eyeTracker.onError(async (error) => {
      await sessionManager.routeEvent(sessionId, 'tracking_events', {
        type: 'error',
        error: error.message,
        deviceId: eyeTracker.getDeviceId(),
        timestamp: Date.now()
      });
    });
  };
  
  // Start the integrated system
  const start = async () => {
    if (!eyeTracker || !sessionManager) {
      throw new Error('System not initialized. Call initialize() first.');
    }
    
    // Connect the eye tracker (uses Synopticon's device manager)
    await eyeTracker.connect();
    console.log('🔗 Eye tracker connected and data distribution started');
  };
  
  // Stop the system
  const stop = async () => {
    if (eyeTracker) {
      eyeTracker.disconnect();
    }
    
    if (sessionManager && sessionId) {
      await sessionManager.endSession(sessionId);
    }
    
    console.log('🛑 Eye tracking distribution stopped');
  };
  
  // Dynamic configuration changes
  const updateDistribution = async (changes) => {
    if (!sessionManager || !sessionId) return;
    
    // Example: Change MQTT broker at runtime
    if (changes.mqttBroker) {
      await sessionManager.reconfigureDistributor(sessionId, 'mqtt', {
        broker: changes.mqttBroker
      });
      console.log(`🔄 MQTT broker updated to: ${changes.mqttBroker}`);
    }
    
    // Example: Enable/disable distributors
    if (changes.enableWebSocket) {
      await sessionManager.enableDistributor(sessionId, 'websocket');
    }
    if (changes.disableHttp) {
      await sessionManager.disableDistributor(sessionId, 'http');
    }
  };
  
  // Eye tracker control (using Synopticon's device API)
  const startCalibration = async () => {
    if (!eyeTracker) throw new Error('Eye tracker not initialized');
    return await eyeTracker.startCalibration();
  };
  
  const stopCalibration = async () => {
    if (!eyeTracker) throw new Error('Eye tracker not initialized');
    return await eyeTracker.stopCalibration();
  };
  
  const startRecording = async (recordingId) => {
    if (!eyeTracker) throw new Error('Eye tracker not initialized');
    return await eyeTracker.startRecording(recordingId);
  };
  
  const stopRecording = async () => {
    if (!eyeTracker) throw new Error('Eye tracker not initialized');
    return await eyeTracker.stopRecording();
  };
  
  // Status and monitoring
  const getStatus = () => ({
    eyeTracker: {
      connected: eyeTracker?.isConnected() || false,
      deviceId: eyeTracker?.getDeviceId() || null,
      lastHeartbeat: eyeTracker?.getLastHeartbeat() || null
    },
    distribution: sessionManager ? 
      sessionManager.getSessionStatus(sessionId) : null
  });
  
  return {
    // Lifecycle
    initialize,
    start,
    stop,
    
    // Eye tracker controls (Synopticon API)
    startCalibration,
    stopCalibration,
    startRecording,
    stopRecording,
    
    // Distribution controls
    updateDistribution,
    
    // Status
    getStatus,
    
    // Direct access
    getEyeTracker: () => eyeTracker,
    getSessionManager: () => sessionManager,
    getSessionId: () => sessionId
  };
};