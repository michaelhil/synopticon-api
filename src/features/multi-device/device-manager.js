/**
 * Device management for multi-device coordinator
 */

import { createMediaStreamingPipeline } from './media-streaming-pipeline.js';

export const createDeviceManager = (config, notifyCallbacks) => {
  const devices = new Map(); // deviceId -> device info
  const pipelines = new Map(); // deviceId -> streaming pipeline

  const addDevice = async (deviceInfo) => {
    const deviceId = deviceInfo.id;
    
    if (devices.has(deviceId)) {
      console.warn(`Device ${deviceId} already exists, updating info`);
    }

    // Store device info
    devices.set(deviceId, { ...deviceInfo });

    // Create streaming pipeline for device
    const pipeline = createMediaStreamingPipeline(deviceInfo, {
      ...config.pipelineConfig,
      enableQualityControl: !config.groupSettings?.globalQualityControl, // Use local if no global
      adaptiveQuality: config.adaptiveQuality !== false
    });

    pipelines.set(deviceId, pipeline);

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

  const removeDevice = async (deviceId, stopStreamFn) => {
    if (!devices.has(deviceId)) {
      throw new Error(`Device ${deviceId} not found`);
    }

    // Stop streaming if active (delegate to stream manager)
    await stopStreamFn(deviceId);

    // Cleanup pipeline
    const pipeline = pipelines.get(deviceId);
    if (pipeline && pipeline.cleanup) {
      await pipeline.cleanup();
    }

    // Remove from state
    const deviceInfo = devices.get(deviceId);
    devices.delete(deviceId);
    pipelines.delete(deviceId);

    console.log(`🗑️ Removed device: ${deviceInfo.label} (${deviceId})`);
    notifyCallbacks('onDeviceRemoved', { deviceId, deviceInfo });

    return { success: true, deviceId };
  };

  const getDevice = (deviceId) => devices.get(deviceId);
  const getDevices = () => Array.from(devices.values());
  const getPipeline = (deviceId) => pipelines.get(deviceId);
  const getAllPipelines = () => pipelines;

  const cleanup = async () => {
    // Cleanup all pipelines
    for (const [deviceId, pipeline] of pipelines.entries()) {
      try {
        if (pipeline.cleanup) {
          await pipeline.cleanup();
        }
      } catch (error) {
        console.warn(`Cleanup failed for device ${deviceId}:`, error);
      }
    }

    // Clear state
    devices.clear();
    pipelines.clear();
  };

  return {
    addDevice,
    removeDevice,
    getDevice,
    getDevices,
    getPipeline,
    getAllPipelines,
    cleanup
  };
};
