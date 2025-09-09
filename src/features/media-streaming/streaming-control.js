/**
 * Streaming Control Module
 * Handles stream lifecycle and quality management
 */

import { QUALITY_PROFILES, initializeMediaCapture } from './media-capture.js';

/**
 * Change streaming quality
 */
export const changeQuality = async (state, newQuality) => {
  if (!QUALITY_PROFILES[newQuality]) {
    throw new Error(`Invalid quality level: ${newQuality}. Available: ${Object.keys(QUALITY_PROFILES).join(', ')}`);
  }

  if (newQuality === state.quality) {
    return { success: true, message: 'Quality unchanged' };
  }

  console.log(`📊 Changing quality from ${state.quality} to ${newQuality}`);
  
  try {
    // Re-initialize media capture with new quality
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    await initializeMediaCapture(state, newQuality);
    
    // Notify quality change
    state.callbacks.onQualityChange.forEach(callback => {
      try {
        callback({ 
          oldQuality: state.quality, 
          newQuality,
          profile: QUALITY_PROFILES[newQuality]
        });
      } catch (error) {
        console.error('Quality change callback error:', error);
      }
    });

    return { 
      success: true, 
      oldQuality: state.quality, 
      newQuality,
      profile: QUALITY_PROFILES[newQuality]
    };
  } catch (error) {
    console.error('Quality change failed:', error);
    throw error;
  }
};

/**
 * Start streaming
 */
export const startStreaming = async (state, deviceInfo) => {
  if (state.isStreaming) {
    return { success: true, message: 'Already streaming' };
  }

  if (!state.mediaStream) {
    await initializeMediaCapture(state);
  }

  state.isStreaming = true;
  console.log(`🎬 Started streaming ${deviceInfo.label} at ${state.quality} quality`);
  
  return { 
    success: true, 
    deviceId: deviceInfo.id,
    quality: state.quality,
    profile: QUALITY_PROFILES[state.quality]
  };
};

/**
 * Stop streaming
 */
export const stopStreaming = async (state, deviceInfo) => {
  if (!state.isStreaming) {
    return { success: true, message: 'Not streaming' };
  }

  state.isStreaming = false;
  
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => {
      track.stop();
    });
    state.mediaStream = null;
  }

  // Cleanup audio context
  if (state.audioContext) {
    await state.audioContext.close();
    state.audioContext = null;
  }

  console.log(`🛑 Stopped streaming ${deviceInfo.label}`);
  return { success: true, deviceId: deviceInfo.id };
};

/**
 * Get current streaming status
 */
export const getStreamingStatus = (state, deviceInfo) => ({
  isStreaming: state.isStreaming,
  deviceId: deviceInfo.id,
  quality: state.quality,
  profile: QUALITY_PROFILES[state.quality],
  stats: { ...state.stats },
  hasVideo: Boolean(state.videoElement),
  hasAudio: Boolean(state.audioContext),
  frameBuffer: {
    length: state.frameBuffer.length,
    maxSize: 100
  }
});

/**
 * Process stream commands
 */
export const processStreamCommand = async (state, deviceInfo, command) => {
  try {
    switch (command.type) {
    case 'START':
      return await startStreaming(state, deviceInfo);
      
    case 'STOP':
      return await stopStreaming(state, deviceInfo);
      
    case 'CHANGE_QUALITY':
      if (!command.quality) {
        throw new Error('Quality parameter required for CHANGE_QUALITY command');
      }
      return await changeQuality(state, command.quality);
      
    case 'GET_STATUS':
      return {
        success: true,
        status: getStreamingStatus(state, deviceInfo)
      };
      
    case 'CAPTURE_FRAME':
      const frameData = state.captureFrame ? state.captureFrame() : null;
      return {
        success: true,
        frame: frameData,
        timestamp: Date.now()
      };
      
    case 'CAPTURE_AUDIO':
      const audioData = state.captureAudioData ? state.captureAudioData() : null;
      return {
        success: true,
        audio: audioData,
        timestamp: Date.now()
      };
      
    default:
      throw new Error(`Unknown stream command: ${command.type}`);
    }
  } catch (error) {
    console.error(`Stream command '${command.type}' failed:`, error);
    
    // Notify error callbacks
    state.callbacks.onError.forEach(callback => {
      try {
        callback({
          type: 'COMMAND_ERROR',
          command: command.type,
          error: error.message,
          timestamp: Date.now()
        });
      } catch (callbackError) {
        console.error('Error callback failed:', callbackError);
      }
    });
    
    throw error;
  }
};
