/**
 * Speech Analysis Pipeline - Hybrid Implementation
 * Integrates comprehensive speech analysis with the Synopticon architecture
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../core/pipeline.js';
import { checkFeatures, detectRuntime } from './runtime-detector.js';
import { measureAsync } from '../core/performance-monitor.js';
import { 
  Capability, 
  createPerformanceProfile,
  createSpeechAnalysisResult
} from '../core/types.js';
import { createSpeechAnalysisAPI } from '../speech-analysis/index.js';
import { createSpeechAnalysisConfig } from './speech-analysis-config.ts';
import { createSessionManager } from './speech-analysis-session.js';
import { createMetricsTracker } from './speech-analysis-metrics.js';
import { createEventManager } from './speech-analysis-events.js';

// Main speech analysis pipeline factory
export const createSpeechAnalysisPipeline = (config = {}) => {
  const pipelineConfig = createSpeechAnalysisConfig(config);
  
  const state = {
    runtime: detectRuntime(),
    features: checkFeatures(),
    speechAPI: null,
    isInitialized: false,
    isProcessing: false
  };

  // Create components
  const eventManager = createEventManager();
  const metricsTracker = createMetricsTracker();
  let sessionManager = null; // Created after speechAPI is initialized

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
        
        // Create session manager with speech API
        sessionManager = createSessionManager(state.speechAPI, eventManager.callbacks);
        
        // Setup event handlers
        eventManager.setupEventHandlers(state.speechAPI, sessionManager, metricsTracker);
        
        // Initialize the API
        await state.speechAPI.initialize(initConfig);
        
        state.isInitialized = true;
        console.log('✅ Speech analysis pipeline initialized');
        
        // Auto-start if requested
        if (pipelineConfig.autoStart) {
          await sessionManager.startSession();
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
          
        } else if (input === null && sessionManager?.getActiveSession()) {
          // Get current session results
          result = await getCurrentSessionResults();
          
        } else {
          throw new Error('Invalid input: expected text string or null for session results');
        }

        // Update metrics
        const processingTime = performance.now() - startTime;
        metricsTracker.updateMetrics(processingTime, true);

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
            sessionId: sessionManager?.getActiveSession()
          }
        });

        return pipelineResult;

      } catch (error) {
        const processingTime = performance.now() - startTime;
        metricsTracker.updateMetrics(processingTime, false);
        
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
            sessionId: sessionManager?.getActiveSession()
          }
        });
      } finally {
        state.isProcessing = false;
      }
    }, 'speech_analysis_pipeline', 'process');
  };

  // Get current session results
  const getCurrentSessionResults = async () => {
    if (!sessionManager?.getActiveSession()) {
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
        sessionId: sessionManager.getActiveSession(),
        sessionActive: status.components?.streaming || false,
        totalWords: history?.totalWords || 0
      }
    });
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
      activeSession: sessionManager?.getActiveSession(),
      lastProcessingTime: metricsTracker.getMetrics().lastProcessingTime,
      errorCount: metricsTracker.getMetrics().errorCount,
      successRate: metricsTracker.getMetrics().successRate
    };
  };

  // Check if pipeline is initialized
  const isInitialized = () => state.isInitialized;

  // Get performance metrics
  const getPerformanceMetrics = () => {
    if (!sessionManager) return metricsTracker.getMetrics();
    
    // Update metrics with session count
    metricsTracker.setTotalSessions(sessionManager.getTotalSessions());
    
    return metricsTracker.getPerformanceMetrics(
      state.isProcessing,
      sessionManager.getActiveSession(),
      sessionManager.getSessionData()
    );
  };

  // Cleanup pipeline resources
  const cleanup = async () => {
    try {
      // Stop active session
      if (sessionManager?.getActiveSession()) {
        await sessionManager.stopSession();
      }

      // Cleanup speech API
      if (state.speechAPI) {
        await state.speechAPI.cleanup();
        state.speechAPI = null;
      }

      // Reset state
      state.isInitialized = false;
      state.isProcessing = false;
      sessionManager = null;

      console.log('🧹 Speech analysis pipeline cleaned up');

    } catch (error) {
      console.warn('Speech analysis pipeline cleanup error:', error);
    }
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
    startSession: () => sessionManager?.startSession(),
    stopSession: () => sessionManager?.stopSession(),
    getCurrentSessionResults,
    
    // Event handlers
    onTranscription: eventManager.onTranscription,
    onAnalysis: eventManager.onAnalysis,
    onSessionStart: eventManager.onSessionStart,
    onSessionEnd: eventManager.onSessionEnd,
    onError: eventManager.onError,

    // Configuration access
    getConfiguration: () => ({ ...pipelineConfig }),
    updatePrompts: (prompts) => state.speechAPI?.updatePrompts(prompts),
    updateSystemPrompt: (prompt) => state.speechAPI?.updateSystemPrompt(prompt),

    // Direct API access for advanced usage
    getSpeechAPI: () => state.speechAPI,
    
    // Session management
    getActiveSession: () => sessionManager?.getActiveSession(),
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
