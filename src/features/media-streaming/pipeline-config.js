/**
 * Pipeline Configuration Module
 * Handles pipeline setup and event management
 */

import { createPipeline } from '../../core/pipeline/pipeline.ts';

/**
 * Create pipeline configuration
 */
export const createPipelineConfig = (deviceInfo, state, processFunction) => {
  return createPipeline({
    name: `media-stream-${deviceInfo.id}`,
    version: '1.0.0',
    capabilities: ['video_streaming', 'audio_streaming', 'quality_adaptation'],
    performance: {
      fps: deviceInfo.capabilities?.maxFrameRate || 30,
      latency: '50-100ms',
      cpuUsage: 'medium',
      batteryImpact: 'medium'
    },
    description: `Media streaming pipeline for ${deviceInfo.label}`,
    process: processFunction,
    
    // Pipeline lifecycle hooks
    onInitialize: async () => {
      console.log(`🚀 Pipeline ${deviceInfo.id} initialized`);
      return true;
    },
    
    onStart: async () => {
      console.log(`▶️ Pipeline ${deviceInfo.id} started`);
      state.isActive = true;
      return true;
    },
    
    onStop: async () => {
      console.log(`⏹️ Pipeline ${deviceInfo.id} stopped`);
      state.isActive = false;
      
      // Cleanup resources
      if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
      }
      
      if (state.audioContext) {
        await state.audioContext.close();
      }
      
      return true;
    },
    
    onError: (error) => {
      console.error(`❌ Pipeline ${deviceInfo.id} error:`, error);
      
      // Notify error callbacks
      state.callbacks.onError.forEach(callback => {
        try {
          callback({
            type: 'PIPELINE_ERROR',
            error: error.message,
            timestamp: Date.now(),
            deviceId: deviceInfo.id
          });
        } catch (callbackError) {
          console.error('Error callback failed:', callbackError);
        }
      });
    },
    
    // Resource cleanup
    onDestroy: async () => {
      console.log(`🗑️ Pipeline ${deviceInfo.id} destroyed`);
      
      // Stop streaming - cleanup resources
      if (state.isStreaming) {
        state.isStreaming = false;
        if (state.mediaStream) {
          state.mediaStream.getTracks().forEach(track => track.stop());
          state.mediaStream = null;
        }
        if (state.audioContext) {
          await state.audioContext.close();
          state.audioContext = null;
        }
      }
      
      // Clear buffers and callbacks
      state.frameBuffer.clear();
      state.callbacks.onFrame = [];
      state.callbacks.onError = [];
      state.callbacks.onQualityChange = [];
    }
  });
};

/**
 * Setup event handlers for pipeline
 */
export const setupEventHandlers = (state) => {
  return {
    // Frame event handler
    onFrame: (callback) => {
      if (typeof callback !== 'function') {
        throw new Error('Frame callback must be a function');
      }
      state.callbacks.onFrame.push(callback);
      
      // Return unsubscribe function
      return () => {
        const index = state.callbacks.onFrame.indexOf(callback);
        if (index !== -1) state.callbacks.onFrame.splice(index, 1);
      };
    },
    
    // Error event handler
    onError: (callback) => {
      if (typeof callback !== 'function') {
        throw new Error('Error callback must be a function');
      }
      state.callbacks.onError.push(callback);
      
      // Return unsubscribe function
      return () => {
        const index = state.callbacks.onError.indexOf(callback);
        if (index !== -1) state.callbacks.onError.splice(index, 1);
      };
    },
    
    // Quality change event handler
    onQualityChange: (callback) => {
      if (typeof callback !== 'function') {
        throw new Error('Quality change callback must be a function');
      }
      state.callbacks.onQualityChange.push(callback);
      
      // Return unsubscribe function
      return () => {
        const index = state.callbacks.onQualityChange.indexOf(callback);
        if (index !== -1) state.callbacks.onQualityChange.splice(index, 1);
      };
    }
  };
};