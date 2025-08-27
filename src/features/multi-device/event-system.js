/**
 * Event system for multi-device coordinator
 */

export const createEventSystem = () => {
  const callbacks = {
    onDeviceAdded: [],
    onDeviceRemoved: [],
    onStreamStarted: [],
    onStreamStopped: [],
    onQualityChanged: [],
    onError: []
  };

  // Notification helper
  const notifyCallbacks = (eventType, data) => {
    const eventCallbacks = callbacks[eventType] || [];
    eventCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Callback error for ${eventType}:`, error);
      }
    });
  };

  // Event subscription methods
  const onDeviceAdded = (callback) => {
    callbacks.onDeviceAdded.push(callback);
    return () => {
      const index = callbacks.onDeviceAdded.indexOf(callback);
      if (index !== -1) callbacks.onDeviceAdded.splice(index, 1);
    };
  };

  const onDeviceRemoved = (callback) => {
    callbacks.onDeviceRemoved.push(callback);
    return () => {
      const index = callbacks.onDeviceRemoved.indexOf(callback);
      if (index !== -1) callbacks.onDeviceRemoved.splice(index, 1);
    };
  };

  const onStreamStarted = (callback) => {
    callbacks.onStreamStarted.push(callback);
    return () => {
      const index = callbacks.onStreamStarted.indexOf(callback);
      if (index !== -1) callbacks.onStreamStarted.splice(index, 1);
    };
  };

  const onStreamStopped = (callback) => {
    callbacks.onStreamStopped.push(callback);
    return () => {
      const index = callbacks.onStreamStopped.indexOf(callback);
      if (index !== -1) callbacks.onStreamStopped.splice(index, 1);
    };
  };

  const onQualityChanged = (callback) => {
    callbacks.onQualityChanged.push(callback);
    return () => {
      const index = callbacks.onQualityChanged.indexOf(callback);
      if (index !== -1) callbacks.onQualityChanged.splice(index, 1);
    };
  };

  const onError = (callback) => {
    callbacks.onError.push(callback);
    return () => {
      const index = callbacks.onError.indexOf(callback);
      if (index !== -1) callbacks.onError.splice(index, 1);
    };
  };

  // Clear all callbacks
  const cleanup = () => {
    Object.keys(callbacks).forEach(key => {
      callbacks[key] = [];
    });
  };

  return {
    notifyCallbacks,
    onDeviceAdded,
    onDeviceRemoved,
    onStreamStarted,
    onStreamStopped,
    onQualityChanged,
    onError,
    cleanup
  };
};