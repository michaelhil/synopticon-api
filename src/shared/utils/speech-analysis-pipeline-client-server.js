/**
 * Speech Analysis Pipeline - Client/Server Architecture
 * Browser client handles Web Speech API, server handles analysis
 * Following functional programming patterns with factory functions
 */

import { createBrowserSpeechClient } from '../browser-speech-client.js';
import { createPipelineEvents } from '../core/pipeline-events.js';
import { createSpeechPipelineStatus } from '../core/types.js';

// Create client-server speech analysis pipeline factory
export const createSpeechAnalysisPipeline = (config = {}) => {
  const state = {
    speechClient: null,
    isInitialized: false,
    isListening: false,
    sessionId: null,
    
    // Configuration
    config: {
      serverUrl: config.serverUrl || (process.env.SPEECH_SERVER_URL || 'http://localhost:3000/api/analyze'),
      language: config.language || 'en-US',
      continuous: config.continuous !== false,
      interimResults: config.interimResults !== false,
      sendInterimResults: config.sendInterimResults || false,
      batchSize: config.batchSize || 5,
      batchTimeout: config.batchTimeout || 2000,
      autoReconnect: config.autoReconnect !== false,
      ...config
    },
    
    // Statistics
    stats: {
      transcriptCount: 0,
      analysisCount: 0,
      errorCount: 0,
      sessionStartTime: null,
      lastTranscriptTime: null,
      lastAnalysisTime: null
    }
  };

  // Create event system
  const events = createPipelineEvents();

  // Initialize pipeline
  const initialize = async (options = {}) => {
    if (state.isInitialized) {
      console.warn('Pipeline already initialized');
      return true;
    }

    try {
      console.log('🚀 Initializing client-server speech analysis pipeline...');
      
      // Merge options with config
      const mergedConfig = { ...state.config, ...options };
      state.config = mergedConfig;
      
      // Create browser speech client
      state.speechClient = createBrowserSpeechClient({
        serverUrl: mergedConfig.serverUrl,
        language: mergedConfig.language,
        continuous: mergedConfig.continuous,
        interimResults: mergedConfig.interimResults,
        sendInterimResults: mergedConfig.sendInterimResults,
        batchSize: mergedConfig.batchSize,
        batchTimeout: mergedConfig.batchTimeout
      });
      
      // Initialize speech client
      state.speechClient.initialize();
      
      // Setup event forwarding
      setupEventForwarding();
      
      // Create new session
      state.sessionId = state.speechClient.getSessionId();
      
      state.isInitialized = true;
      
      // Emit ready event
      events.emit('ready', {
        pipeline: 'speech_analysis_client_server',
        sessionId: state.sessionId,
        config: mergedConfig
      });
      
      console.log('✅ Speech analysis pipeline initialized');
      console.log(`📝 Session ID: ${state.sessionId}`);
      console.log(`🌐 Server URL: ${mergedConfig.serverUrl}`);
      
      return true;
      
    } catch (error) {
      console.error('Pipeline initialization failed:', error);
      events.emit('error', {
        type: 'initialization_error',
        error: error.message
      });
      throw error;
    }
  };

  // Setup event forwarding from speech client
  const setupEventForwarding = () => {
    // Forward transcripts
    state.speechClient.onTranscript((data) => {
      state.stats.transcriptCount++;
      state.stats.lastTranscriptTime = Date.now();
      
      events.emit('transcript', {
        text: data.text,
        confidence: data.confidence,
        isFinal: data.isFinal,
        timestamp: data.timestamp,
        sessionId: data.sessionId
      });
    });
    
    // Forward analysis results
    state.speechClient.onAnalysis((data) => {
      state.stats.analysisCount++;
      state.stats.lastAnalysisTime = Date.now();
      
      events.emit('analysis', {
        results: data.results,
        summary: data.summary,
        timestamp: data.timestamp,
        sessionId: data.sessionId
      });
      
      // Also emit individual analysis results
      if (data.results && Array.isArray(data.results)) {
        data.results.forEach(result => {
          if (result.analyses) {
            result.analyses.forEach(analysis => {
              events.emit('analysis_result', {
                prompt: analysis.prompt,
                result: analysis.result,
                confidence: analysis.confidence,
                timestamp: analysis.timestamp
              });
            });
          }
        });
      }
    });
    
    // Forward errors
    state.speechClient.onError((data) => {
      state.stats.errorCount++;
      
      events.emit('error', {
        type: data.type,
        error: data.error,
        timestamp: data.timestamp
      });
    });
    
    // Forward status changes
    state.speechClient.onStatusChange((data) => {
      state.isListening = data.isListening;
      
      events.emit('status_change', {
        isListening: data.isListening,
        timestamp: Date.now()
      });
      
      // Update stats
      if (data.isListening && !state.stats.sessionStartTime) {
        state.stats.sessionStartTime = Date.now();
      } else if (!data.isListening && state.stats.sessionStartTime) {
        const duration = Date.now() - state.stats.sessionStartTime;
        console.log(`📊 Session duration: ${Math.round(duration / 1000)}s`);
      }
    });
  };

  // Start listening
  const startListening = async () => {
    if (!state.isInitialized) {
      throw new Error('Pipeline not initialized');
    }
    
    if (state.isListening) {
      console.warn('Already listening');
      return;
    }
    
    try {
      console.log('🎤 Starting speech recognition...');
      
      await state.speechClient.startListening();
      
      events.emit('listening_started', {
        sessionId: state.sessionId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      events.emit('error', {
        type: 'start_error',
        error: error.message
      });
      throw error;
    }
  };

  // Stop listening
  const stopListening = () => {
    if (!state.isInitialized || !state.isListening) {
      return;
    }
    
    console.log('🛑 Stopping speech recognition...');
    
    state.speechClient.stopListening();
    
    events.emit('listening_stopped', {
      sessionId: state.sessionId,
      timestamp: Date.now()
    });
  };

  // Send text manually
  const sendText = async (text, options = {}) => {
    if (!state.isInitialized) {
      throw new Error('Pipeline not initialized');
    }
    
    if (!text || !text.trim()) {
      throw new Error('No text provided');
    }
    
    try {
      const result = await state.speechClient.sendText(text, options);
      
      events.emit('manual_text', {
        text,
        result,
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (error) {
      console.error('Failed to send text:', error);
      events.emit('error', {
        type: 'send_error',
        error: error.message
      });
      throw error;
    }
  };

  // Get session data from server
  const getSessionData = async () => {
    if (!state.isInitialized) {
      throw new Error('Pipeline not initialized');
    }
    
    try {
      // Properly construct URL
      const baseUrl = new URL(state.config.serverUrl);
      const apiBase = `${baseUrl.protocol}//${baseUrl.host}/api`;
      const sessionUrl = `${apiBase}/session/${state.sessionId}`;
      
      const response = await fetch(sessionUrl);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const sessionData = await response.json();
      return sessionData;
      
    } catch (error) {
      console.error('Failed to get session data:', error);
      throw error;
    }
  };

  // Update session metadata
  const updateSessionMetadata = async (meta,data) => {
    if (!state.isInitialized) {
      throw new Error('Pipeline not initialized');
    }
    
    try {
      // Properly construct URL
      const baseUrl = new URL(state.config.serverUrl);
      const apiBase = `${baseUrl.protocol}//${baseUrl.host}/api`;
      const metadataUrl = `${apiBase}/session/${state.sessionId}/metadata`;
      
      const response = await fetch(
        metadataUrl,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(meta,data)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Failed to update metadata:', error);
      throw error;
    }
  };

  // End session
  const endSession = async () => {
    if (!state.isInitialized) {
      return;
    }
    
    // Stop listening if active
    if (state.isListening) {
      stopListening();
    }
    
    try {
      // Properly construct URL
      const baseUrl = new URL(state.config.serverUrl);
      const apiBase = `${baseUrl.protocol}//${baseUrl.host}/api`;
      const deleteUrl = `${apiBase}/session/${state.sessionId}`;
      
      const response = await fetch(
        deleteUrl,
        {
          method: 'DELETE'
        }
      );
      
      if (!response.ok) {
        console.warn(`Failed to end session on server: ${response.status}`);
      }
      
      events.emit('session_ended', {
        sessionId: state.sessionId,
        stats: getStatistics(),
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // Start new session
  const startNewSession = () => {
    if (state.isListening) {
      stopListening();
    }
    
    state.sessionId = state.speechClient.newSession();
    state.stats = {
      transcriptCount: 0,
      analysisCount: 0,
      errorCount: 0,
      sessionStartTime: null,
      lastTranscriptTime: null,
      lastAnalysisTime: null
    };
    
    console.log(`📝 New session started: ${state.sessionId}`);
    
    events.emit('new_session', {
      sessionId: state.sessionId,
      timestamp: Date.now()
    });
    
    return state.sessionId;
  };

  // Get pipeline status
  const getStatus = () => {
    return createSpeechPipelineStatus({
      isInitialized: state.isInitialized,
      isListening: state.isListening,
      sessionId: state.sessionId,
      serverUrl: state.config.serverUrl,
      stats: getStatistics()
    });
  };

  // Get statistics
  const getStatistics = () => {
    const duration = state.stats.sessionStartTime 
      ? Date.now() - state.stats.sessionStartTime 
      : 0;
    
    return {
      ...state.stats,
      duration,
      transcriptsPerMinute: duration > 0 
        ? (state.stats.transcriptCount / (duration / 60000)).toFixed(2)
        : 0,
      analysesPerMinute: duration > 0
        ? (state.stats.analysisCount / (duration / 60000)).toFixed(2)
        : 0
    };
  };

  // Update configuration
  const updateConfig = (newConfig) => {
    Object.assign(state.config, newConfig);
    
    if (state.speechClient) {
      state.speechClient.updateConfig(newConfig);
    }
    
    events.emit('config_updated', {
      config: state.config,
      timestamp: Date.now()
    });
  };

  // Cleanup
  const cleanup = async () => {
    console.log('🧹 Cleaning up speech analysis pipeline...');
    
    // End session if active
    if (state.sessionId) {
      await endSession();
    }
    
    // Cleanup speech client
    if (state.speechClient) {
      state.speechClient.cleanup();
    }
    
    // Clear event listeners
    events.removeAllListeners();
    
    state.isInitialized = false;
    state.isListening = false;
    
    console.log('✅ Pipeline cleanup complete');
  };

  return {
    // Core functionality
    initialize,
    startListening,
    stopListening,
    sendText,
    cleanup,
    
    // Session management
    getSessionData,
    updateSessionMetadata,
    endSession,
    startNewSession,
    getSessionId: () => state.sessionId,
    
    // Status and statistics
    getStatus,
    getStatistics,
    isInitialized: () => state.isInitialized,
    isListening: () => state.isListening,
    
    // Configuration
    updateConfig,
    getConfig: () => ({ ...state.config }),
    
    // Event handling
    on: events.on,
    off: events.off,
    once: events.once,
    
    // Direct event subscriptions
    onTranscript: (callback) => events.on('transcript', callback),
    onAnalysis: (callback) => events.on('analysis', callback),
    onError: (callback) => events.on('error', callback),
    onStatusChange: (callback) => events.on('status_change', callback)
  };
};

// Export configuration
export const PIPELINE_CONFIG = {
  name: 'Speech Analysis Client-Server',
  version: '1.0.0',
  architecture: 'client-server',
  capabilities: {
    webSpeechAPI: true,
    serverAnalysis: true,
    realtimeTranscription: true,
    batchProcessing: true,
    sessionManagement: true
  },
  requirements: {
    browser: ['Web Speech API support'],
    server: ['Analysis server running on configured URL']
  },
  defaultConfig: {
    serverUrl: process.env.SPEECH_SERVER_URL || 'http://localhost:3000/api/analyze',
    language: 'en-US',
    continuous: true,
    interimResults: true,
    sendInterimResults: false,
    batchSize: 5,
    batchTimeout: 2000
  }
};
