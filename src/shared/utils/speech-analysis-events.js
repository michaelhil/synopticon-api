/**
 * Event handling system for speech analysis pipeline
 */

export const createEventManager = () => {
  // Event handlers
  const callbacks = {
    onTranscription: [],
    onAnalysis: [],
    onSessionStart: [],
    onSessionEnd: [],
    onError: []
  };

  // Setup event handlers for the speech API
  const setupEventHandlers = (speechAPI, sessionManager, metricsTracker) => {
    if (!speechAPI) return;

    // Handle transcriptions
    speechAPI.onTranscription((event) => {
      sessionManager.addTranscription(event.data.result);
      metricsTracker.incrementTranscriptions();
      
      // Forward to pipeline callbacks
      callbacks.onTranscription.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Transcription callback error:', error);
        }
      });
    });

    // Handle analyses
    speechAPI.onAnalysis((event) => {
      sessionManager.addAnalysis(event.data.result);
      metricsTracker.incrementAnalyses();
      
      // Forward to pipeline callbacks
      callbacks.onAnalysis.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Analysis callback error:', error);
        }
      });
    });

    // Handle errors
    speechAPI.onError((event) => {
      metricsTracker.incrementErrors();
      
      // Forward to pipeline callbacks
      callbacks.onError.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Error callback error:', error);
        }
      });
    });
  };

  // Event subscription methods
  const onTranscription = (callback) => subscribeCallback('onTranscription', callback);
  const onAnalysis = (callback) => subscribeCallback('onAnalysis', callback);
  const onSessionStart = (callback) => subscribeCallback('onSessionStart', callback);
  const onSessionEnd = (callback) => subscribeCallback('onSessionEnd', callback);
  const onError = (callback) => subscribeCallback('onError', callback);

  const subscribeCallback = (eventType, callback) => {
    callbacks[eventType].push(callback);
    return () => {
      const index = callbacks[eventType].indexOf(callback);
      if (index !== -1) callbacks[eventType].splice(index, 1);
    };
  };

  return {
    callbacks,
    setupEventHandlers,
    onTranscription,
    onAnalysis,
    onSessionStart,
    onSessionEnd,
    onError
  };
};