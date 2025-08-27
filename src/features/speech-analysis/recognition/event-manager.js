/**
 * Speech Recognition Event Manager
 * Comprehensive event handling, callback management, and state transitions
 */

import { createSpeechEvent } from '../../../core/configuration/types.ts';

export const createEventManager = () => {
  // Event queue for complex event sequencing
  let eventQueue = [];
  let isProcessingEvents = false;

  const initializeCallbacks = (state) => {
    // Initialize all callback arrays if not already present
    const callbackTypes = [
      'onResult',
      'onInterimResult', 
      'onError',
      'onStart',
      'onEnd',
      'onSpeechStart',
      'onSpeechEnd',
      'onAudioProcessing',
      'onStateChange'
    ];

    if (!state.callbacks) {
      state.callbacks = {};
    }

    callbackTypes.forEach(type => {
      if (!state.callbacks[type]) {
        state.callbacks[type] = [];
      }
    });

    console.log('✅ Event manager callbacks initialized');
  };

  const addCallback = (state, eventType, callback) => {
    if (!state.callbacks) {
      initializeCallbacks(state);
    }

    if (!state.callbacks[eventType]) {
      state.callbacks[eventType] = [];
    }

    if (typeof callback === 'function') {
      state.callbacks[eventType].push(callback);
      console.log(`📝 Added ${eventType} callback`);
      return true;
    }

    console.warn(`⚠️ Invalid callback for ${eventType}: not a function`);
    return false;
  };

  const removeCallback = (state, eventType, callback) => {
    if (!state.callbacks || !state.callbacks[eventType]) {
      return false;
    }

    const index = state.callbacks[eventType].indexOf(callback);
    if (index > -1) {
      state.callbacks[eventType].splice(index, 1);
      console.log(`🗑️ Removed ${eventType} callback`);
      return true;
    }

    return false;
  };

  const clearCallbacks = (state, eventType = null) => {
    if (!state.callbacks) {
      return;
    }

    if (eventType) {
      if (state.callbacks[eventType]) {
        state.callbacks[eventType] = [];
        console.log(`🧹 Cleared ${eventType} callbacks`);
      }
    } else {
      // Clear all callbacks
      Object.keys(state.callbacks).forEach(type => {
        state.callbacks[type] = [];
      });
      console.log('🧹 Cleared all callbacks');
    }
  };

  const notifyCallbacks = (callbacks, data, eventType = 'unknown') => {
    if (!callbacks || !Array.isArray(callbacks) || callbacks.length === 0) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    callbacks.forEach((callback, index) => {
      try {
        callback(data);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`❌ Callback error for ${eventType}[${index}]:`, error);
        
        // Create error event for callback failures
        const errorEvent = createSpeechEvent({
          type: 'callback_error',
          data: {
            originalEventType: eventType,
            callbackIndex: index,
            error: error.message,
            stack: error.stack
          },
          severity: 'error'
        });

        // Queue this error to avoid infinite recursion
        queueEvent(errorEvent, 'onError');
      }
    });

    if (successCount > 0 || errorCount > 0) {
      console.log(`📤 ${eventType}: ${successCount} callbacks succeeded, ${errorCount} failed`);
    }
  };

  const queueEvent = (eventData, eventType, priority = 'normal') => {
    const event = {
      data: eventData,
      type: eventType,
      priority,
      timestamp: Date.now(),
      id: generateEventId()
    };

    // Insert based on priority
    if (priority === 'high') {
      eventQueue.unshift(event);
    } else {
      eventQueue.push(event);
    }

    // Process queue if not already processing
    if (!isProcessingEvents) {
      processEventQueue();
    }
  };

  const processEventQueue = async () => {
    if (isProcessingEvents || eventQueue.length === 0) {
      return;
    }

    isProcessingEvents = true;

    while (eventQueue.length > 0) {
      const event = eventQueue.shift();
      
      try {
        // Emit the event
        await emitEvent(event);
        
        // Small delay to prevent overwhelming the system
        if (eventQueue.length > 10) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
      } catch (error) {
        console.error('❌ Error processing queued event:', error);
      }
    }

    isProcessingEvents = false;
  };

  const emitEvent = async (event) => {
    // This would be implemented by the specific event system
    // For now, just log the event processing
    console.log(`🚀 Processing queued event: ${event.type} [${event.id}]`);
  };

  const generateEventId = () => {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const createStateChangeEvent = (state, previousState, changedProperties) => {
    return createSpeechEvent({
      type: 'state_change',
      data: {
        current: {
          isListening: state.isListening,
          isInitialized: state.isInitialized,
          activeBackend: state.activeBackend,
          language: state.language,
          continuous: state.continuous
        },
        previous: previousState,
        changed: changedProperties,
        timestamp: Date.now()
      },
      severity: 'info'
    });
  };

  const notifyStateChange = (state, previousState, changedProperties) => {
    if (!changedProperties || changedProperties.length === 0) {
      return;
    }

    const stateChangeEvent = createStateChangeEvent(state, previousState, changedProperties);
    
    if (state.callbacks && state.callbacks.onStateChange) {
      notifyCallbacks(state.callbacks.onStateChange, stateChangeEvent, 'onStateChange');
    }
  };

  const trackStateChanges = (state, callback) => {
    // Create a proxy to automatically track state changes
    const previousState = JSON.parse(JSON.stringify({
      isListening: state.isListening,
      isInitialized: state.isInitialized,
      activeBackend: state.activeBackend,
      language: state.language,
      continuous: state.continuous
    }));

    return new Proxy(state, {
      set(target, property, value) {
        const oldValue = target[property];
        target[property] = value;

        // Check if this is a tracked property that changed
        const trackedProperties = ['isListening', 'isInitialized', 'activeBackend', 'language', 'continuous'];
        
        if (trackedProperties.includes(property) && oldValue !== value) {
          const changedProperties = [property];
          
          if (callback) {
            callback(target, previousState, changedProperties);
          }
          
          // Update previous state
          previousState[property] = value;
        }

        return true;
      }
    });
  };

  const createErrorEvent = (error, context = {}) => {
    return createSpeechEvent({
      type: 'speech_recognition_error',
      data: {
        error: error.message || error,
        code: error.code || 'unknown',
        name: error.name || 'Error',
        stack: error.stack,
        context,
        timestamp: Date.now(),
        recoverable: isRecoverableError(error)
      },
      severity: 'error'
    });
  };

  const isRecoverableError = (error) => {
    const recoverableErrors = [
      'no-speech',
      'aborted',
      'network'
    ];

    return recoverableErrors.includes(error.code || error.error);
  };

  const handleError = (state, error, context = {}) => {
    console.error('🚨 Speech recognition error:', error);
    
    // Update error metrics
    if (state.metrics) {
      state.metrics.errors = (state.metrics.errors || 0) + 1;
      state.metrics.lastError = {
        message: error.message || error,
        timestamp: Date.now(),
        context
      };
    }

    // Create comprehensive error event
    const errorEvent = createErrorEvent(error, context);
    
    // Notify error callbacks
    if (state.callbacks && state.callbacks.onError) {
      notifyCallbacks(state.callbacks.onError, errorEvent, 'onError');
    }

    // Queue for processing if needed
    if (context.async) {
      queueEvent(errorEvent, 'onError', 'high');
    }

    return errorEvent;
  };

  const validateCallbackRegistration = (eventType, callback) => {
    const validEvents = [
      'onResult', 'onInterimResult', 'onError', 'onStart', 'onEnd',
      'onSpeechStart', 'onSpeechEnd', 'onAudioProcessing', 'onStateChange'
    ];

    if (!validEvents.includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}. Valid types: ${validEvents.join(', ')}`);
    }

    if (typeof callback !== 'function') {
      throw new Error(`Callback must be a function, got ${typeof callback}`);
    }

    return true;
  };

  const getEventStatistics = () => {
    return {
      queueLength: eventQueue.length,
      isProcessingEvents,
      lastEventId: eventQueue.length > 0 ? eventQueue[eventQueue.length - 1].id : null,
      totalEventsProcessed: 0 // This would be tracked in a real implementation
    };
  };

  const clearEventQueue = () => {
    eventQueue = [];
    isProcessingEvents = false;
    console.log('🧹 Event queue cleared');
  };

  return {
    initializeCallbacks,
    addCallback,
    removeCallback,
    clearCallbacks,
    notifyCallbacks,
    queueEvent,
    processEventQueue,
    createStateChangeEvent,
    notifyStateChange,
    trackStateChanges,
    createErrorEvent,
    handleError,
    validateCallbackRegistration,
    getEventStatistics,
    clearEventQueue
  };
};