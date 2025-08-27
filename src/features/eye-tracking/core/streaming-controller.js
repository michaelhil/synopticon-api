/**
 * Eye Tracking Streaming Control Module
 * Handles gaze data streaming and subscriptions
 */

export const createStreamingController = (state) => {
  // Streaming API
  const getGazeStream = (deviceId) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    return deviceInfo.device.getGazeStream();
  };

  const onGazeData = (callback, deviceId = null) => {
    if (!state.system) {
      throw new Error('System not initialized');
    }

    if (deviceId) {
      // Subscribe to specific device
      const deviceInfo = state.activeDevices.get(deviceId);
      if (!deviceInfo) {
        throw new Error(`Device ${deviceId} not connected`);
      }
      return deviceInfo.device.onGazeData(callback);
    } else {
      // Subscribe to all devices
      return state.system.onGazeData(callback);
    }
  };

  return {
    getGazeStream,
    onGazeData
  };
};