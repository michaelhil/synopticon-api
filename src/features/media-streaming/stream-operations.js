/**
 * Media streaming operations and controls
 */

import { createAnalysisResult, createErrorResult } from '../../core/configuration/types.ts';

export const createStreamOperations = (state) => {
  
  const startStream = async () => {
    try {
      if (state.isStreaming) {
        return createAnalysisResult('Stream already active', {
          result: 'already_streaming',
          deviceId: state.deviceInfo.id
        });
      }

      // Get media constraints based on device type and quality
      const constraints = getMediaConstraints(state.deviceInfo, state.quality);
      
      // Get media stream
      state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Start frame processing
      await startFrameProcessing(state);
      
      state.isStreaming = true;
      
      return createAnalysisResult('Stream started successfully', {
        result: 'stream_started',
        deviceId: state.deviceInfo.id,
        quality: state.quality,
        constraints
      });
      
    } catch (error) {
      return createErrorResult(error, 'Failed to start stream');
    }
  };

  const stopStream = async () => {
    try {
      if (!state.isStreaming) {
        return createAnalysisResult('Stream already stopped', {
          result: 'already_stopped',
          deviceId: state.deviceInfo.id
        });
      }

      // Stop frame processing
      stopFrameProcessing(state);
      
      // Stop media tracks
      if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
      }
      
      state.isStreaming = false;
      
      return createAnalysisResult('Stream stopped successfully', {
        result: 'stream_stopped',
        deviceId: state.deviceInfo.id,
        finalStats: { ...state.stats }
      });
      
    } catch (error) {
      return createErrorResult(error, 'Failed to stop stream');
    }
  };

  const changeQuality = async (newQuality) => {
    try {
      const oldQuality = state.quality;
      state.quality = newQuality;
      
      // If streaming, restart with new quality
      if (state.isStreaming) {
        await stopStream();
        await startStream();
      }
      
      // Update quality controller if available
      if (state.qualityController) {
        state.qualityController.setQuality(newQuality);
      }
      
      // Notify callbacks
      state.callbacks.onQualityChange.forEach(callback => {
        try {
          callback({ oldQuality, newQuality, deviceId: state.deviceInfo.id });
        } catch (error) {
          console.warn('Quality change callback error:', error);
        }
      });
      
      return createAnalysisResult('Quality changed successfully', {
        result: 'quality_changed',
        oldQuality,
        newQuality,
        deviceId: state.deviceInfo.id
      });
      
    } catch (error) {
      state.quality = state.quality; // Revert on error
      return createErrorResult(error, 'Failed to change quality');
    }
  };

  return {
    startStream,
    stopStream,
    changeQuality
  };
};

// Helper functions
const getMediaConstraints = (deviceInfo, quality) => {
  const qualitySettings = {
    low: { width: 640, height: 480, frameRate: 15 },
    medium: { width: 1280, height: 720, frameRate: 30 },
    high: { width: 1920, height: 1080, frameRate: 30 },
    ultra: { width: 3840, height: 2160, frameRate: 60 }
  };

  const settings = qualitySettings[quality] || qualitySettings.medium;

  return {
    video: {
      deviceId: deviceInfo.id ? { exact: deviceInfo.id } : undefined,
      width: { ideal: settings.width },
      height: { ideal: settings.height },
      frameRate: { ideal: settings.frameRate }
    },
    audio: deviceInfo.type === 'camera' || deviceInfo.type === 'microphone'
  };
};

const startFrameProcessing = async (state) => {
  if (!state.mediaStream) return;

  // Create video element for frame capture
  const video = document.createElement('video');
  video.srcObject = state.mediaStream;
  video.play();

  // Create canvas for frame extraction
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const processFrame = () => {
    if (!state.isStreaming) return;

    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      ctx.drawImage(video, 0, 0);

      // Get frame data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const frameData = canvas.toDataURL('image/jpeg', 0.8);

      // Update stats
      updateFrameStats(state, new TextEncoder().encode(frameData));

      // Add to buffer
      state.frameBuffer.add({
        timestamp: Date.now(),
        data: frameData,
        imageData,
        width: canvas.width,
        height: canvas.height
      });

      // Notify callbacks
      state.callbacks.onFrame.forEach(callback => {
        try {
          callback({
            frameData,
            imageData,
            timestamp: Date.now(),
            deviceId: state.deviceInfo.id
          });
        } catch (error) {
          console.warn('Frame callback error:', error);
        }
      });

      // Schedule next frame
      if (state.isStreaming) {
        requestAnimationFrame(processFrame);
      }

    } catch (error) {
      state.callbacks.onError.forEach(callback => {
        try {
          callback(error);
        } catch (cbError) {
          console.warn('Error callback failed:', cbError);
        }
      });
    }
  };

  // Start processing
  requestAnimationFrame(processFrame);
};

const stopFrameProcessing = (state) => {
  // Frame processing will stop automatically when isStreaming becomes false
  state.frameBuffer.clear();
};

const updateFrameStats = (state, frameData) => {
  const now = performance.now();
  const frameSize = frameData.byteLength || 0;
  
  state.stats.framesProcessed++;
  state.stats.bytesStreamed += frameSize;
  
  // Calculate average frame size
  state.stats.averageFrameSize = 
    state.stats.bytesStreamed / state.stats.framesProcessed;
  
  // Calculate FPS
  if (state.stats.lastFrameTime > 0) {
    const deltaTime = now - state.stats.lastFrameTime;
    state.stats.currentFPS = 1000 / deltaTime;
  }
  
  state.stats.lastFrameTime = now;
};