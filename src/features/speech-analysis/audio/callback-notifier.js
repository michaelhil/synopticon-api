/**
 * Callback Notification Module
 * Manages event callbacks and error handling
 */

export const createCallbackNotifier = (state) => {
  // Notify callbacks for specific event type
  const notifyCallbacks = (eventType, data) => {
    const callbacks = state.callbacks[eventType] || [];
    
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Callback error for ${eventType}:`, error);
        notifyError(error);
      }
    });
  };

  // Error notification
  const notifyError = (error) => {
    const errorCallbacks = state.callbacks.onError || [];
    
    errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.warn('Error in error callback:', callbackError);
      }
    });
  };

  // Event handler registration
  const onFeatures = (callback) => {
    state.callbacks.onFeatures.push(callback);
    return () => removeCallback('onFeatures', callback);
  };

  const onPitch = (callback) => {
    state.callbacks.onPitch.push(callback);
    return () => removeCallback('onPitch', callback);
  };

  const onEnergy = (callback) => {
    state.callbacks.onEnergy.push(callback);
    return () => removeCallback('onEnergy', callback);
  };

  const onSpectrum = (callback) => {
    state.callbacks.onSpectrum.push(callback);
    return () => removeCallback('onSpectrum', callback);
  };

  const onError = (callback) => {
    state.callbacks.onError.push(callback);
    return () => removeCallback('onError', callback);
  };

  // Remove callback helper
  const removeCallback = (eventType, callback) => {
    const callbacks = state.callbacks[eventType];
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  };

  // Clear all callbacks
  const clearAllCallbacks = () => {
    Object.keys(state.callbacks).forEach(eventType => {
      state.callbacks[eventType] = [];
    });
  };

  return {
    notifyCallbacks,
    notifyError,
    onFeatures,
    onPitch,
    onEnergy,
    onSpectrum,
    onError,
    clearAllCallbacks
  };
};