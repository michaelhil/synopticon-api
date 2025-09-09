/**
 * @fileoverview Eye Tracking Real-time Streaming Integration
 * 
 * Comprehensive streaming orchestration integrating eye tracking streams
 * with multimodal synchronization and device management.
 * Following functional programming patterns with factory functions.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createDataStream, streamFactory } from '../../../../core/state/streams.js';
import { createSynchronizationEngine } from '../../../../core/orchestration/synchronization/sync-engine.js';
import { createEyeTrackerDevice } from './device.js';
import { createDeviceDiscovery } from './discovery.js';
import { createEyeTrackingResult, createGazeData } from '../../../../core/configuration/types.js';

/**
 * Streaming configuration interface
 */
export interface EyeTrackingStreamingConfig {
  sampleRate?: number;
  bufferSize?: number;
  syncTolerance?: number;
  enableQualityMonitoring?: boolean;
  useMockDevices?: boolean;
  discoveryTimeout?: number;
  enableSynchronization?: boolean;
  syncStrategy?: 'hardware_timestamp' | 'software_timestamp' | 'arrival_time';
  autoStart?: boolean;
  autoConnect?: boolean;
  deviceConfig?: any;
}

/**
 * Device connection event types
 */
export type DeviceConnectionEventType = 'discovered' | 'updated' | 'connected' | 'disconnected' | 'connection_change';

/**
 * Device connection event
 */
export interface DeviceConnectionEvent {
  event: DeviceConnectionEventType;
  device?: any;
  deviceId?: string;
  oldState?: string;
  newState?: string;
}

/**
 * Stream configuration
 */
export interface StreamConfig {
  sampleRate: number;
  bufferSize: number;
  syncTolerance: number;
  enableQualityMonitoring: boolean;
}

/**
 * Device discovery interface
 */
interface DeviceDiscovery {
  startDiscovery: () => Promise<void>;
  stopDiscovery: () => void;
  cleanup: () => void;
  getDeviceById: (id: string) => any | null;
  getDiscoveredDevices: () => any[];
  getDeviceCount: () => number;
  onDeviceFound: (callback: (device: any) => void) => void;
  onDeviceUpdated: (callback: (device: any) => void) => void;
  onError: (callback: (error: Error) => void) => void;
}

/**
 * Synchronization engine interface
 */
interface SynchronizationEngine {
  addStream: (streamId: string, stream: any) => void;
  removeStream: (streamId: string) => void;
  stop: () => void;
  getStats: () => any;
  onSynchronizedData: (callback: (syncedStreams: any[]) => void) => void;
}

/**
 * Eye tracker device interface (simplified)
 */
interface EyeTrackerDeviceInterface {
  connect: () => Promise<void>;
  cleanup: () => void;
  getGazeStream: () => any;
  getDeviceId: () => string;
  onGazeData: (callback: (data: any) => void) => void;
  onConnectionChange: (callback: (change: any) => void) => void;
  onError: (callback: (error: Error) => void) => void;
}

/**
 * Eye tracking streaming system interface
 */
export interface EyeTrackingStreaming {
  // Control
  start: () => Promise<void>;
  stop: () => void;
  
  // Device management
  connectDevice: (deviceId: string) => Promise<EyeTrackerDeviceInterface>;
  disconnectDevice: (deviceId: string) => void;
  autoConnect: () => Promise<EyeTrackerDeviceInterface>;
  
  // Discovery
  getDiscoveredDevices: () => any[];
  getConnectedDevices: () => string[];
  getDevice: (deviceId: string) => EyeTrackerDeviceInterface | undefined;
  
  // Synchronization
  getSynchronizationEngine: () => SynchronizationEngine | null;
  addExternalStream: (streamId: string, stream: any) => void;
  
  // Event handlers
  onGazeData: (callback: (data: any) => void) => () => void;
  onDeviceConnection: (callback: (event: DeviceConnectionEvent) => void) => () => void;
  onStreamUpdate: (callback: (result: any) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
  
  // Status
  isActive: () => boolean;
  getStats: () => StreamingStats;
  
  // Configuration
  updateConfig: (newConfig: Partial<StreamConfig>) => void;
}

/**
 * Streaming statistics
 */
export interface StreamingStats {
  isActive: boolean;
  connectedDevices: number;
  activeStreams: number;
  discoveredDevices: number;
  syncEngine: any | null;
  streamConfig: StreamConfig;
}

/**
 * Internal streaming state
 */
interface StreamingState {
  devices: Map<string, EyeTrackerDeviceInterface>;
  streams: Map<string, any>;
  discovery: DeviceDiscovery | null;
  synchronization: SynchronizationEngine | null;
  isActive: boolean;
  callbacks: {
    onGazeData: Array<(data: any) => void>;
    onDeviceConnection: Array<(event: DeviceConnectionEvent) => void>;
    onStreamUpdate: Array<(result: any) => void>;
    onError: Array<(error: Error) => void>;
  };
  streamConfig: StreamConfig;
}

/**
 * Eye tracking stream orchestrator factory
 */
export const createEyeTrackingStreaming = (config: EyeTrackingStreamingConfig = {}): EyeTrackingStreaming => {
  const state: StreamingState = {
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
  const initializeDiscovery = (): void => {
    state.discovery = createDeviceDiscovery({
      useMockDevices: config.useMockDevices !== false,
      discoveryTimeout: config.discoveryTimeout || 10000
    }) as DeviceDiscovery;

    // Handle device discovery
    state.discovery.onDeviceFound((device: any) => {
      console.log(`Eye tracker discovered: ${device.name} (${device.id})`);
      
      state.callbacks.onDeviceConnection.forEach(cb => {
        try {
          cb({ event: 'discovered', device });
        } catch (error) {
          console.warn('Device connection callback error:', error);
        }
      });
    });

    state.discovery.onDeviceUpdated((device: any) => {
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

    state.discovery.onError((error: Error) => {
      notifyError(new Error(`Discovery error: ${error.message}`));
    });
  };

  // Initialize synchronization engine
  const initializeSynchronization = (): void => {
    state.synchronization = createSynchronizationEngine({
      tolerance: state.streamConfig.syncTolerance,
      strategy: config.syncStrategy || 'hardware_timestamp',
      bufferSize: 100
    }) as SynchronizationEngine;

    // Handle synchronized data
    state.synchronization.onSynchronizedData((syncedStreams: any[]) => {
      const eyeTrackingData = syncedStreams.filter(stream => stream.streamType === 'eyetracking');
      
      if (eyeTrackingData.length > 0) {
        const result = createEyeTrackingResult({
          timestamp: syncedStreams[0]?.timestamp || Date.now(),
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
  const calculateSyncQuality = (streams: any[]): number => {
    if (streams.length < 2) return 1.0;
    
    const timestamps = streams.map(s => s.timestamp);
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    
    // Quality decreases as time difference increases
    return Math.max(0, 1 - (maxDiff / state.streamConfig.syncTolerance));
  };

  // Connect to eye tracker device
  const connectDevice = async (deviceId: string): Promise<EyeTrackerDeviceInterface> => {
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
    }) as EyeTrackerDeviceInterface;

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
  const setupDeviceHandlers = (eyeTracker: EyeTrackerDeviceInterface): void => {
    eyeTracker.onGazeData((gazeData: any) => {
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

    eyeTracker.onConnectionChange((change: any) => {
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

    eyeTracker.onError((error: Error) => {
      notifyError(new Error(`Device ${eyeTracker.getDeviceId()} error: ${error.message}`));
    });
  };

  // Disconnect device
  const disconnectDevice = (deviceId: string): void => {
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
  const start = async (): Promise<void> => {
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
  const stop = (): void => {
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
  const autoConnect = async (): Promise<EyeTrackerDeviceInterface> => {
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
  const getStats = (): StreamingStats => ({
    isActive: state.isActive,
    connectedDevices: state.devices.size,
    activeStreams: state.streams.size,
    discoveredDevices: state.discovery ? state.discovery.getDeviceCount() : 0,
    syncEngine: state.synchronization ? state.synchronization.getStats() : null,
    streamConfig: { ...state.streamConfig }
  });

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
  const onGazeData = (callback: (data: any) => void): (() => void) => {
    state.callbacks.onGazeData.push(callback);
    return () => {
      const index = state.callbacks.onGazeData.indexOf(callback);
      if (index !== -1) state.callbacks.onGazeData.splice(index, 1);
    };
  };

  const onDeviceConnection = (callback: (event: DeviceConnectionEvent) => void): (() => void) => {
    state.callbacks.onDeviceConnection.push(callback);
    return () => {
      const index = state.callbacks.onDeviceConnection.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceConnection.splice(index, 1);
    };
  };

  const onStreamUpdate = (callback: (result: any) => void): (() => void) => {
    state.callbacks.onStreamUpdate.push(callback);
    return () => {
      const index = state.callbacks.onStreamUpdate.indexOf(callback);
      if (index !== -1) state.callbacks.onStreamUpdate.splice(index, 1);
    };
  };

  const onError = (callback: (error: Error) => void): (() => void) => {
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
    getDevice: (deviceId: string) => state.devices.get(deviceId),
    
    // Synchronization
    getSynchronizationEngine: () => state.synchronization,
    addExternalStream: (streamId: string, stream: any) => {
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
    updateConfig: (newConfig: Partial<StreamConfig>) => {
      Object.assign(state.streamConfig, newConfig);
    }
  };
};

/**
 * Convenience factory for quick setup
 */
export const createEyeTrackingSystem = (config: EyeTrackingStreamingConfig = {}): EyeTrackingStreaming => {
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

/**
 * Streaming utility functions
 */
export const StreamingUtils = {
  /**
   * Validate streaming configuration
   */
  validateConfig: (config: EyeTrackingStreamingConfig): boolean => {
    if (config.sampleRate !== undefined && config.sampleRate <= 0) {
      return false;
    }
    
    if (config.bufferSize !== undefined && config.bufferSize <= 0) {
      return false;
    }
    
    if (config.syncTolerance !== undefined && config.syncTolerance < 0) {
      return false;
    }
    
    if (config.discoveryTimeout !== undefined && config.discoveryTimeout <= 0) {
      return false;
    }
    
    const validSyncStrategies = ['hardware_timestamp', 'software_timestamp', 'arrival_time'];
    if (config.syncStrategy && !validSyncStrategies.includes(config.syncStrategy)) {
      return false;
    }
    
    return true;
  },

  /**
   * Create default streaming configuration
   */
  createDefaultConfig: (overrides: Partial<EyeTrackingStreamingConfig> = {}): EyeTrackingStreamingConfig => ({
    sampleRate: 200,
    bufferSize: 2000,
    syncTolerance: 10,
    enableQualityMonitoring: true,
    useMockDevices: true,
    discoveryTimeout: 10000,
    enableSynchronization: true,
    syncStrategy: 'hardware_timestamp',
    autoStart: false,
    autoConnect: false,
    ...overrides
  }),

  /**
   * Calculate streaming performance metrics
   */
  calculatePerformanceMetrics: (stats: StreamingStats): {
    efficiency: number;
    reliability: number;
    throughput: number;
  } => {
    const efficiency = stats.activeStreams > 0 ? 
      (stats.connectedDevices / stats.activeStreams) * 100 : 0;
    
    const reliability = stats.discoveredDevices > 0 ?
      (stats.connectedDevices / stats.discoveredDevices) * 100 : 0;
    
    const throughput = stats.streamConfig.sampleRate * stats.connectedDevices;
    
    return {
      efficiency: Math.min(100, efficiency),
      reliability: Math.min(100, reliability),
      throughput
    };
  },

  /**
   * Generate streaming health report
   */
  generateHealthReport: (stats: StreamingStats): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!stats.isActive) {
      issues.push('Streaming system is not active');
      recommendations.push('Start the streaming system');
    }
    
    if (stats.connectedDevices === 0) {
      issues.push('No devices connected');
      recommendations.push('Connect at least one eye tracking device');
    }
    
    if (stats.discoveredDevices === 0) {
      issues.push('No devices discovered');
      recommendations.push('Check device connectivity and discovery settings');
    }
    
    if (stats.connectedDevices < stats.discoveredDevices) {
      issues.push('Some discovered devices are not connected');
      recommendations.push('Check device connection status and troubleshoot failed connections');
    }
    
    let status: 'healthy' | 'warning' | 'critical';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (stats.connectedDevices > 0) {
      status = 'warning';
    } else {
      status = 'critical';
    }
    
    return { status, issues, recommendations };
  }
};
