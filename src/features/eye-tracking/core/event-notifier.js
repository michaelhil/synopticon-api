/**
 * Eye Tracking Event Notification Module
 * Handles callback management and event notifications
 */

export const createEventNotifier = (state) => {
  // Error handling
  const notifyError = (error) => {
    state.callbacks.onError.forEach(cb => {
      try {
        cb(error);
      } catch (cbError) {
        console.warn('Error callback failed:', cbError);
      }
    });
  };

  // Recording progress notifications
  const notifyRecordingProgress = (eventData) => {
    state.callbacks.onRecordingProgress.forEach(cb => {
      try {
        cb(eventData);
      } catch (error) {
        console.warn('Recording progress callback error:', error);
      }
    });
  };

  // Calibration progress notifications  
  const notifyCalibrationProgress = (eventData) => {
    state.callbacks.onCalibrationProgress.forEach(cb => {
      try {
        cb(eventData);
      } catch (error) {
        console.warn('Calibration progress callback error:', error);
      }
    });
  };

  // Event handlers for callback registration
  const onSystemReady = (callback) => {
    state.callbacks.onSystemReady.push(callback);
    return () => {
      const index = state.callbacks.onSystemReady.indexOf(callback);
      if (index !== -1) state.callbacks.onSystemReady.splice(index, 1);
    };
  };

  const onDeviceStatusChange = (callback) => {
    state.callbacks.onDeviceStatusChange.push(callback);
    return () => {
      const index = state.callbacks.onDeviceStatusChange.indexOf(callback);
      if (index !== -1) state.callbacks.onDeviceStatusChange.splice(index, 1);
    };
  };

  const onCalibrationProgress = (callback) => {
    state.callbacks.onCalibrationProgress.push(callback);
    return () => {
      const index = state.callbacks.onCalibrationProgress.indexOf(callback);
      if (index !== -1) state.callbacks.onCalibrationProgress.splice(index, 1);
    };
  };

  const onRecordingProgress = (callback) => {
    state.callbacks.onRecordingProgress.push(callback);
    return () => {
      const index = state.callbacks.onRecordingProgress.indexOf(callback);
      if (index !== -1) state.callbacks.onRecordingProgress.splice(index, 1);
    };
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => {
      const index = state.callbacks.onError.indexOf(callback);
      if (index !== -1) state.callbacks.onError.splice(index, 1);
    };
  };

  return {
    notifyError,
    notifyRecordingProgress,
    notifyCalibrationProgress,
    onSystemReady,
    onDeviceStatusChange,
    onCalibrationProgress,
    onRecordingProgress,
    onError
  };
};