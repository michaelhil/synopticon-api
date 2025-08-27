/**
 * Multi-Device Streaming Coordinator
 * Manages streaming across multiple devices with centralized control
 * Following functional programming patterns with factory functions
 */

import { createQualityController } from './quality-controller.js';
import { createDeviceManager } from './device-manager.js';
import { createStreamManager } from './stream-manager.js';
import { createNetworkMonitor } from './network-monitor.js';
import { createEventSystem } from './event-system.js';

/**
 * Create multi-device streaming coordinator
 * @param {Object} config - Coordinator configuration
 * @returns {Object} Multi-device coordinator
 */
export const createMultiDeviceCoordinator = (config = {}) => {
  // Configuration
  const coordinatorConfig = {
    groupSettings: {
      syncStreaming: config.syncStreaming !== false,
      globalQualityControl: config.globalQualityControl !== false,
      loadBalancing: config.loadBalancing !== false
    },
    pipelineConfig: config.pipelineConfig,
    adaptiveQuality: config.adaptiveQuality !== false
  };

  // Create event system
  const eventSystem = createEventSystem();

  // Initialize global quality controller if enabled
  let globalQualityController = null;
  if (coordinatorConfig.groupSettings.globalQualityControl) {
    globalQualityController = createQualityController({
      deviceId: 'global',
      deviceType: 'coordinator',
      initialQuality: config.defaultQuality || 'medium',
      adaptationEnabled: config.globalAdaptation !== false,
      onQualityChange: (qualityInfo) => {
        // Apply quality changes to all active streams
        if (config.syncQualityChanges !== false) {
          streamManager.applyGlobalQualityChange(qualityInfo.recommendedQuality);
        }
      }
    });
  }

  // Create device manager
  const deviceManager = createDeviceManager(coordinatorConfig, eventSystem.notifyCallbacks);

  // Create stream manager
  const streamManager = createStreamManager(
    deviceManager, 
    globalQualityController, 
    coordinatorConfig, 
    eventSystem.notifyCallbacks
  );

  // Create network monitor
  const networkMonitor = createNetworkMonitor(deviceManager, globalQualityController);

  // Add device to coordinator
  const addDevice = async (deviceInfo) => {
    return deviceManager.addDevice(deviceInfo);
  };

  // Remove device from coordinator
  const removeDevice = async (deviceId) => {
    return deviceManager.removeDevice(deviceId, streamManager.stopStream);
  };

  // Stream control methods
  const {startStream} = streamManager;
  const {stopStream} = streamManager;
  const {startMultipleStreams} = streamManager;
  const {stopMultipleStreams} = streamManager;

  // Quality control methods
  const {applyGlobalQualityChange} = streamManager;
  const {rebalanceStreams} = streamManager;

  // Network and monitoring methods
  const {updateNetworkStats} = networkMonitor;
  const {getNetworkStats} = networkMonitor;
  const {startNetworkMonitoring} = networkMonitor;

  // Getters
  const {getDevices} = deviceManager;
  const {getDevice} = deviceManager;
  const {getPipeline} = deviceManager;
  const {getActiveStreams} = streamManager;
  const getGroupSettings = () => ({ ...coordinatorConfig.groupSettings });
  
  const getCoordinatorStatus = () => ({
    totalDevices: deviceManager.getDevices().length,
    activeStreams: streamManager.getActiveStreams().length,
    networkStats: networkMonitor.getNetworkStats(),
    groupSettings: coordinatorConfig.groupSettings,
    globalQualityEnabled: !!globalQualityController,
    lastUpdate: Date.now()
  });

  // Cleanup coordinator
  const cleanup = async () => {
    console.log('🧹 Cleaning up multi-device coordinator...');
    
    // Stop all active streams
    await streamManager.stopAllStreams();

    // Cleanup device manager
    await deviceManager.cleanup();
    
    // Clear event callbacks
    eventSystem.cleanup();

    console.log('✅ Multi-device coordinator cleanup completed');
  };

  return {
    // Device management
    addDevice,
    removeDevice,
    getDevices,
    getDevice,
    getPipeline,
    
    // Stream control
    startStream,
    stopStream,
    startMultipleStreams,
    stopMultipleStreams,
    
    // Quality control
    applyGlobalQualityChange,
    rebalanceStreams,
    
    // Network and stats
    updateNetworkStats,
    getNetworkStats,
    startNetworkMonitoring,
    
    // Status and configuration
    getActiveStreams,
    getGroupSettings,
    getCoordinatorStatus,
    
    // Event handlers
    onDeviceAdded: eventSystem.onDeviceAdded,
    onDeviceRemoved: eventSystem.onDeviceRemoved,
    onStreamStarted: eventSystem.onStreamStarted,
    onStreamStopped: eventSystem.onStreamStopped,
    onQualityChanged: eventSystem.onQualityChanged,
    onError: eventSystem.onError,
    
    // Lifecycle
    cleanup
  };
};

