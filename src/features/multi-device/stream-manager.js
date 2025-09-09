/**
 * Stream management for multi-device coordinator
 */

export const createStreamManager = (deviceManager, qualityController, config, notifyCallbacks) => {
  const activeStreams = new Set(); // Set of active stream IDs

  // Start streaming for specific device
  const startStream = async (deviceId, streamConfig = {}) => {
    const pipeline = deviceManager.getPipeline(deviceId);
    if (!pipeline) {
      throw new Error(`Pipeline not found for device: ${deviceId}`);
    }

    if (activeStreams.has(deviceId)) {
      return { success: true, message: 'Stream already active', deviceId };
    }

    try {
      // Apply global quality if enabled
      if (config.groupSettings?.globalQualityControl && qualityController) {
        const globalInfo = qualityController.getQualityInfo();
        if (globalInfo && globalInfo.currentQuality) {
          await pipeline.changeQuality(globalInfo.currentQuality);
        }
      }

      // Start the stream
      const result = await pipeline.startStreaming();
      
      if (result.success) {
        activeStreams.add(deviceId);
        notifyCallbacks('onStreamStarted', { deviceId, ...result });
        
        // Update load balancing if enabled
        if (config.groupSettings?.loadBalancing) {
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
    const pipeline = deviceManager.getPipeline(deviceId);
    if (!pipeline) {
      throw new Error(`Pipeline not found for device: ${deviceId}`);
    }

    if (!activeStreams.has(deviceId)) {
      return { success: true, message: 'Stream not active', deviceId };
    }

    try {
      const result = await pipeline.stopStreaming();
      
      if (result.success) {
        activeStreams.delete(deviceId);
        notifyCallbacks('onStreamStopped', { deviceId, ...result });
        
        // Update load balancing if enabled
        if (config.groupSettings?.loadBalancing) {
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
    
    if (config.groupSettings?.syncStreaming) {
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
    const activeDeviceIds = Array.from(activeStreams);
    const results = {};

    console.log(`📊 Applying global quality change to ${newQuality} for ${activeDeviceIds.length} streams`);

    for (const deviceId of activeDeviceIds) {
      const pipeline = deviceManager.getPipeline(deviceId);
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
    if (!config.groupSettings?.loadBalancing || activeStreams.size === 0) {
      return { success: true, message: 'No rebalancing needed' };
    }

    console.log('⚖️ Rebalancing streams based on network conditions');

    // Simple load balancing: reduce quality if too many active streams
    const activeCount = activeStreams.size;
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
    if (config.groupSettings?.globalQualityControl) {
      await applyGlobalQualityChange(targetQuality);
    }

    return { 
      success: true, 
      activeStreams: activeCount, 
      targetQuality,
      message: 'Rebalancing completed'
    };
  };

  // Stop all active streams for cleanup
  const stopAllStreams = async () => {
    const activeDeviceIds = Array.from(activeStreams);
    if (activeDeviceIds.length > 0) {
      await stopMultipleStreams(activeDeviceIds);
    }
  };

  // Get active streams
  const getActiveStreams = () => Array.from(activeStreams);

  return {
    startStream,
    stopStream,
    startMultipleStreams,
    stopMultipleStreams,
    applyGlobalQualityChange,
    rebalanceStreams,
    stopAllStreams,
    getActiveStreams
  };
};
