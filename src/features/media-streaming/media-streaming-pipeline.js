/**
 * Media Streaming Pipeline
 * Handles video and audio streaming with quality control
 * Following functional programming patterns with factory functions
 */

import { createQualityController } from './quality-controller.js';
import { createPipelineState } from './pipeline-state.js';
import { createStreamOperations } from './stream-operations.js';
import { createPipelineInterface } from './pipeline-interface.js';
import { QUALITY_PROFILES, captureAudioData, captureVideoFrame, initializeMediaCapture } from './media-capture.js';
import { changeQuality, getStreamingStatus, processStreamCommand, startStreaming, stopStreaming } from './streaming-control.js';
import { createPipelineConfig, setupEventHandlers } from './pipeline-config.js';

/**
 * Create media streaming pipeline for a specific device
 * @param {Object} deviceInfo - Device information from discovery
 * @param {Object} config - Pipeline configuration
 * @returns {Object} Media streaming pipeline
 */
export const createMediaStreamingPipeline = (deviceInfo, config = {}) => {
  const state = createPipelineState(deviceInfo, config);

  // Initialize quality controller if enabled
  if (config.enableQualityControl !== false) {
    state.qualityController = createQualityController({
      deviceId: deviceInfo.id,
      deviceType: deviceInfo.type,
      initialQuality: state.quality,
      adaptationEnabled: config.adaptiveQuality !== false
    });
  }
  
  // Create modular operations and interface
  const operations = createStreamOperations(state);
  const pipeline = createPipelineInterface(state, operations);
  
  // Create pipeline process function
  const process = async (input) => {
    if (!input || !input.action) {
      throw new Error('Invalid input: action is required');
    }
    
    switch (input.action) {
      case 'START_STREAM':
        return operations.startStream();
      case 'STOP_STREAM':
        return operations.stopStream();
      case 'CHANGE_QUALITY':
        const quality = input.parameters?.quality || 'medium';
        return operations.changeQuality(quality);
      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  };

  // Create pipeline configuration
  const pipelineConfig = createPipelineConfig(deviceInfo, state, process);
  
  // Setup event handlers
  const eventHandlers = setupEventHandlers(state);

  // Add custom methods to pipeline
  return {
    ...pipelineConfig,
    
    // Device info
    getDeviceInfo: () => ({ ...deviceInfo }),
    getDeviceId: () => deviceInfo.id,
    getDeviceType: () => deviceInfo.type,
    
    // Stream control
    startStreaming: () => startStreaming(state, deviceInfo),
    stopStreaming: () => stopStreaming(state, deviceInfo),
    changeQuality: (newQuality) => changeQuality(state, newQuality),
    
    // Data capture
    captureFrame: () => captureVideoFrame(state),
    captureAudioData: () => captureAudioData(state),
    
    // Status and stats
    getStatus: () => getStreamingStatus(state, deviceInfo),
    getStats: () => ({ ...state.stats }),
    getBuffer: () => state.frameBuffer,
    
    // Quality profiles and control
    getQualityProfiles: () => ({ ...QUALITY_PROFILES }),
    getCurrentQuality: () => state.quality,
    getQualityController: () => state.qualityController,
    
    // Quality controller methods
    updateNetworkStats: (networkStats) => {
      if (state.qualityController) {
        state.qualityController.updateNetworkStats(networkStats);
      }
    },
    getQualityMetrics: () => {
      return state.qualityController ? 
        state.qualityController.getQualityInfo() : null;
    },
    setAdaptationEnabled: (enabled) => {
      if (state.qualityController) {
        state.qualityController.setAdaptiveMode(enabled);
      }
    },
    
    // Event handlers
    ...eventHandlers,
    
    // Stream state
    isStreaming: () => state.isStreaming,
    getMediaStream: () => state.mediaStream,
    
    // Pipeline operations
    process,
    initialize: async () => {
      console.log(`📹 Initializing media streaming pipeline for device: ${deviceInfo.label || deviceInfo.id}`);
      return true;
    }
  };
};

/**
 * Convenience function to create streaming pipeline for multiple devices
 * @param {Array} devices - Array of device info objects
 * @param {Object} config - Common configuration
 * @returns {Map} Map of deviceId -> pipeline
 */
export const createMultiDeviceStreaming = (devices, config = {}) => {
  const pipelines = new Map();
  
  devices.forEach(device => {
    const pipeline = createMediaStreamingPipeline(device, config);
    pipelines.set(device.id, pipeline);
  });
  
  return pipelines;
};