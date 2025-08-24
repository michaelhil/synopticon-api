/**
 * Eye Tracking Real-time Streaming Integration
 * Integrates eye tracking streams with existing multimodal synchronization
 * Following functional programming patterns with factory functions
 */

import { createDataStream, streamFactory } from '../core/streams.js';
import { createSynchronizationEngine } from '../core/synchronization.js';
import { createEyeTrackerDevice } from './device.js';
import { createDeviceDiscovery } from './discovery.js';
import { createEyeTrackingResult, createGazeData } from '../core/types.js';

// Eye tracking stream orchestrator factory
export const createEyeTrackingStreaming = (config = {}) => {
  const state = {
    devices: new Map(),
    streams: new Map(),
    discovery: null,
    synchronization: null,
    isActive: false,
    callbacks: {
      onGazeData: [],
      onDeviceConnection: [],
      onStreamUpdate: [],
      onError: []
    },
    streamConfig: {
      sampleRate: config.sampleRate || 200,
      bufferSize: config.bufferSize || 2000,
      syncTolerance: config.syncTolerance || 10, // 10ms tolerance
      enableQualityMonitoring: config.enableQualityMonitoring !== false
    }
  };

  // Initialize discovery service
  const initializeDiscovery = () => {
    state.discovery = createDeviceDiscovery({
      useMockDevices: config.useMockDevices !== false,
      discoveryTimeout: config.discoveryTimeout || 10000
    });

    // Handle device discovery
    state.discovery.onDeviceFound((device) => {
      console.log(`Eye tracker discovered: ${device.name} (${device.id})`);
      
      state.callbacks.onDeviceConnection.forEach(cb => {
        try {
          cb({ event: 'discovered', device });
        } catch (error) {
          console.warn('Device connection callback error:', error);
        }
      });
    });

    state.discovery.onDeviceUpdated((device) => {
      // Update device status in existing connections
      const eyeTracker = state.devices.get(device.id);
      if (eyeTracker) {
        // Notify about device status updates
        state.callbacks.onDeviceConnection.forEach(cb => {
          try {
            cb({ event: 'updated', device });
          } catch (error) {
            console.warn('Device connection callback error:', error);
          }
        });
      }
    });

    state.discovery.onError((error) => {
      notifyError(new Error(`Discovery error: ${error.message}`));
    });
  };

  // Initialize synchronization engine
  const initializeSynchronization = () => {
    state.synchronization = createSynchronizationEngine({
      tolerance: state.streamConfig.syncTolerance,
      strategy: config.syncStrategy || 'hardware_timestamp',
      bufferSize: 100
    });

    // Handle synchronized data
    state.synchronization.onSynchronizedData((syncedStreams) => {
      const eyeTrackingData = syncedStreams.filter(stream => stream.streamType === 'eyetracking');
      
      if (eyeTrackingData.length > 0) {
        const result = createEyeTrackingResult({
          timestamp: syncedStreams[0].timestamp,
          gazeData: eyeTrackingData,
          synchronizedWith: syncedStreams.filter(s => s.streamType !== 'eyetracking').map(s => s.streamType),
          quality: calculateSyncQuality(syncedStreams)
        });

        state.callbacks.onStreamUpdate.forEach(cb => {
          try {
            cb(result);
          } catch (error) {
            console.warn('Stream update callback error:', error);
          }
        });
      }
    });
  };

  // Calculate synchronization quality
  const calculateSyncQuality = (streams) => {
    if (streams.length < 2) return 1.0;
    
    const timestamps = streams.map(s => s.timestamp);
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    
    // Quality decreases as time difference increases
    return Math.max(0, 1 - (maxDiff / state.streamConfig.syncTolerance));
  };

  // Connect to eye tracker device
  const connectDevice = async (deviceId) => {
    if (state.devices.has(deviceId)) {
      throw new Error(`Device ${deviceId} already connected`);
    }

    let deviceInfo = state.discovery ? state.discovery.getDeviceById(deviceId) : null;
    if (!deviceInfo && config.useMockDevices !== false) {
      // Create mock device info for testing
      deviceInfo = {
        id: deviceId,
        address: process.env.NEON_DEVICE_ADDRESS || 'localhost',
        port: 8080,
        name: `Mock Device ${deviceId}`
      };
    } else if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const eyeTracker = createEyeTrackerDevice({
      deviceId: deviceInfo.id,
      address: deviceInfo.address,
      port: deviceInfo.port,
      mockMode: config.useMockDevices !== false,
      autoReconnect: true,
      ...config.deviceConfig
    });

    // Setup device event handlers
    setupDeviceHandlers(eyeTracker);

    // Connect to device
    await eyeTracker.connect();

    // Store device and create stream
    state.devices.set(deviceId, eyeTracker);
    
    const gazeStream = eyeTracker.getGazeStream();
    state.streams.set(deviceId, gazeStream);

    // Register stream with synchronization engine if available
    if (state.synchronization) {
      state.synchronization.addStream(`eyetracking-${deviceId}`, gazeStream);
    }

    state.callbacks.onDeviceConnection.forEach(cb => {
      try {
        cb({ event: 'connected', device: deviceInfo, deviceId });
      } catch (error) {
        console.warn('Device connection callback error:', error);
      }
    });

    return eyeTracker;
  };

  // Setup device event handlers
  const setupDeviceHandlers = (eyeTracker) => {
    eyeTracker.onGazeData((gazeData) => {
      // Forward gaze data to callbacks
      state.callbacks.onGazeData.forEach(cb => {
        try {
          cb(gazeData);
        } catch (error) {
          console.warn('Gaze data callback error:', error);
        }
      });

      // Add to synchronization if active and not using synchronization callbacks
      if (!state.synchronization && state.callbacks.onStreamUpdate.length > 0) {
        // Direct streaming without synchronization
        const result = createEyeTrackingResult({
          timestamp: gazeData.timestamp,
          gazeData: [gazeData],
          synchronizedWith: [],
          quality: 1.0
        });

        state.callbacks.onStreamUpdate.forEach(cb => {
          try {
            cb(result);
          } catch (error) {
            console.warn('Stream update callback error:', error);
          }
        });
      }
    });

    eyeTracker.onConnectionChange((change) => {
      state.callbacks.onDeviceConnection.forEach(cb => {
        try {
          cb({ 
            event: 'connection_change', 
            deviceId: change.deviceId,
            oldState: change.oldState,
            newState: change.newState 
          });
        } catch (error) {
          console.warn('Device connection callback error:', error);
        }
      });
    });

    eyeTracker.onError((error) => {
      notifyError(new Error(`Device ${eyeTracker.getDeviceId()} error: ${error.message}`));
    });
  };

  // Disconnect device
  const disconnectDevice = (deviceId) => {
    const eyeTracker = state.devices.get(deviceId);
    if (!eyeTracker) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    // Remove from synchronization
    if (state.synchronization) {
      state.synchronization.removeStream(`eyetracking-${deviceId}`);
    }

    // Cleanup device
    eyeTracker.cleanup();

    // Remove from state
    state.devices.delete(deviceId);
    state.streams.delete(deviceId);

    state.callbacks.onDeviceConnection.forEach(cb => {
      try {
        cb({ event: 'disconnected', deviceId });
      } catch (error) {
        console.warn('Device connection callback error:', error);
      }
    });
  };

  // Start streaming system
  const start = async () => {
    if (state.isActive) return;

    // Initialize components
    initializeDiscovery();
    if (config.enableSynchronization !== false) {
      initializeSynchronization();
    }

    // Start discovery
    if (state.discovery) {
      await state.discovery.startDiscovery();
    }

    state.isActive = true;
  };

  // Stop streaming system
  const stop = () => {
    if (!state.isActive) return;

    // Stop discovery
    if (state.discovery) {
      state.discovery.stopDiscovery();
      state.discovery.cleanup();
    }

    // Disconnect all devices
    for (const deviceId of state.devices.keys()) {
      try {
        disconnectDevice(deviceId);
      } catch (error) {
        console.warn(`Error disconnecting device ${deviceId}:`, error);
      }
    }

    // Stop synchronization
    if (state.synchronization) {
      state.synchronization.stop();
    }

    state.isActive = false;
  };

  // Auto-connect to first discovered device
  const autoConnect = async () => {
    if (!state.discovery) {
      throw new Error('Discovery not initialized');
    }

    const devices = state.discovery.getDiscoveredDevices();
    if (devices.length === 0) {
      throw new Error('No devices discovered');
    }

    const device = devices[0];
    return await connectDevice(device.id);
  };

  // Get streaming statistics
  const getStats = () => ({
    isActive: state.isActive,
    connectedDevices: state.devices.size,
    activeStreams: state.streams.size,
    discoveredDevices: state.discovery ? state.discovery.getDeviceCount() : 0,
    syncEngine: state.synchronization ? state.synchronization.getStats() : null,
    streamConfig: { ...state.streamConfig }
  });

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
  const onGazeData = (callback) => {
    state.callbacks.onGazeData.push(callback);
    return () => {
      const index = state.callbacks.onGazeData.indexOf(callback);
      if (index !== -1) state.callbacks.onGazeData.splice(index, 1);
    };
  };

  const onDeviceConnection = (callback) => {
    state.callbacks.onDeviceConnection.push(callback);
    return () => {
      const index = state.callbacks.onDeviceConnection.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceConnection.splice(index, 1);
    };
  };

  const onStreamUpdate = (callback) => {
    state.callbacks.onStreamUpdate.push(callback);
    return () => {
      const index = state.callbacks.onStreamUpdate.indexOf(callback);
      if (index !== -1) state.callbacks.onStreamUpdate.splice(index, 1);
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
    // Control
    start,
    stop,
    
    // Device management
    connectDevice,
    disconnectDevice,
    autoConnect,
    
    // Discovery
    getDiscoveredDevices: () => state.discovery ? state.discovery.getDiscoveredDevices() : [],
    getConnectedDevices: () => Array.from(state.devices.keys()),
    getDevice: (deviceId) => state.devices.get(deviceId),
    
    // Synchronization
    getSynchronizationEngine: () => state.synchronization,
    addExternalStream: (streamId, stream) => {
      if (state.synchronization) {
        state.synchronization.addStream(streamId, stream);
      }
    },
    
    // Event handlers
    onGazeData,
    onDeviceConnection,
    onStreamUpdate,
    onError,
    
    // Status
    isActive: () => state.isActive,
    getStats,
    
    // Configuration
    updateConfig: (newConfig) => {
      Object.assign(state.streamConfig, newConfig);
    }
  };
};

// Convenience factory for quick setup
export const createEyeTrackingSystem = (config = {}) => {
  const system = createEyeTrackingStreaming(config);
  
  // Auto-start if requested
  if (config.autoStart) {
    system.start().then(() => {
      if (config.autoConnect) {
        system.autoConnect().catch(error => {
          console.warn('Auto-connect failed:', error);
        });
      }
    }).catch(error => {
      console.error('System start failed:', error);
    });
  }
  
  return system;
};