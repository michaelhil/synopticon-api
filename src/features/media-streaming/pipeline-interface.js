/**
 * Media streaming pipeline interface and callback management
 */

export const createPipelineInterface = (state, operations) => {
  
  const addFrameCallback = (callback) => {
    if (typeof callback === 'function') {
      state.callbacks.onFrame.push(callback);
    }
  };

  const removeFrameCallback = (callback) => {
    const index = state.callbacks.onFrame.indexOf(callback);
    if (index > -1) {
      state.callbacks.onFrame.splice(index, 1);
    }
  };

  const addErrorCallback = (callback) => {
    if (typeof callback === 'function') {
      state.callbacks.onError.push(callback);
    }
  };

  const removeErrorCallback = (callback) => {
    const index = state.callbacks.onError.indexOf(callback);
    if (index > -1) {
      state.callbacks.onError.splice(index, 1);
    }
  };

  const addQualityChangeCallback = (callback) => {
    if (typeof callback === 'function') {
      state.callbacks.onQualityChange.push(callback);
    }
  };

  const removeQualityChangeCallback = (callback) => {
    const index = state.callbacks.onQualityChange.indexOf(callback);
    if (index > -1) {
      state.callbacks.onQualityChange.splice(index, 1);
    }
  };

  const getStatus = () => ({
    deviceId: state.deviceInfo.id,
    deviceLabel: state.deviceInfo.label || state.deviceInfo.id,
    deviceType: state.deviceInfo.type,
    isStreaming: state.isStreaming,
    quality: state.quality,
    stats: { ...state.stats },
    bufferSize: state.frameBuffer.size()
  });

  const getStats = () => ({ ...state.stats });

  const isStreaming = () => state.isStreaming;

  const getCurrentFrame = () => state.frameBuffer.getLatest();

  const getFrameHistory = (count = 10) => state.frameBuffer.getRecent(count);

  const setQuality = async (quality) => {
    return operations.changeQuality(quality);
  };

  const cleanup = async () => {
    // Stop streaming if active
    if (state.isStreaming) {
      await operations.stopStream();
    }

    // Clear all callbacks
    state.callbacks.onFrame.length = 0;
    state.callbacks.onError.length = 0;
    state.callbacks.onQualityChange.length = 0;

    // Clear buffer
    state.frameBuffer.clear();

    // Cleanup quality controller
    if (state.qualityController && state.qualityController.cleanup) {
      state.qualityController.cleanup();
    }
  };

  return {
    // Core operations
    startStream: operations.startStream,
    stopStream: operations.stopStream,
    changeQuality: operations.changeQuality,
    
    // Status and data access
    getStatus,
    getStats,
    isStreaming,
    getCurrentFrame,
    getFrameHistory,
    setQuality,
    
    // Callback management
    addFrameCallback,
    removeFrameCallback,
    addErrorCallback,
    removeErrorCallback,
    addQualityChangeCallback,
    removeQualityChangeCallback,
    
    // Lifecycle
    cleanup,
    
    // Pipeline interface
    name: `media_streaming_${state.deviceInfo.id}`,
    type: 'media_streaming',
    metadata: {
      deviceInfo: state.deviceInfo,
      capabilities: ['video', 'audio', 'quality_control']
    }
  };
};
