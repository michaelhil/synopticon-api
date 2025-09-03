/**
 * Tobii 5 Eye Tracker Device Implementation
 * Integrates remote Tobii bridge with Synopticon's eye tracking system
 * Compatible with existing device manager, streaming controller, and recording controller
 */

import { createRemoteTobiiClient } from './remote-client.js';
import { createLogger } from '../../../../shared/utils/logger.js';
import { createEventEmitter } from '../../../../shared/utils/events.js';

const logger = createLogger({ level: 2, component: 'Tobii5Device' });

/**
 * Create Tobii 5 device implementation
 */
export const createTobii5Device = (config = {}) => {
  const {
    host = 'localhost',
    port = 8080,
    deviceId = 'tobii-5-remote',
    name = 'Tobii Eye Tracker 5',
    ...clientConfig
  } = config;

  // Create remote client
  const remoteClient = createRemoteTobiiClient({ host, port, ...clientConfig });
  const eventEmitter = createEventEmitter();

  const state = {
    connected: false,
    calibrationSession: null,
    recordingSession: null,
    startTime: null,
    lastHeartbeat: 0,
    deviceInfo: {
      type: 'tobii-5',
      name,
      deviceId,
      capabilities: ['gaze-tracking', 'head-tracking', 'presence-detection'],
      connectionType: 'remote',
      remoteHost: host,
      remotePort: port
    }
  };

  // Forward remote client events
  remoteClient.on('connected', () => {
    state.connected = true;
    state.startTime = Date.now();
    logger.info(`✅ Tobii 5 device connected: ${deviceId}`);
    eventEmitter.emit('connected', { deviceId, timestamp: Date.now() });
  });

  remoteClient.on('disconnected', () => {
    state.connected = false;
    logger.warn(`❌ Tobii 5 device disconnected: ${deviceId}`);
    eventEmitter.emit('disconnected', { deviceId, timestamp: Date.now() });
  });

  remoteClient.on('error', (error) => {
    logger.error(`Tobii 5 device error: ${error.message}`);
    eventEmitter.emit('error', { deviceId, error, timestamp: Date.now() });
  });

  remoteClient.on('data', (data) => {
    state.lastHeartbeat = Date.now();
    // Forward gaze data to Synopticon system
    eventEmitter.emit('gazeData', {
      deviceId,
      timestamp: data.timestamp,
      data: transformToSynopticonFormat(data)
    });
  });

  /**
   * Transform Tobii bridge data to Synopticon gaze data format
   */
  const transformToSynopticonFormat = (tobiiData) => {
    return {
      timestamp: tobiiData.timestamp,
      gaze: tobiiData.gaze ? {
        x: tobiiData.gaze.x,
        y: tobiiData.gaze.y,
        valid: tobiiData.gaze.valid,
        confidence: tobiiData.quality.gazeConfidence
      } : null,
      
      head: tobiiData.head ? {
        yaw: tobiiData.head.yaw,
        pitch: tobiiData.head.pitch,
        roll: tobiiData.head.roll,
        position: tobiiData.head.position,
        valid: tobiiData.head.valid,
        confidence: tobiiData.quality.headConfidence
      } : null,
      
      presence: {
        detected: tobiiData.present,
        confidence: tobiiData.present ? 0.9 : 0.1
      },
      
      quality: {
        overall: tobiiData.quality.overallQuality,
        gaze: tobiiData.quality.gazeConfidence,
        head: tobiiData.quality.headConfidence
      },
      
      metadata: {
        latency: tobiiData.latency,
        bridgeTimestamp: tobiiData.bridgeTimestamp,
        deviceType: 'tobii-5',
        connectionType: 'remote'
      }
    };
  };

  /**
   * Create gaze stream for streaming controller integration
   */
  const createGazeStream = () => {
    const subscribers = new Set();
    
    const dataHandler = (data) => {
      const synopticonData = transformToSynopticonFormat(data);
      subscribers.forEach(callback => {
        try {
          callback(synopticonData);
        } catch (error) {
          logger.error('Gaze stream callback error:', error);
        }
      });
    };

    remoteClient.on('data', dataHandler);

    return {
      subscribe: (callback) => {
        subscribers.add(callback);
        return () => {
          subscribers.delete(callback);
          if (subscribers.size === 0) {
            remoteClient.off('data', dataHandler);
          }
        };
      },
      
      getLatestData: () => {
        const latestData = remoteClient.getLatestData();
        return latestData ? transformToSynopticonFormat(latestData) : null;
      },
      
      isActive: () => state.connected && subscribers.size > 0,
      
      getSubscriberCount: () => subscribers.size
    };
  };

  // Standard Synopticon device interface
  return {
    // Device identification
    getDeviceInfo: () => ({ ...state.deviceInfo }),
    getDeviceId: () => deviceId,
    
    // Connection management
    connect: async () => {
      logger.info(`Connecting Tobii 5 device: ${deviceId} to ${host}:${port}`);
      
      try {
        const result = await remoteClient.connect();
        if (result.success) {
          state.connected = true;
          return { 
            success: true, 
            deviceId, 
            connectionInfo: { host, port, type: 'remote' }
          };
        }
        return { success: false, error: 'Failed to connect to Tobii bridge' };
      } catch (error) {
        logger.error(`Failed to connect Tobii 5 device: ${error.message}`);
        return { success: false, error: error.message };
      }
    },

    disconnect: async () => {
      logger.info(`Disconnecting Tobii 5 device: ${deviceId}`);
      remoteClient.disconnect();
      state.connected = false;
      return { success: true, deviceId };
    },

    // Status and monitoring
    getConnectionState: () => state.connected ? 'connected' : 'disconnected',
    
    getLastHeartbeat: () => state.lastHeartbeat,
    
    isConnected: () => state.connected,

    getStats: () => {
      const clientStatus = remoteClient.getStatus();
      return {
        connected: state.connected,
        connectionTime: state.startTime ? Date.now() - state.startTime : 0,
        lastHeartbeat: state.lastHeartbeat,
        latency: clientStatus.stats.avgLatency,
        dataRate: clientStatus.stats.dataRate,
        packetsReceived: clientStatus.stats.packetsReceived,
        packetsLost: clientStatus.stats.packetsLost,
        packetLossRate: clientStatus.stats.packetsReceived > 0 
          ? clientStatus.stats.packetsLost / clientStatus.stats.packetsReceived 
          : 0
      };
    },

    // Streaming interface (for streaming controller)
    getGazeStream: () => createGazeStream(),
    
    onGazeData: (callback) => {
      return remoteClient.onData((data) => {
        callback(transformToSynopticonFormat(data));
      });
    },

    // Recording interface (for recording controller)
    startRecording: async (recordingId, recordingConfig = {}) => {
      logger.info(`Starting Tobii 5 recording: ${recordingId}`);
      
      if (state.recordingSession) {
        return { 
          success: false, 
          error: 'Recording already active',
          activeSession: state.recordingSession.recordingId
        };
      }

      try {
        const result = remoteClient.enableRecording(true);
        
        if (result.success) {
          state.recordingSession = {
            recordingId,
            startTime: Date.now(),
            config: recordingConfig,
            deviceId
          };

          logger.info(`✅ Tobii 5 recording started: ${recordingId}`);
          eventEmitter.emit('recordingStarted', {
            deviceId,
            recordingId,
            timestamp: Date.now()
          });

          return {
            success: true,
            recordingId,
            session: state.recordingSession
          };
        }

        return { success: false, error: result.error };
      } catch (error) {
        logger.error(`Failed to start Tobii 5 recording: ${error.message}`);
        return { success: false, error: error.message };
      }
    },

    stopRecording: async () => {
      if (!state.recordingSession) {
        return { success: false, error: 'No active recording session' };
      }

      const session = state.recordingSession;
      logger.info(`Stopping Tobii 5 recording: ${session.recordingId}`);

      try {
        const result = remoteClient.enableRecording(false);
        
        if (result.success) {
          const endTime = Date.now();
          const finalSession = {
            ...session,
            endTime,
            duration: endTime - session.startTime
          };

          state.recordingSession = null;

          logger.info(`✅ Tobii 5 recording stopped: ${session.recordingId}`);
          eventEmitter.emit('recordingStopped', {
            deviceId,
            recordingId: session.recordingId,
            duration: finalSession.duration,
            timestamp: endTime
          });

          return {
            success: true,
            session: finalSession
          };
        }

        return { success: false, error: result.error };
      } catch (error) {
        logger.error(`Failed to stop Tobii 5 recording: ${error.message}`);
        return { success: false, error: error.message };
      }
    },

    getRecordingStatus: () => {
      return {
        isRecording: Boolean(state.recordingSession),
        session: state.recordingSession
      };
    },

    // Calibration interface (for calibration controller)
    startCalibration: async (calibrationConfig = {}) => {
      logger.info(`Starting Tobii 5 calibration: ${deviceId}`);

      if (state.calibrationSession) {
        return {
          success: false,
          error: 'Calibration already in progress',
          activeSession: state.calibrationSession
        };
      }

      try {
        const result = await remoteClient.requestCalibration(calibrationConfig);
        
        state.calibrationSession = {
          startTime: Date.now(),
          config: calibrationConfig,
          deviceId,
          status: 'in_progress'
        };

        logger.info(`✅ Tobii 5 calibration started: ${deviceId}`);
        eventEmitter.emit('calibrationStarted', {
          deviceId,
          timestamp: Date.now()
        });

        return {
          success: true,
          session: state.calibrationSession,
          result
        };
      } catch (error) {
        logger.error(`Failed to start Tobii 5 calibration: ${error.message}`);
        return { success: false, error: error.message };
      }
    },

    stopCalibration: async () => {
      if (!state.calibrationSession) {
        return { success: false, error: 'No active calibration session' };
      }

      const session = state.calibrationSession;
      logger.info(`Stopping Tobii 5 calibration: ${deviceId}`);

      try {
        const result = await remoteClient.stopCalibration();
        
        const endTime = Date.now();
        const finalSession = {
          ...session,
          endTime,
          duration: endTime - session.startTime,
          status: 'completed'
        };

        state.calibrationSession = null;

        logger.info(`✅ Tobii 5 calibration stopped: ${deviceId}`);
        eventEmitter.emit('calibrationStopped', {
          deviceId,
          duration: finalSession.duration,
          timestamp: endTime
        });

        return {
          success: true,
          session: finalSession,
          result
        };
      } catch (error) {
        logger.error(`Failed to stop Tobii 5 calibration: ${error.message}`);
        return { success: false, error: error.message };
      }
    },

    getCalibrationStatus: () => {
      return {
        isCalibrating: Boolean(state.calibrationSession),
        session: state.calibrationSession
      };
    },

    // Event handling (for event notifier)
    on: (event, callback) => eventEmitter.on(event, callback),
    off: (event, callback) => eventEmitter.off(event, callback),
    once: (event, callback) => eventEmitter.once(event, callback),

    // Cleanup
    cleanup: async () => {
      logger.info(`🧹 Cleaning up Tobii 5 device: ${deviceId}`);
      
      // Stop any active sessions
      if (state.recordingSession) {
        await this.stopRecording();
      }
      
      if (state.calibrationSession) {
        await this.stopCalibration();
      }
      
      // Disconnect and cleanup
      await this.disconnect();
      remoteClient.cleanup();
      eventEmitter.removeAllListeners();
      
      logger.info(`✅ Tobii 5 device cleaned up: ${deviceId}`);
    }
  };
};