/**
 * Pipeline Events System
 * Event management for pipeline communication
 * Following functional programming patterns with factory functions
 */

// Create pipeline events factory
export const createPipelineEvents = () => {
  const state = {
    listeners: new Map(),
    maxListeners: 100
  };

  // Add event listener
  const on = (event, callback) => {
    if (!state.listeners.has(event)) {
      state.listeners.set(event, []);
    }
    
    const listeners = state.listeners.get(event);
    
    if (listeners.length >= state.maxListeners) {
      console.warn(`Max listeners (${state.maxListeners}) reached for event: ${event}`);
    }
    
    listeners.push(callback);
    
    // Return unsubscribe function
    return () => off(event, callback);
  };

  // Remove event listener
  const off = (event, callback) => {
    if (!state.listeners.has(event)) return;
    
    const listeners = state.listeners.get(event);
    const index = listeners.indexOf(callback);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    // Clean up empty listener arrays
    if (listeners.length === 0) {
      state.listeners.delete(event);
    }
  };

  // Add one-time event listener
  const once = (event, callback) => {
    const wrappedCallback = (...args) => {
      callback(...args);
      off(event, wrappedCallback);
    };
    
    return on(event, wrappedCallback);
  };

  // Emit event
  const emit = (event, data) => {
    if (!state.listeners.has(event)) return;
    
    const listeners = [...state.listeners.get(event)]; // Create copy to avoid mutation during iteration
    
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
  };

  // Remove all listeners for an event or all events
  const removeAllListeners = (event) => {
    if (event) {
      state.listeners.delete(event);
    } else {
      state.listeners.clear();
    }
  };

  // Get listener count for an event
  const listenerCount = (event) => {
    if (!state.listeners.has(event)) return 0;
    return state.listeners.get(event).length;
  };

  // Get all event names
  const eventNames = () => Array.from(state.listeners.keys());

  // Set max listeners
  const setMaxListeners = (max) => {
    state.maxListeners = max;
  };

  // Get max listeners
  const getMaxListeners = () => state.maxListeners;

  return {
    on,
    off,
    once,
    emit,
    removeAllListeners,
    listenerCount,
    eventNames,
    setMaxListeners,
    getMaxListeners,
    
    // Aliases for compatibility
    addEventListener: on,
    removeEventListener: off,
    dispatch: emit
  };
};

// Export default events configuration
export const DEFAULT_EVENTS_CONFIG = {
  maxListeners: 100,
  errorHandling: 'log', // 'log', 'throw', or 'silent'
  async: false
};