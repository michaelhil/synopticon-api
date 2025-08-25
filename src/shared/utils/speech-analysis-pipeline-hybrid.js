/**
 * Speech Analysis Pipeline - Hybrid Implementation
 * Integrates comprehensive speech analysis with the Synopticon architecture
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../core/pipeline.js';
import { detectRuntime, checkFeatures } from './runtime-detector.js';
import { measureAsync } from '../core/performance-monitor.js';
import { 
  Capability, 
  createPerformanceProfile,
  createSpeechAnalysisResult,
  createSpeechEvent
} from '../core/types.js';
import { createSpeechAnalysisAPI } from '../speech-analysis/index.js';

// Pipeline configuration factory
const createSpeechAnalysisConfig = (config = {}) => ({
  // Speech recognition configuration
  language: config.language || 'en-US',
  continuous: config.continuous !== false,
  interimResults: config.interimResults !== false,
  
  // Analysis configuration
  prompts: config.prompts || [
    'Analyse sentiment, show as 5 keywords, nothing else.',
    'Identify most controversial statement and respond with a counterargument.',
    'Extract key themes and topics mentioned.',
    'Assess emotional tone and intensity level.'
  ],
  systemPrompt: config.systemPrompt || 
    'You are a helpful AI assistant analyzing speech from conversations. Always consider both the provided conversation context AND the current speech segment in your analysis. Keep all responses to 25 words or less.',
  
  // LLM backend preferences (JavaScript-only, no Python)
  preferredBackend: config.preferredBackend || 'webllm',
  fallbackBackends: config.fallbackBackends || ['transformers_js', 'tfjs_models', 'mock'],
  
  // Context management
  contextStrategy: config.contextStrategy || 'hybrid',
  maxChunks: config.maxChunks || 10,
  summaryThreshold: config.summaryThreshold || 20,
  
  // Processing options
  autoStart: config.autoStart === true,
  autoAnalyze: config.autoAnalyze !== false,
  enableSync: config.enableSync !== false,
  
  // Performance settings
  maxConcurrency: config.maxConcurrency || 2,
  requestTimeout: config.requestTimeout || 30000,
  
  // Fallback mode
  useFallback: config.useFallback === true,
  mockMode: config.mockMode === true,
  
  // Additional options
  ...config
});

// Main speech analysis pipeline factory
export const createSpeechAnalysisPipeline = (config = {}) => {
  const pipelineConfig = createSpeechAnalysisConfig(config);
  
  const state = {
    runtime: detectRuntime(),
    features: checkFeatures(),
    speechAPI: null,
    isInitialized: false,
    isProcessing: false,
    
    // Performance tracking
    metrics: {
      totalSessions: 0,
      totalTranscriptions: 0,
      totalAnalyses: 0,
      averageLatency: 0,
      successRate: 0,
      errorCount: 0,
      lastProcessingTime: 0
    },
    
    // Current session
    activeSession: null,
    sessionData: null,
    
    // Event handlers
    callbacks: {
      onTranscription: [],
      onAnalysis: [],
      onSessionStart: [],
      onSessionEnd: [],
      onError: []
    }
  };

  // Initialize the speech analysis pipeline
  const initialize = async (options = {}) => {
    if (state.isInitialized) {
      console.log('🎤 Speech analysis pipeline already initialized');
      return true;
    }

    return await measureAsync(async () => {
      try {
        // Merge configuration
        const initConfig = { ...pipelineConfig, ...options };
        
        // Initialize speech analysis API
        state.speechAPI = createSpeechAnalysisAPI(initConfig);
        
        // Setup event handlers
        setupEventHandlers();
        
        // Initialize the API
        await state.speechAPI.initialize(initConfig);
        
        state.isInitialized = true;
        console.log('✅ Speech analysis pipeline initialized');
        
        // Auto-start if requested
        if (pipelineConfig.autoStart) {
          await startSession();
        }
        
        return true;
        
      } catch (error) {
        console.error('❌ Speech analysis pipeline initialization failed:', error);
        throw new Error(`Speech analysis pipeline initialization failed: ${error.message}`);
      }
    }, 'speech_analysis_pipeline', 'initialize');
  };

  // Process method - main pipeline interface
  const process = async (input = null, options = {}) => {
    if (!state.isInitialized) {
      throw new Error('Speech analysis pipeline not initialized');
    }

    return await measureAsync(async () => {
      const startTime = performance.now();
      state.isProcessing = true;

      try {
        // Handle different input types
        let result;

        if (typeof input === 'string') {
          // Process text directly
          result = await state.speechAPI.processText(input, options);
          
        } else if (input && input.audio) {
          // Handle audio input (future enhancement)
          throw new Error('Audio input processing not yet implemented');
          
        } else if (input === null && state.activeSession) {
          // Get current session status/results
          result = await getCurrentSessionResults();
          
        } else {
          throw new Error('Invalid input: expected text string or null for session results');
        }

        // Update metrics
        const processingTime = performance.now() - startTime;
        updateMetrics(processingTime, true);

        // Create standardized pipeline result
        const pipelineResult = createSpeechAnalysisResult({
          timestamp: Date.now(),
          source: 'speech_analysis_pipeline',
          ...(result || {}),
          metadata: {
            ...result?.metadata,
            processingTime,
            pipelineVersion: '1.0.0',
            backend: state.speechAPI?.getStatus()?.configuration?.llmBackend || 'unknown',
            sessionId: state.activeSession
          }
        });

        return pipelineResult;

      } catch (error) {
        const processingTime = performance.now() - startTime;
        updateMetrics(processingTime, false);
        
        console.warn('Speech analysis processing failed:', error);
        
        // Return error result instead of throwing
        return createSpeechAnalysisResult({
          timestamp: Date.now(),
          source: 'speech_analysis_pipeline',
          text: typeof input === 'string' ? input : '',
          analyses: [],
          error: error.message,
          metadata: {
            processingTime,
            error: true,
            sessionId: state.activeSession
          }
        });
      } finally {
        state.isProcessing = false;
        state.metrics.lastProcessingTime = performance.now() - startTime;
      }
    }, 'speech_analysis_pipeline', 'process');
  };

  // Start a speech analysis session
  const startSession = async (sessionId = null) => {
    if (!state.isInitialized) {
      throw new Error('Pipeline not initialized');
    }

    try {
      state.activeSession = await state.speechAPI.startSession(sessionId);
      state.sessionData = {
        startTime: Date.now(),
        transcriptions: [],
        analyses: []
      };
      state.metrics.totalSessions++;
      
      // Notify session start callbacks
      state.callbacks.onSessionStart.forEach(callback => {
        try {
          callback(createSpeechEvent({
            type: 'session_start',
            data: { sessionId: state.activeSession }
          }));
        } catch (error) {
          console.warn('Session start callback error:', error);
        }
      });

      return state.activeSession;

    } catch (error) {
      console.warn('Failed to start speech session:', error);
      throw error;
    }
  };

  // Stop current session
  const stopSession = async () => {
    if (!state.activeSession) {
      console.warn('No active session to stop');
      return;
    }

    try {
      await state.speechAPI.stopSession();
      
      const sessionId = state.activeSession;
      const sessionDuration = Date.now() - (state.sessionData?.startTime || Date.now());
      
      // Notify session end callbacks
      state.callbacks.onSessionEnd.forEach(callback => {
        try {
          callback(createSpeechEvent({
            type: 'session_end',
            data: { 
              sessionId, 
              duration: sessionDuration,
              transcriptions: state.sessionData?.transcriptions?.length || 0,
              analyses: state.sessionData?.analyses?.length || 0
            }
          }));
        } catch (error) {
          console.warn('Session end callback error:', error);
        }
      });

      state.activeSession = null;
      state.sessionData = null;

    } catch (error) {
      console.warn('Failed to stop speech session:', error);
      throw error;
    }
  };

  // Get current session results
  const getCurrentSessionResults = async () => {
    if (!state.activeSession) {
      return createSpeechAnalysisResult({
        timestamp: Date.now(),
        source: 'speech_analysis_pipeline',
        text: '',
        analyses: [],
        metadata: {
          error: 'No active session',
          sessionId: null
        }
      });
    }

    const history = state.speechAPI.getAnalysisHistory();
    const status = state.speechAPI.getStatus();

    return createSpeechAnalysisResult({
      timestamp: Date.now(),
      source: 'speech_analysis_pipeline',
      text: history?.chunks?.map(c => c.text).join(' ') || '',
      analyses: history?.chunks?.flatMap(c => c.analysisResults) || [],
      conversationContext: {
        summary: history?.summary || '',
        totalChunks: history?.totalChunks || 0,
        chunkIndex: history?.chunks?.length || 0
      },
      metadata: {
        sessionId: state.activeSession,
        sessionActive: status.components?.streaming || false,
        totalWords: history?.totalWords || 0
      }
    });
  };

  // Setup event handlers for the speech API
  const setupEventHandlers = () => {
    if (!state.speechAPI) return;

    // Handle transcriptions
    state.speechAPI.onTranscription((event) => {
      if (state.sessionData) {
        state.sessionData.transcriptions.push(event.data.result);
      }
      state.metrics.totalTranscriptions++;
      
      // Forward to pipeline callbacks
      state.callbacks.onTranscription.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Transcription callback error:', error);
        }
      });
    });

    // Handle analyses
    state.speechAPI.onAnalysis((event) => {
      if (state.sessionData) {
        state.sessionData.analyses.push(event.data.result);
      }
      state.metrics.totalAnalyses++;
      
      // Forward to pipeline callbacks
      state.callbacks.onAnalysis.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Analysis callback error:', error);
        }
      });
    });

    // Handle errors
    state.speechAPI.onError((event) => {
      state.metrics.errorCount++;
      
      // Forward to pipeline callbacks
      state.callbacks.onError.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Error callback error:', error);
        }
      });
    });
  };

  // Update performance metrics
  const updateMetrics = (processingTime, success) => {
    const totalProcessed = state.metrics.totalTranscriptions + state.metrics.totalAnalyses;
    
    if (totalProcessed > 0) {
      state.metrics.averageLatency = 
        (state.metrics.averageLatency * (totalProcessed - 1) + processingTime) / totalProcessed;
    }
    
    if (success) {
      const successfulOps = totalProcessed - state.metrics.errorCount;
      state.metrics.successRate = successfulOps / totalProcessed;
    }
  };

  // Get pipeline health status
  const getHealthStatus = () => {
    const apiStatus = state.speechAPI?.getStatus();
    const isHealthy = state.isInitialized && 
                     (apiStatus?.components?.recognition !== false) &&
                     (apiStatus?.components?.analysis !== false);

    return {
      healthy: isHealthy,
      runtime: state.runtime.isBrowser ? 'browser' : 'node',
      backend: apiStatus?.configuration?.llmBackend || 'unknown',
      modelLoaded: apiStatus?.llm?.modelLoaded !== false,
      speechRecognition: apiStatus?.speechRecognition?.available !== false,
      activeSession: state.activeSession,
      lastProcessingTime: state.metrics.lastProcessingTime,
      errorCount: state.metrics.errorCount,
      successRate: state.metrics.successRate
    };
  };

  // Check if pipeline is initialized
  const isInitialized = () => state.isInitialized;

  // Get performance metrics
  const getPerformanceMetrics = () => ({
    ...state.metrics,
    isProcessing: state.isProcessing,
    activeSession: state.activeSession,
    sessionData: state.sessionData ? {
      startTime: state.sessionData.startTime,
      transcriptionCount: state.sessionData.transcriptions.length,
      analysisCount: state.sessionData.analyses.length
    } : null
  });

  // Cleanup pipeline resources
  const cleanup = async () => {
    try {
      // Stop active session
      if (state.activeSession) {
        await stopSession();
      }

      // Cleanup speech API
      if (state.speechAPI) {
        await state.speechAPI.cleanup();
        state.speechAPI = null;
      }

      // Reset state
      state.isInitialized = false;
      state.isProcessing = false;
      state.activeSession = null;
      state.sessionData = null;

      console.log('🧹 Speech analysis pipeline cleaned up');

    } catch (error) {
      console.warn('Speech analysis pipeline cleanup error:', error);
    }
  };

  // Event subscription methods
  const onTranscription = (callback) => subscribeCallback('onTranscription', callback);
  const onAnalysis = (callback) => subscribeCallback('onAnalysis', callback);
  const onSessionStart = (callback) => subscribeCallback('onSessionStart', callback);
  const onSessionEnd = (callback) => subscribeCallback('onSessionEnd', callback);
  const onError = (callback) => subscribeCallback('onError', callback);

  const subscribeCallback = (eventType, callback) => {
    state.callbacks[eventType].push(callback);
    return () => {
      const index = state.callbacks[eventType].indexOf(callback);
      if (index !== -1) state.callbacks[eventType].splice(index, 1);
    };
  };

  // Create standard pipeline interface
  const basePipeline = createPipeline({
    // Standard pipeline interface
    name: 'speech-analysis-hybrid',
    capabilities: [
      Capability.SPEECH_RECOGNITION,
      Capability.SPEECH_ANALYSIS, 
      Capability.CONVERSATION_CONTEXT,
      Capability.MULTI_PROMPT_ANALYSIS,
      Capability.REAL_TIME_TRANSCRIPTION
    ],
    
    // Core methods
    initialize,
    process,
    cleanup,
    getHealthStatus,
    isInitialized,
    getPerformanceMetrics,

    // Performance profile
    performance: createPerformanceProfile({
      fps: 30,
      latency: '200-1000ms',
      modelSize: 'Variable (1-5GB)',
      cpuUsage: 'medium-high',
      memoryUsage: 'high',
      batteryImpact: 'high', // Due to continuous speech recognition and LLM processing
      networkUsage: 'low' // Local processing
    })
  });

  // Extended interface for speech analysis specific features
  return {
    ...basePipeline,
    
    // Speech analysis specific methods
    startSession,
    stopSession,
    getCurrentSessionResults,
    
    // Event handlers
    onTranscription,
    onAnalysis,
    onSessionStart,
    onSessionEnd,
    onError,

    // Configuration access
    getConfiguration: () => ({ ...pipelineConfig }),
    updatePrompts: (prompts) => state.speechAPI?.updatePrompts(prompts),
    updateSystemPrompt: (prompt) => state.speechAPI?.updateSystemPrompt(prompt),

    // Direct API access for advanced usage
    getSpeechAPI: () => state.speechAPI,
    
    // Session management
    getActiveSession: () => state.activeSession,
    getSessionHistory: () => state.speechAPI?.getAnalysisHistory(),
    clearSession: () => state.speechAPI?.clearSession(),
    generateSummary: () => state.speechAPI?.generateSummary(),

    // Pipeline metadata
    version: '1.0.0',
    type: 'speech_analysis_hybrid'
  };
};

// Factory function for pipeline registration
export const createSpeechAnalysisPipelineFactory = () => ({
  name: 'speech-analysis-hybrid',
  description: 'Real-time speech recognition and multi-prompt analysis with conversation context',
  capabilities: [
    Capability.SPEECH_RECOGNITION,
    Capability.SPEECH_ANALYSIS, 
    Capability.CONVERSATION_CONTEXT,
    Capability.MULTI_PROMPT_ANALYSIS,
    Capability.REAL_TIME_TRANSCRIPTION
  ],
  create: createSpeechAnalysisPipeline,
  requiresHardware: false, // Works with software fallbacks
  supportsRealtime: true,
  supportsBrowser: true,
  supportsNode: true, // With fallbacks
  pythonFree: true // No Python dependencies
});

// Export configuration factory for external use
export { createSpeechAnalysisConfig };