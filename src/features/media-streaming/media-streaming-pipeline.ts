/**
 * Media Streaming Pipeline
 * Handles video and audio streaming with quality control
 * Following functional programming patterns with factory functions
 */

import { createQualityController } from './quality-controller.js';
import type { QualityController } from './quality-controller.js';
import { createPipelineState } from './pipeline-state.js';
import type { PipelineState, PipelineConfig } from './pipeline-state.js';
import { createStreamOperations } from './stream-operations.js';
import type { StreamOperations } from './stream-operations.js';
import { createPipelineInterface } from './pipeline-interface.js';
import { QUALITY_PROFILES, captureAudioData, captureVideoFrame, initializeMediaCapture } from './media-capture.js';
import { changeQuality, getStreamingStatus, processStreamCommand, startStreaming, stopStreaming } from './streaming-control.js';
import { createPipelineConfig, setupEventHandlers } from './pipeline-config.js';
import type { DeviceInfo, EventHandlers } from './pipeline-config.js';
import type { Pipeline } from '../../core/pipeline/pipeline.js';

export interface StreamAction {
  action: string;
  parameters?: {
    quality?: string;
    [key: string]: unknown;
  };
}

export interface NetworkStats {
  [key: string]: unknown;
}

export interface DeviceInfoExtended extends DeviceInfo {
  type?: string;
}

export interface MediaStreamingPipelineConfig extends PipelineConfig {
  enableQualityControl?: boolean;
  adaptiveQuality?: boolean;
}

export interface QualityInfo {
  [key: string]: unknown;
}

export interface StreamingStatus {
  [key: string]: unknown;
}

export interface MediaStreamingPipeline extends Pipeline {
  // Device info
  getDeviceInfo: () => DeviceInfo;
  getDeviceId: () => string;
  getDeviceType: () => string | undefined;
  
  // Stream control
  startStreaming: () => Promise<any>;
  stopStreaming: () => Promise<any>;
  changeQuality: (newQuality: string) => Promise<any>;
  
  // Data capture
  captureFrame: () => any;
  captureAudioData: () => any;
  
  // Status and stats
  getStatus: () => StreamingStatus;
  getStats: () => any;
  getBuffer: () => any;
  
  // Quality profiles and control
  getQualityProfiles: () => any;
  getCurrentQuality: () => string;
  getQualityController: () => QualityController | null;
  
  // Quality controller methods
  updateNetworkStats: (networkStats: NetworkStats) => void;
  getQualityMetrics: () => QualityInfo | null;
  setAdaptationEnabled: (enabled: boolean) => void;
  
  // Event handlers
  onFrame: EventHandlers['onFrame'];
  onError: EventHandlers['onError'];
  onQualityChange: EventHandlers['onQualityChange'];
  
  // Stream state
  isStreaming: () => boolean;
  getMediaStream: () => MediaStream | null;
  
  // Pipeline operations
  initialize: () => Promise<boolean>;
}

/**
 * Create media streaming pipeline for a specific device
 */
export const createMediaStreamingPipeline = (
  deviceInfo: DeviceInfoExtended, 
  config: MediaStreamingPipelineConfig = {}
): MediaStreamingPipeline => {
  const state = createPipelineState(deviceInfo, config);

  // Initialize quality controller if enabled
  if (config.enableQualityControl !== false) {
    state.qualityController = createQualityController({
      deviceId: deviceInfo.id,
      deviceType: deviceInfo.type || 'unknown',
      initialQuality: state.quality,
      adaptationEnabled: config.adaptiveQuality !== false
    });
  }
  
  // Create modular operations and interface
  const operations = createStreamOperations(state);
  const pipeline = createPipelineInterface(state, operations);
  
  // Create pipeline process function
  const process = async (input: StreamAction): Promise<any> => {
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
  const pipelineConfig = createPipelineConfig(deviceInfo, state as any, process);
  
  // Setup event handlers
  const eventHandlers = setupEventHandlers(state as any);

  // Add custom methods to pipeline
  return {
    ...pipelineConfig,
    
    // Device info
    getDeviceInfo: (): DeviceInfo => ({ ...deviceInfo }),
    getDeviceId: (): string => deviceInfo.id,
    getDeviceType: (): string | undefined => deviceInfo.type,
    
    // Stream control
    startStreaming: () => startStreaming(state as any, deviceInfo),
    stopStreaming: () => stopStreaming(state as any, deviceInfo),
    changeQuality: (newQuality: string) => changeQuality(state as any, newQuality),
    
    // Data capture
    captureFrame: () => captureVideoFrame(state as any),
    captureAudioData: () => captureAudioData(state as any),
    
    // Status and stats
    getStatus: () => getStreamingStatus(state as any, deviceInfo),
    getStats: () => ({ ...state.stats }),
    getBuffer: () => state.frameBuffer,
    
    // Quality profiles and control
    getQualityProfiles: () => ({ ...QUALITY_PROFILES }),
    getCurrentQuality: (): string => state.quality,
    getQualityController: (): QualityController | null => state.qualityController,
    
    // Quality controller methods
    updateNetworkStats: (networkStats: NetworkStats): void => {
      if (state.qualityController) {
        state.qualityController.updateNetworkStats(networkStats);
      }
    },
    getQualityMetrics: (): QualityInfo | null => {
      return state.qualityController ? 
        state.qualityController.getQualityInfo() : null;
    },
    setAdaptationEnabled: (enabled: boolean): void => {
      if (state.qualityController) {
        state.qualityController.setAdaptiveMode(enabled);
      }
    },
    
    // Event handlers
    ...eventHandlers,
    
    // Stream state
    isStreaming: (): boolean => state.isStreaming,
    getMediaStream: (): MediaStream | null => state.mediaStream,
    
    // Pipeline operations
    process,
    initialize: async (): Promise<boolean> => {
      console.log(`📹 Initializing media streaming pipeline for device: ${deviceInfo.label || deviceInfo.id}`);
      return true;
    }
  } as MediaStreamingPipeline;
};

/**
 * Convenience function to create streaming pipeline for multiple devices
 */
export const createMultiDeviceStreaming = (
  devices: DeviceInfoExtended[], 
  config: MediaStreamingPipelineConfig = {}
): Map<string, MediaStreamingPipeline> => {
  const pipelines = new Map<string, MediaStreamingPipeline>();
  
  devices.forEach(device => {
    const pipeline = createMediaStreamingPipeline(device, config);
    pipelines.set(device.id, pipeline);
  });
  
  return pipelines;
};