/**
 * Multi-Device Streaming Coordinator
 * Manages streaming across multiple devices with centralized control
 * Following functional programming patterns with factory functions
 */

import { createMediaStreamingPipeline } from './media-streaming-pipeline.js';
import { createQualityController } from './quality-controller.js';

/**
 * Create multi-device streaming coordinator
 * @param {Object} config - Coordinator configuration
 * @returns {Object} Multi-device coordinator
 */
export const createMultiDeviceCoordinator = (config = {}) => {
  const state = {
    devices: new Map(), // deviceId -> device info
    pipelines: new Map(), // deviceId -> streaming pipeline
    activeStreams: new Set(), // Set of active stream IDs
    globalQualityController: null,
    networkStats: {
      totalBandwidth: 0,
      averageLatency: 0,
      packetLoss: 0,
      lastUpdated: null
    },
    groupSettings: {
      syncStreaming: config.syncStreaming !== false,
      globalQualityControl: config.globalQualityControl !== false,
      loadBalancing: config.loadBalancing !== false
    },
    callbacks: {
      onDeviceAdded: [],
      onDeviceRemoved: [],
      onStreamStarted: [],
      onStreamStopped: [],
      onQualityChanged: [],
      onError: []
    }
  };

  // Initialize global quality controller if enabled
  if (state.groupSettings.globalQualityControl) {
    state.globalQualityController = createQualityController({
      deviceId: 'global',
      deviceType: 'coordinator',
      initialQuality: config.defaultQuality || 'medium',
      adaptationEnabled: config.globalAdaptation !== false,
      onQualityChange: (qualityInfo) => {
        // Apply quality changes to all active streams
        if (config.syncQualityChanges !== false) {
          applyGlobalQualityChange(qualityInfo.recommendedQuality);
        }
      }
    });
  }

  // Add device to coordinator
  const addDevice = async (deviceInfo) => {
    const deviceId = deviceInfo.id;
    
    if (state.devices.has(deviceId)) {
      console.warn(`Device ${deviceId} already exists, updating info`);
    }

    // Store device info
    state.devices.set(deviceId, { ...deviceInfo });

    // Create streaming pipeline for device
    const pipeline = createMediaStreamingPipeline(deviceInfo, {
      ...config.pipelineConfig,
      enableQualityControl: !state.groupSettings.globalQualityControl, // Use local if no global
      adaptiveQuality: config.adaptiveQuality !== false
    });

    state.pipelines.set(deviceId, pipeline);

    // Subscribe to pipeline events
    pipeline.onError((error) => {
      notifyCallbacks('onError', { deviceId, error });
    });

    pipeline.onQualityChange((qualityChange) => {
      notifyCallbacks('onQualityChanged', { deviceId, ...qualityChange });
    });

    console.log(`📱 Added device: ${deviceInfo.label} (${deviceId})`);
    notifyCallbacks('onDeviceAdded', { deviceId, deviceInfo });

    return { success: true, deviceId, pipelineCreated: true };
  };

  // Remove device from coordinator
  const removeDevice = async (deviceId) => {
    if (!state.devices.has(deviceId)) {
      throw new Error(`Device ${deviceId} not found`);
    }

    // Stop streaming if active
    if (state.activeStreams.has(deviceId)) {
      await stopStream(deviceId);
    }

    // Cleanup pipeline
    const pipeline = state.pipelines.get(deviceId);
    if (pipeline && pipeline.cleanup) {
      await pipeline.cleanup();
    }

    // Remove from state
    const deviceInfo = state.devices.get(deviceId);
    state.devices.delete(deviceId);
    state.pipelines.delete(deviceId);

    console.log(`🗑️ Removed device: ${deviceInfo.label} (${deviceId})`);
    notifyCallbacks('onDeviceRemoved', { deviceId, deviceInfo });

    return { success: true, deviceId };
  };

  // Start streaming for specific device
  const startStream = async (deviceId, streamConfig = {}) => {
    const pipeline = state.pipelines.get(deviceId);
    if (!pipeline) {
      throw new Error(`Pipeline not found for device: ${deviceId}`);
    }

    if (state.activeStreams.has(deviceId)) {
      return { success: true, message: 'Stream already active', deviceId };
    }

    try {
      // Apply global quality if enabled
      if (state.groupSettings.globalQualityControl && state.globalQualityController) {
        const globalInfo = state.globalQualityController.getQualityInfo();
        if (globalInfo && globalInfo.currentQuality) {
          await pipeline.changeQuality(globalInfo.currentQuality);
        }
      }

      // Start the stream
      const result = await pipeline.startStreaming();
      
      if (result.success) {
        state.activeStreams.add(deviceId);
        notifyCallbacks('onStreamStarted', { deviceId, ...result });
        
        // Update load balancing if enabled
        if (state.groupSettings.loadBalancing) {
          await rebalanceStreams();
        }
      }

      return result;
    } catch (error) {
      console.error(`Failed to start stream for ${deviceId}:`, error);
      notifyCallbacks('onError', { deviceId, error, operation: 'startStream' });
      throw error;
    }
  };

  // Stop streaming for specific device
  const stopStream = async (deviceId) => {
    const pipeline = state.pipelines.get(deviceId);
    if (!pipeline) {
      throw new Error(`Pipeline not found for device: ${deviceId}`);
    }

    if (!state.activeStreams.has(deviceId)) {
      return { success: true, message: 'Stream not active', deviceId };
    }

    try {
      const result = await pipeline.stopStreaming();
      
      if (result.success) {
        state.activeStreams.delete(deviceId);
        notifyCallbacks('onStreamStopped', { deviceId, ...result });
        
        // Update load balancing if enabled
        if (state.groupSettings.loadBalancing) {
          await rebalanceStreams();
        }
      }

      return result;
    } catch (error) {
      console.error(`Failed to stop stream for ${deviceId}:`, error);
      notifyCallbacks('onError', { deviceId, error, operation: 'stopStream' });
      throw error;
    }
  };

  // Start streaming for multiple devices
  const startMultipleStreams = async (deviceIds, streamConfig = {}) => {
    const results = {};
    
    if (state.groupSettings.syncStreaming) {
      // Start all streams simultaneously
      const promises = deviceIds.map(deviceId => 
        startStream(deviceId, streamConfig).catch(error => ({ deviceId, error }))
      );
      
      const streamResults = await Promise.all(promises);
      
      streamResults.forEach(result => {
        if (result.error) {
          results[result.deviceId] = { success: false, error: result.error };
        } else {
          results[result.deviceId] = result;
        }
      });
    } else {
      // Start streams sequentially
      for (const deviceId of deviceIds) {
        try {
          results[deviceId] = await startStream(deviceId, streamConfig);
        } catch (error) {
          results[deviceId] = { success: false, error };
        }
      }
    }

    const successful = Object.values(results).filter(r => r.success).length;
    console.log(`🎬 Started ${successful}/${deviceIds.length} streams`);

    return {
      success: successful > 0,
      results,
      totalRequested: deviceIds.length,
      successful
    };
  };

  // Stop streaming for multiple devices
  const stopMultipleStreams = async (deviceIds) => {
    const results = {};
    
    // Stop all streams simultaneously
    const promises = deviceIds.map(deviceId => 
      stopStream(deviceId).catch(error => ({ deviceId, error }))
    );
    
    const streamResults = await Promise.all(promises);
    
    streamResults.forEach(result => {
      if (result.error) {
        results[result.deviceId] = { success: false, error: result.error };
      } else {
        results[result.deviceId] = result;
      }
    });

    const successful = Object.values(results).filter(r => r.success).length;
    console.log(`🛑 Stopped ${successful}/${deviceIds.length} streams`);

    return {
      success: successful > 0,
      results,
      totalRequested: deviceIds.length,
      successful
    };
  };

  // Apply quality change to all active streams
  const applyGlobalQualityChange = async (newQuality) => {
    const activeDeviceIds = Array.from(state.activeStreams);
    const results = {};

    console.log(`📊 Applying global quality change to ${newQuality} for ${activeDeviceIds.length} streams`);

    for (const deviceId of activeDeviceIds) {
      const pipeline = state.pipelines.get(deviceId);
      if (pipeline) {
        try {
          results[deviceId] = await pipeline.changeQuality(newQuality);
        } catch (error) {
          results[deviceId] = { success: false, error };
          console.warn(`Quality change failed for ${deviceId}:`, error);
        }
      }
    }

    return results;
  };

  // Rebalance streams based on network conditions
  const rebalanceStreams = async () => {
    if (!state.groupSettings.loadBalancing || state.activeStreams.size === 0) {
      return { success: true, message: 'No rebalancing needed' };
    }

    console.log('⚖️ Rebalancing streams based on network conditions');

    // Get network statistics
    updateNetworkStats();
    
    // Simple load balancing: reduce quality if too many active streams
    const activeCount = state.activeStreams.size;
    let targetQuality = 'medium';

    if (activeCount > 6) {
      targetQuality = 'mobile';
    } else if (activeCount > 4) {
      targetQuality = 'low';
    } else if (activeCount > 2) {
      targetQuality = 'medium';
    } else {
      targetQuality = 'high';
    }

    // Apply quality changes if using global control
    if (state.groupSettings.globalQualityControl) {
      await applyGlobalQualityChange(targetQuality);
    }

    return { 
      success: true, 
      activeStreams: activeCount, 
      targetQuality,
      message: 'Rebalancing completed'
    };
  };

  // Update network statistics
  const updateNetworkStats = () => {
    const pipelines = Array.from(state.pipelines.values());
    let totalBandwidth = 0;
    let totalLatency = 0;
    let maxPacketLoss = 0;
    let activeCount = 0;

    pipelines.forEach(pipeline => {
      if (pipeline.isStreaming()) {
        const stats = pipeline.getStats();
        const metrics = pipeline.getQualityMetrics();
        
        if (metrics) {
          totalBandwidth += metrics.networkStats?.bandwidth || 0;
          totalLatency += metrics.networkStats?.latency || 0;
          maxPacketLoss = Math.max(maxPacketLoss, metrics.networkStats?.packetLoss || 0);
          activeCount++;
        }
      }
    });

    state.networkStats = {
      totalBandwidth,
      averageLatency: activeCount > 0 ? totalLatency / activeCount : 0,
      packetLoss: maxPacketLoss,
      lastUpdated: Date.now()
    };

    // Update global quality controller with aggregated stats
    if (state.globalQualityController) {
      state.globalQualityController.updateNetworkStats(state.networkStats);
    }
  };

  // Notification helper
  const notifyCallbacks = (eventType, data) => {
    const callbacks = state.callbacks[eventType] || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Callback error for ${eventType}:`, error);
      }
    });
  };

  // Event subscription methods
  const onDeviceAdded = (callback) => {
    state.callbacks.onDeviceAdded.push(callback);
    return () => {
      const index = state.callbacks.onDeviceAdded.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceAdded.splice(index, 1);
    };
  };

  const onDeviceRemoved = (callback) => {
    state.callbacks.onDeviceRemoved.push(callback);
    return () => {
      const index = state.callbacks.onDeviceRemoved.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceRemoved.splice(index, 1);
    };
  };

  const onStreamStarted = (callback) => {
    state.callbacks.onStreamStarted.push(callback);
    return () => {
      const index = state.callbacks.onStreamStarted.indexOf(callback);
      if (index !== -1) state.callbacks.onStreamStarted.splice(index, 1);
    };
  };

  const onStreamStopped = (callback) => {
    state.callbacks.onStreamStopped.push(callback);
    return () => {
      const index = state.callbacks.onStreamStopped.indexOf(callback);
      if (index !== -1) state.callbacks.onStreamStopped.splice(index, 1);
    };
  };

  const onQualityChanged = (callback) => {
    state.callbacks.onQualityChanged.push(callback);
    return () => {
      const index = state.callbacks.onQualityChanged.indexOf(callback);
      if (index !== -1) state.callbacks.onQualityChanged.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  // Getters
  const getDevices = () => Array.from(state.devices.values());
  const getDevice = (deviceId) => state.devices.get(deviceId);
  const getPipeline = (deviceId) => state.pipelines.get(deviceId);
  const getActiveStreams = () => Array.from(state.activeStreams);
  const getNetworkStats = () => ({ ...state.networkStats });
  const getGroupSettings = () => ({ ...state.groupSettings });
  
  const getCoordinatorStatus = () => ({
    totalDevices: state.devices.size,
    activeStreams: state.activeStreams.size,
    networkStats: state.networkStats,
    groupSettings: state.groupSettings,
    globalQualityEnabled: !!state.globalQualityController,
    lastUpdate: Date.now()
  });

  // Cleanup coordinator
  const cleanup = async () => {
    console.log('🧹 Cleaning up multi-device coordinator...');
    
    // Stop all active streams
    const activeDeviceIds = Array.from(state.activeStreams);
    if (activeDeviceIds.length > 0) {
      await stopMultipleStreams(activeDeviceIds);
    }

    // Cleanup all pipelines
    for (const [deviceId, pipeline] of state.pipelines.entries()) {
      try {
        if (pipeline.cleanup) {
          await pipeline.cleanup();
        }
      } catch (error) {
        console.warn(`Cleanup failed for device ${deviceId}:`, error);
      }
    }

    // Clear state
    state.devices.clear();
    state.pipelines.clear();
    state.activeStreams.clear();
    
    // Clear callbacks
    Object.keys(state.callbacks).forEach(key => {
      state.callbacks[key] = [];
    });

    console.log('✅ Multi-device coordinator cleanup completed');
  };

  // Start network monitoring
  const startNetworkMonitoring = (intervalMs = 5000) => {
    const monitoringInterval = setInterval(() => {
      updateNetworkStats();
    }, intervalMs);

    return () => clearInterval(monitoringInterval);
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
    onDeviceAdded,
    onDeviceRemoved,
    onStreamStarted,
    onStreamStopped,
    onQualityChanged,
    onError,
    
    // Lifecycle
    cleanup
  };
};

