/**
 * Browser Speech Client
 * Handles Web Speech API for transcription and sends text to server for analysis
 * Following functional programming patterns with factory functions
 */

import { createDevValidator } from './utils/url-validator.js';

// Create browser speech client factory
export const createBrowserSpeechClient = (config = {}) => {
  const state = {
    recognition: null,
    isListening: false,
    serverUrl: config.serverUrl || (process.env.SPEECH_SERVER_URL || 'http://localhost:3000/api/analyze'),
    sessionId: config.sessionId || generateSessionId(),
    
    // Configuration
    config: {
      language: config.language || 'en-US',
      continuous: config.continuous !== false,
      interimResults: config.interimResults !== false,
      maxAlternatives: config.maxAlternatives || 1,
      sendInterimResults: config.sendInterimResults || false,
      batchSize: config.batchSize || 5, // Batch text chunks before sending
      batchTimeout: config.batchTimeout || 2000, // Send batch after 2 seconds
      ...config
    },
    
    // Text batching
    textBatch: [],
    batchTimer: null,
    
    // Callbacks
    callbacks: {
      onTranscript: [],
      onAnalysis: [],
      onError: [],
      onStatusChange: []
    }
  };

  // Generate session ID
  function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Initialize Web Speech API
  const initialize = () => {
    // Validate server URL for security
    const urlValidator = createDevValidator();
    const validation = urlValidator.validate(state.serverUrl);
    
    if (!validation.valid) {
      throw new Error(`Invalid server URL: ${validation.error}`);
    }
    
    // Check for Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Web Speech API not supported in this browser');
    }

    // Create recognition instance
    state.recognition = new SpeechRecognition();
    state.recognition.lang = state.config.language;
    state.recognition.continuous = state.config.continuous;
    state.recognition.interimResults = state.config.interimResults;
    state.recognition.maxAlternatives = state.config.maxAlternatives;

    // Setup event handlers
    setupRecognitionHandlers();
    
    console.log('✅ Browser speech client initialized');
    console.log(`✅ Server URL validated: ${validation.hostname}:${validation.port}`);
    return true;
  };

  // Setup recognition event handlers
  const setupRecognitionHandlers = () => {
    // Handle results
    state.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.95;
        
        const transcriptData = {
          text: transcript,
          confidence,
          isFinal: result.isFinal,
          timestamp: Date.now(),
          sessionId: state.sessionId
        };

        // Notify transcript callbacks
        notifyCallbacks('onTranscript', transcriptData);

        // Add to batch if final
        if (result.isFinal || (state.config.sendInterimResults && !result.isFinal)) {
          addToBatch(transcriptData);
        }
      }
    };

    // Handle errors
    state.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      const errorData = {
        type: 'recognition_error',
        error: event.error,
        message: getErrorMessage(event.error),
        timestamp: Date.now()
      };
      
      notifyCallbacks('onError', errorData);
      
      // Auto-restart on certain errors
      if (['network', 'audio-capture'].includes(event.error) && state.isListening) {
        console.log('Attempting to restart recognition...');
        setTimeout(() => {
          if (state.isListening) {
            state.recognition.start();
          }
        }, 1000);
      }
    };

    // Handle end
    state.recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Send any remaining batch
      if (state.textBatch.length > 0) {
        sendBatch();
      }
      
      // Restart if still listening (for continuous mode)
      if (state.isListening && state.config.continuous) {
        state.recognition.start();
      } else {
        state.isListening = false;
        notifyCallbacks('onStatusChange', { isListening: false });
      }
    };

    // Handle start
    state.recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      state.isListening = true;
      notifyCallbacks('onStatusChange', { isListening: true });
    };
  };

  // Get error message
  const getErrorMessage = (error) => {
    const errorMessages = {
      'no-speech': 'No speech detected',
      'audio-capture': 'Microphone not available',
      'not-allowed': 'Microphone permission denied',
      'network': 'Network error',
      'aborted': 'Recognition aborted',
      'language-not-supported': 'Language not supported',
      'service-not-allowed': 'Service not allowed'
    };
    
    return errorMessages[error] || `Unknown error: ${error}`;
  };

  // Add transcript to batch
  const addToBatch = (transcriptData) => {
    state.textBatch.push(transcriptData);
    
    // Clear existing timer
    if (state.batchTimer) {
      clearTimeout(state.batchTimer);
    }
    
    // Send batch if it reaches the size limit
    if (state.textBatch.length >= state.config.batchSize) {
      sendBatch();
    } else {
      // Set timer to send batch after timeout
      state.batchTimer = setTimeout(() => {
        if (state.textBatch.length > 0) {
          sendBatch();
        }
      }, state.config.batchTimeout);
    }
  };

  // Send batch to server
  const sendBatch = async () => {
    if (state.textBatch.length === 0) return;
    
    const batch = [...state.textBatch];
    state.textBatch = [];
    
    // Clear timer
    if (state.batchTimer) {
      clearTimeout(state.batchTimer);
      state.batchTimer = null;
    }
    
    try {
      const response = await fetch(state.config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          transcripts: batch,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const analysisResult = await response.json();
      
      // Notify analysis callbacks
      notifyCallbacks('onAnalysis', analysisResult);
      
    } catch (error) {
      console.error('Failed to send batch to server:', error);
      
      notifyCallbacks('onError', {
        type: 'server_error',
        error: error.message,
        batch,
        timestamp: Date.now()
      });
      
      // Re-add batch for retry if needed
      if (state.config.retryOnError) {
        state.textBatch = [...batch, ...state.textBatch];
      }
    }
  };

  // Start listening
  const startListening = async () => {
    if (!state.recognition) {
      throw new Error('Speech client not initialized');
    }
    
    if (state.isListening) {
      console.warn('Already listening');
      return;
    }
    
    try {
      // Request microphone permission if needed
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      state.recognition.start();
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      throw error;
    }
  };

  // Stop listening
  const stopListening = () => {
    if (!state.recognition || !state.isListening) {
      return;
    }
    
    state.isListening = false;
    state.recognition.stop();
    
    // Send any remaining batch
    if (state.textBatch.length > 0) {
      sendBatch();
    }
  };

  // Send text directly (for manual input)
  const sendText = async (text, options = {}) => {
    const transcriptData = {
      text,
      confidence: 1.0,
      isFinal: true,
      timestamp: Date.now(),
      sessionId: state.sessionId,
      isManual: true,
      ...options
    };
    
    // Notify transcript callbacks
    notifyCallbacks('onTranscript', transcriptData);
    
    // Send immediately
    try {
      const response = await fetch(state.config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          transcripts: [transcriptData],
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const analysisResult = await response.json();
      
      // Notify analysis callbacks
      notifyCallbacks('onAnalysis', analysisResult);
      
      return analysisResult;
      
    } catch (error) {
      console.error('Failed to send text to server:', error);
      
      notifyCallbacks('onError', {
        type: 'server_error',
        error: error.message,
        text,
        timestamp: Date.now()
      });
      
      throw error;
    }
  };

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (state.recognition) {
      state.recognition.lang = state.config.language;
      state.recognition.continuous = state.config.continuous;
      state.recognition.interimResults = state.config.interimResults;
      state.recognition.maxAlternatives = state.config.maxAlternatives;
    }
  };

  // Event subscription methods
  const onTranscript = (callback) => subscribeCallback('onTranscript', callback);
  const onAnalysis = (callback) => subscribeCallback('onAnalysis', callback);
  const onError = (callback) => subscribeCallback('onError', callback);
  const onStatusChange = (callback) => subscribeCallback('onStatusChange', callback);

  // Helper functions
  const subscribeCallback = (eventType, callback) => {
    state.callbacks[eventType].push(callback);
    return () => {
      const index = state.callbacks[eventType].indexOf(callback);
      if (index !== -1) state.callbacks[eventType].splice(index, 1);
    };
  };

  const notifyCallbacks = (eventType, data) => {
    state.callbacks[eventType].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Callback error for ${eventType}:`, error);
      }
    });
  };

  // Cleanup
  const cleanup = () => {
    stopListening();
    
    if (state.batchTimer) {
      clearTimeout(state.batchTimer);
      state.batchTimer = null;
    }
    
    state.textBatch = [];
    state.callbacks = {
      onTranscript: [],
      onAnalysis: [],
      onError: [],
      onStatusChange: []
    };
    
    console.log('🧹 Browser speech client cleaned up');
  };

  return {
    // Core functionality
    initialize,
    startListening,
    stopListening,
    sendText,
    cleanup,
    
    // Configuration
    updateConfig,
    getConfig: () => ({ ...state.config }),
    
    // Session management
    getSessionId: () => state.sessionId,
    newSession: () => {
      state.sessionId = generateSessionId();
      return state.sessionId;
    },
    
    // Status
    isListening: () => state.isListening,
    isInitialized: () => state.recognition !== null,
    
    // Event handlers
    onTranscript,
    onAnalysis,
    onError,
    onStatusChange
  };
};

// Export default configuration
export const DEFAULT_CLIENT_CONFIG = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  sendInterimResults: false,
  batchSize: 5,
  batchTimeout: 2000,
  serverUrl: process.env.SPEECH_SERVER_URL || 'http://localhost:3000/api/analyze',
  retryOnError: false
};