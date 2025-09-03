/**
 * Remote Tobii Client
 * Connects to lightweight C++ bridge running on Windows PC with Tobii 5
 * Provides real-time gaze and head tracking data over WebSocket
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../../shared/utils/logger.js';

const logger = createLogger({ level: 2, component: 'Tobii5RemoteClient' });

/**
 * Tobii data packet structure from C++ bridge
 */
const TOBII_MESSAGE_TYPES = {
  DATA: 'tobii-data',
  STATUS: 'tobii-status', 
  CALIBRATION: 'tobii-calibration',
  ERROR: 'tobii-error',
  HEARTBEAT: 'tobii-heartbeat'
};

export const createRemoteTobiiClient = (config = {}) => {
  const {
    host = 'localhost',
    port = 8080,
    reconnectInterval = 5000,
    heartbeatTimeout = 10000,
    dataBufferSize = 100
  } = config;

  const emitter = new EventEmitter();
  const state = {
    ws: null,
    connected: false,
    connecting: false,
    lastDataTimestamp: 0,
    lastHeartbeat: 0,
    reconnectTimer: null,
    heartbeatTimer: null,
    dataBuffer: [],
    stats: {
      packetsReceived: 0,
      packetsLost: 0,
      avgLatency: 0,
      dataRate: 0
    }
  };

  let latencyBuffer = [];
  let lastSecondPackets = 0;
  let dataRateTimer = null;

  const wsUrl = `ws://${host}:${port}`;

  /**
   * Connect to Tobii bridge
   */
  const connect = async () => {
    if (state.connecting || state.connected) {
      return { success: true };
    }

    state.connecting = true;
    logger.info(`Connecting to Tobii bridge at ${wsUrl}`);

    try {
      // Dynamic import for WebSocket (Node.js compatibility)
      const WebSocketModule = await import('ws');
      const WebSocket = WebSocketModule.default || WebSocketModule.WebSocket;

      state.ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          state.connecting = false;
          reject(new Error(`Connection timeout to ${wsUrl}`));
        }, 5000);

        state.ws.onopen = () => {
          clearTimeout(timeout);
          state.connected = true;
          state.connecting = false;
          state.lastHeartbeat = Date.now();
          
          logger.info('✅ Connected to Tobii bridge');
          setupHeartbeatMonitor();
          startDataRateMonitoring();
          emitter.emit('connected');
          
          resolve({ success: true });
        };

        state.ws.onmessage = (event) => {
          handleMessage(event.data);
        };

        state.ws.onclose = (event) => {
          logger.warn(`Tobii bridge connection closed: ${event.code} ${event.reason}`);
          handleDisconnection();
        };

        state.ws.onerror = (error) => {
          clearTimeout(timeout);
          state.connecting = false;
          logger.error('Tobii bridge connection error:', error.message);
          reject(new Error(`WebSocket error: ${error.message}`));
        };
      });
    } catch (error) {
      state.connecting = false;
      logger.error('Failed to create WebSocket connection:', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  };

  /**
   * Disconnect from Tobii bridge
   */
  const disconnect = () => {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }

    if (dataRateTimer) {
      clearInterval(dataRateTimer);
      dataRateTimer = null;
    }

    if (state.ws) {
      state.ws.close();
      state.ws = null;
    }

    state.connected = false;
    state.connecting = false;
    logger.info('Disconnected from Tobii bridge');
    emitter.emit('disconnected');
  };

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = (data) => {
    try {
      const message = JSON.parse(data);
      const receiveTime = Date.now();
      
      // Calculate latency
      if (message.timestamp) {
        const latency = receiveTime - message.timestamp;
        latencyBuffer.push(latency);
        if (latencyBuffer.length > 10) latencyBuffer.shift();
        
        state.stats.avgLatency = latencyBuffer.reduce((a, b) => a + b, 0) / latencyBuffer.length;
      }

      state.stats.packetsReceived++;
      lastSecondPackets++;

      switch (message.type) {
        case TOBII_MESSAGE_TYPES.DATA:
          handleDataMessage(message, receiveTime);
          break;
          
        case TOBII_MESSAGE_TYPES.STATUS:
          handleStatusMessage(message);
          break;
          
        case TOBII_MESSAGE_TYPES.CALIBRATION:
          handleCalibrationMessage(message);
          break;
          
        case TOBII_MESSAGE_TYPES.HEARTBEAT:
          state.lastHeartbeat = receiveTime;
          break;
          
        case TOBII_MESSAGE_TYPES.ERROR:
          logger.error('Tobii bridge error:', message.error);
          emitter.emit('error', new Error(message.error));
          break;
          
        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Failed to parse Tobii message:', error);
      state.stats.packetsLost++;
    }
  };

  /**
   * Handle Tobii data messages
   */
  const handleDataMessage = (message, receiveTime) => {
    const { data } = message;
    
    // Validate data structure
    if (!data || typeof data !== 'object') {
      logger.warn('Invalid Tobii data structure');
      return;
    }

    // Enhanced data packet with metadata
    const enhancedData = {
      timestamp: receiveTime,
      bridgeTimestamp: message.timestamp,
      latency: state.stats.avgLatency,
      
      // Gaze data
      gaze: data.gaze ? {
        x: data.gaze.x,
        y: data.gaze.y,
        timestamp: data.gaze.timestamp,
        valid: data.hasGaze || false
      } : null,
      
      // Head pose data
      head: data.head ? {
        yaw: data.head.yaw,
        pitch: data.head.pitch,
        roll: data.head.roll,
        position: {
          x: data.head.position?.x || 0,
          y: data.head.position?.y || 0, 
          z: data.head.position?.z || 0
        },
        valid: data.hasHead || false
      } : null,
      
      // Presence detection
      present: Boolean(data.present),
      
      // Quality metrics
      quality: {
        gazeConfidence: data.gaze?.confidence || 0,
        headConfidence: data.head?.confidence || 0,
        overallQuality: calculateDataQuality(data)
      }
    };

    // Add to buffer
    state.dataBuffer.push(enhancedData);
    if (state.dataBuffer.length > dataBufferSize) {
      state.dataBuffer.shift();
    }

    state.lastDataTimestamp = receiveTime;
    
    // Emit to subscribers
    emitter.emit('data', enhancedData);
  };

  /**
   * Handle status messages from bridge
   */
  const handleStatusMessage = (message) => {
    logger.debug('Tobii bridge status update:', message.status);
    emitter.emit('status', message.status);
  };

  /**
   * Handle calibration messages
   */
  const handleCalibrationMessage = (message) => {
    logger.info('Calibration update:', message.calibration);
    emitter.emit('calibration', message.calibration);
  };

  /**
   * Calculate overall data quality score
   */
  const calculateDataQuality = (data) => {
    let quality = 0;
    let factors = 0;

    if (data.hasGaze && data.gaze) {
      quality += data.gaze.confidence || 0.8;
      factors++;
    }

    if (data.hasHead && data.head) {
      quality += data.head.confidence || 0.8;
      factors++;
    }

    if (data.present) {
      quality += 0.9;
      factors++;
    }

    return factors > 0 ? quality / factors : 0;
  };

  /**
   * Handle connection loss and setup reconnection
   */
  const handleDisconnection = () => {
    state.connected = false;
    state.ws = null;
    
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }

    emitter.emit('disconnected');
    
    // Auto-reconnect
    if (!state.reconnectTimer) {
      logger.info(`Reconnecting to Tobii bridge in ${reconnectInterval}ms`);
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        connect().catch(error => {
          logger.error('Reconnection failed:', error.message);
        });
      }, reconnectInterval);
    }
  };

  /**
   * Setup heartbeat monitoring
   */
  const setupHeartbeatMonitor = () => {
    state.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - state.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > heartbeatTimeout) {
        logger.warn('Heartbeat timeout - connection may be lost');
        if (state.ws && state.ws.readyState === 1) {
          state.ws.close();
        }
      }
    }, heartbeatTimeout / 2);
  };

  /**
   * Monitor data rate
   */
  const startDataRateMonitoring = () => {
    dataRateTimer = setInterval(() => {
      state.stats.dataRate = lastSecondPackets;
      lastSecondPackets = 0;
    }, 1000);
  };

  /**
   * Send command to bridge
   */
  const sendCommand = (command, data = {}) => {
    if (!state.connected || !state.ws) {
      throw new Error('Not connected to Tobii bridge');
    }

    const message = {
      type: command,
      timestamp: Date.now(),
      data
    };

    state.ws.send(JSON.stringify(message));
  };

  /**
   * Request calibration from bridge
   */
  const requestCalibration = async (calibrationConfig = {}) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        emitter.off('calibration', handler);
        reject(new Error('Calibration request timeout'));
      }, 30000);

      const handler = (result) => {
        clearTimeout(timeout);
        emitter.off('calibration', handler);
        resolve(result);
      };

      emitter.once('calibration', handler);
      
      try {
        sendCommand('start-calibration', calibrationConfig);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  };

  /**
   * Stop calibration
   */
  const stopCalibration = async () => {
    try {
      sendCommand('stop-calibration');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Enable/disable recording on bridge
   */
  const enableRecording = (enabled) => {
    try {
      sendCommand('set-recording', { enabled });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Public API
  return {
    // Connection management
    connect,
    disconnect,
    
    // Status
    getStatus: () => ({
      connected: state.connected,
      connecting: state.connecting,
      host,
      port,
      stats: { ...state.stats }
    }),
    
    // Data access
    getLatestData: () => state.dataBuffer[state.dataBuffer.length - 1] || null,
    getDataBuffer: () => [...state.dataBuffer],
    getLastDataTimestamp: () => state.lastDataTimestamp,
    
    // Commands
    requestCalibration,
    stopCalibration,
    enableRecording,
    sendCommand,
    
    // Events
    on: (event, callback) => emitter.on(event, callback),
    off: (event, callback) => emitter.off(event, callback),
    once: (event, callback) => emitter.once(event, callback),
    
    // Data subscriptions
    onData: (callback) => {
      emitter.on('data', callback);
      return () => emitter.off('data', callback);
    },
    
    onStatus: (callback) => {
      emitter.on('status', callback);
      return () => emitter.off('status', callback);
    },
    
    onError: (callback) => {
      emitter.on('error', callback);
      return () => emitter.off('error', callback);
    },
    
    // Cleanup
    cleanup: () => {
      disconnect();
      emitter.removeAllListeners();
      logger.info('🧹 Tobii remote client cleaned up');
    }
  };
};