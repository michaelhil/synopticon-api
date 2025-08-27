/**
 * Speech Recognition with Hybrid Fallbacks
 * Provides unified speech recognition interface across environments
 * Following functional programming patterns with factory functions
 * 
 * Refactored into modular components for maintainability:
 * - Backend Manager: Handles backend selection and lifecycle
 * - Event Manager: Manages callbacks and event processing
 * - Metrics Calculator: Tracks and analyzes speech recognition metrics
 * - Individual Backends: Web Speech API and Fallback implementations
 */

import { checkFeatures } from '../../shared/utils/runtime-detector.js';
import { createSpeechEvent } from '../../core/configuration/types.ts';

// Import modular components
import { createBackendManager } from './recognition/backend-manager.js';
import { createEventManager } from './recognition/event-manager.js';
import { createMetricsCalculator } from './recognition/metrics-calculator.js';
import { createWebSpeechAPIBackend } from './recognition/web-speech-backend.js';
import { createFallbackBackend } from './recognition/fallback-backend.js';

// Speech recognition backends configuration
const SPEECH_BACKENDS = {
  web_speech_api: {
    name: 'Web Speech API',
    description: 'Browser native speech recognition with Web Audio API integration',
    requirements: ['browser', 'https'],
    availability: 'chrome_edge'
  },
  speech_recognition_fallback: {
    name: 'Comprehensive Text Input Simulation',
    description: 'Advanced text input fallback with UI for development and testing',
    requirements: ['browser'],
    availability: 'universal'
  }
};

// Create speech recognition factory
export const createSpeechRecognition = (config = {}) => {
  // Initialize comprehensive state
  const state = {
    runtime: checkFeatures(),
    features: checkFeatures(),
    activeBackend: null,
    isListening: false,
    isInitialized: false,
    language: config.language || 'en-US',
    continuous: config.continuous !== false,
    interimResults: config.interimResults !== false,
    maxAlternatives: config.maxAlternatives || 3,
    
    // Recognition state
    recognition: null,
    currentTranscript: '',
    finalTranscript: '',
    
    // Metrics and callbacks will be initialized by respective managers
    metrics: null,
    callbacks: null
  };

  // Initialize modular components
  const eventManager = createEventManager();
  const metricsCalculator = createMetricsCalculator();
  
  // Initialize backends
  const backends = {
    web_speech_api: createWebSpeechAPIBackend(),
    speech_recognition_fallback: createFallbackBackend()
  };
  
  // Initialize backend manager with backends
  const backendManager = createBackendManager(backends, SPEECH_BACKENDS);
  
  // Initialize event callbacks and metrics
  eventManager.initializeCallbacks(state);
  metricsCalculator.initializeMetrics(state);

  // Initialize the best available speech recognition backend
  const initialize = async () => {
    try {
      const success = await backendManager.initializeBestBackend(state);
      
      if (success) {
        console.log(`✅ Speech recognition initialized with backend: ${state.activeBackend}`);
        return true;
      }
      
    } catch (error) {
      const errorEvent = eventManager.handleError(state, error, {
        context: 'initialization',
        attempted: 'backend_selection'
      });
      throw error;
    }
  };

  // Start listening for speech
  const startListening = async () => {
    try {
      const backendName = await backendManager.startBackend(state);
      
      // Start metrics session
      metricsCalculator.startSession(state, backendName, state.language);
      
      // Clear transcripts
      state.currentTranscript = '';
      state.finalTranscript = '';
      
      // Notify start callbacks
      const startEvent = createSpeechEvent({
        type: 'speech_recognition_start',
        data: { 
          backend: backendName,
          language: state.language,
          continuous: state.continuous,
          interimResults: state.interimResults
        }
      });
      
      eventManager.notifyCallbacks(state.callbacks.onStart, startEvent, 'onStart');
      
      console.log(`🎤 Speech recognition started with ${backendName}`);
      
    } catch (error) {
      eventManager.handleError(state, error, {
        context: 'start_listening',
        backend: state.activeBackend
      });
      throw error;
    }
  };

  // Stop listening
  const stopListening = async () => {
    try {
      const backendName = await backendManager.stopBackend(state);
      
      if (backendName) {
        // End metrics session and get summary
        const sessionSummary = metricsCalculator.endSession(state);
        
        // Notify end callbacks with session summary
        const endEvent = createSpeechEvent({
          type: 'speech_recognition_end',
          data: { 
            backend: backendName,
            session: sessionSummary,
            totalTranscript: state.finalTranscript
          }
        });
        
        eventManager.notifyCallbacks(state.callbacks.onEnd, endEvent, 'onEnd');
        
        console.log(`🔇 Speech recognition stopped. Session summary:`, sessionSummary);
      }
      
    } catch (error) {
      eventManager.handleError(state, error, {
        context: 'stop_listening',
        backend: state.activeBackend
      });
    }
  };

  // Abort listening immediately
  const abortListening = async () => {
    try {
      const backendName = await backendManager.abortBackend(state);
      
      if (backendName) {
        // End metrics session for aborted session
        const sessionSummary = metricsCalculator.endSession(state);
        
        console.log(`🛑 Speech recognition aborted. Backend: ${backendName}`);
        
        // Optionally notify abort event
        const abortEvent = createSpeechEvent({
          type: 'speech_recognition_abort',
          data: { 
            backend: backendName,
            reason: 'user_abort',
            session: sessionSummary
          }
        });
        
        eventManager.notifyCallbacks(state.callbacks.onEnd, abortEvent, 'onEnd');
      }
      
    } catch (error) {
      eventManager.handleError(state, error, {
        context: 'abort_listening',
        backend: state.activeBackend
      });
    }
  };

  // Get comprehensive current status
  const getStatus = () => ({
    isInitialized: state.isInitialized,
    isListening: state.isListening,
    activeBackend: state.activeBackend,
    backendInfo: state.activeBackend ? SPEECH_BACKENDS[state.activeBackend] : null,
    language: state.language,
    continuous: state.continuous,
    interimResults: state.interimResults,
    maxAlternatives: state.maxAlternatives,
    
    // Enhanced metrics through metrics calculator
    metrics: metricsCalculator.generateMetricsReport(state, 'summary'),
    detailedMetrics: metricsCalculator.generateMetricsReport(state, 'detailed'),
    
    // Current transcripts
    currentTranscript: state.currentTranscript,
    finalTranscript: state.finalTranscript,
    
    // Event system status
    eventStats: eventManager.getEventStatistics(),
    
    // Runtime info
    runtime: state.runtime,
    features: state.features
  });

  // Comprehensive cleanup of all resources
  const cleanup = async () => {
    try {
      // Stop listening if active
      if (state.isListening) {
        await stopListening();
      }

      // Cleanup backend resources
      await backendManager.cleanupBackend(state);
      
      // Clear event queue and callbacks
      eventManager.clearEventQueue();
      eventManager.clearCallbacks(state);
      
      // Reset metrics but preserve history
      metricsCalculator.resetMetrics(state, true);
      
      // Clear any remaining event listeners
      if (state.cleanupEventListeners) {
        state.cleanupEventListeners();
      }
      
      console.log('🧹 Speech recognition fully cleaned up');
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      // Force cleanup even if errors occur
      state.recognition = null;
      state.isInitialized = false;
      state.activeBackend = null;
    }
  };

  // Enhanced event subscription methods with validation
  const onStart = (callback) => {
    eventManager.validateCallbackRegistration('onStart', callback);
    eventManager.addCallback(state, 'onStart', callback);
    return () => eventManager.removeCallback(state, 'onStart', callback);
  };
  
  const onEnd = (callback) => {
    eventManager.validateCallbackRegistration('onEnd', callback);
    eventManager.addCallback(state, 'onEnd', callback);
    return () => eventManager.removeCallback(state, 'onEnd', callback);
  };
  
  const onResult = (callback) => {
    eventManager.validateCallbackRegistration('onResult', callback);
    eventManager.addCallback(state, 'onResult', callback);
    return () => eventManager.removeCallback(state, 'onResult', callback);
  };
  
  const onInterimResult = (callback) => {
    eventManager.validateCallbackRegistration('onInterimResult', callback);
    eventManager.addCallback(state, 'onInterimResult', callback);
    return () => eventManager.removeCallback(state, 'onInterimResult', callback);
  };
  
  const onError = (callback) => {
    eventManager.validateCallbackRegistration('onError', callback);
    eventManager.addCallback(state, 'onError', callback);
    return () => eventManager.removeCallback(state, 'onError', callback);
  };
  
  const onSpeechStart = (callback) => {
    eventManager.validateCallbackRegistration('onSpeechStart', callback);
    eventManager.addCallback(state, 'onSpeechStart', callback);
    return () => eventManager.removeCallback(state, 'onSpeechStart', callback);
  };
  
  const onSpeechEnd = (callback) => {
    eventManager.validateCallbackRegistration('onSpeechEnd', callback);
    eventManager.addCallback(state, 'onSpeechEnd', callback);
    return () => eventManager.removeCallback(state, 'onSpeechEnd', callback);
  };
  
  const onAudioProcessing = (callback) => {
    eventManager.validateCallbackRegistration('onAudioProcessing', callback);
    eventManager.addCallback(state, 'onAudioProcessing', callback);
    return () => eventManager.removeCallback(state, 'onAudioProcessing', callback);
  };
  
  // New event subscription for state changes
  const onStateChange = (callback) => {
    eventManager.validateCallbackRegistration('onStateChange', callback);
    eventManager.addCallback(state, 'onStateChange', callback);
    return () => eventManager.removeCallback(state, 'onStateChange', callback);
  };


  return {
    // Core functionality
    initialize,
    startListening,
    stopListening,
    abortListening,
    cleanup,

    // Status and information
    getStatus,
    isListening: () => state.isListening,
    isInitialized: () => state.isInitialized,
    getActiveBackend: () => state.activeBackend,
    getCurrentTranscript: () => state.currentTranscript,
    getFinalTranscript: () => state.finalTranscript,

    // Enhanced event handlers
    onStart,
    onEnd,
    onResult,
    onInterimResult,
    onError,
    onSpeechStart,
    onSpeechEnd,
    onAudioProcessing,
    onStateChange,

    // Configuration with state change tracking
    setLanguage: (language) => {
      const previous = state.language;
      state.language = language;
      eventManager.notifyStateChange(state, { language: previous }, ['language']);
    },
    setContinuous: (continuous) => {
      const previous = state.continuous;
      state.continuous = continuous;
      eventManager.notifyStateChange(state, { continuous: previous }, ['continuous']);
    },
    setInterimResults: (interimResults) => {
      const previous = state.interimResults;
      state.interimResults = interimResults;
      eventManager.notifyStateChange(state, { interimResults: previous }, ['interimResults']);
    },
    setMaxAlternatives: (maxAlternatives) => {
      state.maxAlternatives = maxAlternatives;
    },

    // Backend information
    getSupportedBackends: () => backendManager.getSupportedBackends(),
    getBackendInfo: (backendName) => backendManager.getBackendInfo(backendName),
    checkBackendAvailability: (backendName) => backendManager.checkBackendAvailability(backendName, state),

    // Enhanced metrics
    getMetrics: (format = 'summary') => metricsCalculator.generateMetricsReport(state, format),
    resetMetrics: (preserveHistory = false) => metricsCalculator.resetMetrics(state, preserveHistory),
    exportMetrics: (format = 'json') => metricsCalculator.exportMetrics(state, format),

    // Event management
    clearCallbacks: (eventType = null) => eventManager.clearCallbacks(state, eventType),
    getEventStatistics: () => eventManager.getEventStatistics(),

    // Advanced features
    getRuntimeInfo: () => state.runtime,
    getFeatureInfo: () => state.features,
    getState: () => ({ ...state }) // For debugging purposes
  };
};