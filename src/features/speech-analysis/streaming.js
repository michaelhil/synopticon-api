/**
 * Real-time Speech Analysis Streaming
 * Integrates speech analysis with existing multimodal synchronization
 * Following functional programming patterns with factory functions
 */

import { createDataStream } from '../../core/state/streams.js';
import { createSynchronizationEngine } from '../../core/orchestration/synchronization.js';
import { createSpeechRecognition } from './speech-recognition.js';
import { createAnalysisEngine } from './analysis-engine.js';
import { createContextManager } from './context-manager.js';
import {
  // createSpeechAnalysisResult, // Available but not used
  createSpeechEvent,
  createSpeechPipelineStatus
} from '../../core/configuration/types.ts';

// Streaming configuration defaults
const DEFAULT_STREAM_CONFIG = {
  sampleRate: 30, // Hz
  bufferSize: 1000,
  syncTolerance: 50, // ms
  enableQualityMonitoring: true,
  autoStart: false,
  autoAnalyze: true,
  enableSynchronization: true
};

// Create speech streaming system factory
export const createSpeechStreaming = (config = {}) => {
  const streamConfig = { ...DEFAULT_STREAM_CONFIG, ...config };
  
  const state = {
    // Core components
    speechRecognition: null,
    analysisEngine: null,
    contextManager: null,
    synchronization: null,
    
    // Streaming state
    isInitialized: false,
    isActive: false,
    isListening: false,
    isAnalyzing: false,
    
    // Stream management
    streams: new Map(),
    activeSession: null,
    
    // Configuration
    config: streamConfig,
    
    // Performance metrics
    metrics: {
      sessionsStarted: 0,
      totalTranscriptions: 0,
      totalAnalyses: 0,
      averageLatency: 0,
      uptime: 0,
      lastActivity: null,
      errorCount: 0
    },
    
    startTime: null,

    // Event callbacks
    callbacks: {
      onSystemReady: [],
      onStreamStart: [],
      onStreamEnd: [],
      onTranscription: [],
      onAnalysis: [],
      onError: [],
      onStatusChange: []
    }
  };

  // Initialize the streaming system
  const initialize = async (options = {}) => {
    if (state.isInitialized) {
      console.warn('Speech streaming system already initialized');
      return true;
    }

    console.log('🔄 Initializing speech streaming system...');

    try {
      // Initialize core components
      console.log('🎤 Initializing speech recognition...');
      state.speechRecognition = createSpeechRecognition({
        continuous: true,
        interimResults: true,
        language: options.language || 'en-US'
      });
      await state.speechRecognition.initialize();

      console.log('🤖 Initializing analysis engine...');
      state.analysisEngine = createAnalysisEngine({
        prompts: options.prompts,
        systemPrompt: options.systemPrompt,
        maxConcurrency: 2
      });
      await state.analysisEngine.initialize(options.llmConfig);

      console.log('📝 Initializing context manager...');
      state.contextManager = createContextManager({
        strategy: options.contextStrategy || 'hybrid',
        maxChunks: options.maxChunks || 10,
        summaryThreshold: options.summaryThreshold || 20
      });
      await state.contextManager.initialize(options.llmConfig);

      // Initialize synchronization if enabled
      if (state.config.enableSynchronization && options.enableSync !== false) {
        console.log('🔄 Initializing synchronization engine...');
        state.synchronization = createSynchronizationEngine({
          tolerance: state.config.syncTolerance,
          strategy: 'software_timestamp',
          bufferSize: 100
        });
        setupSynchronizationHandlers();
      }

      // Setup event handlers
      setupEventHandlers();

      // Create default session
      state.activeSession = await createSession('default');

      state.isInitialized = true;
      state.startTime = Date.now();

      console.log('✅ Speech streaming system initialized successfully');

      // Notify system ready
      notifyCallbacks('onSystemReady', createSpeechEvent({
        type: 'system_ready',
        data: { 
          components: ['speech_recognition', 'analysis_engine', 'context_manager'],
          sessionId: state.activeSession
        }
      }));

      return true;

    } catch (error) {
      console.error('Speech streaming system initialization failed:', error);
      throw new Error(`Speech streaming initialization failed: ${error.message}`);
    }
  };

  // Start streaming session
  const startStreaming = async (sessionId = null) => {
    if (!state.isInitialized) {
      throw new Error('System not initialized');
    }

    if (state.isActive) {
      console.warn('Streaming already active');
      return;
    }

    const targetSession = sessionId || state.activeSession;
    console.log(`🎤 Starting speech streaming session: ${targetSession}`);

    try {
      // Start speech recognition
      await state.speechRecognition.startListening();
      
      state.isActive = true;
      state.isListening = true;
      state.metrics.sessionsStarted++;
      state.metrics.lastActivity = Date.now();

      // Start synchronization if available
      if (state.synchronization) {
        // Register speech analysis stream
        const speechStream = createDataStream({
          id: 'speech_analysis',
          type: 'speech',
          sampleRate: state.config.sampleRate
        });
        state.synchronization.addStream('speech_analysis', speechStream);
      }

      console.log('✅ Speech streaming started');

      // Notify stream start
      notifyCallbacks('onStreamStart', createSpeechEvent({
        type: 'stream_start',
        data: { sessionId: targetSession }
      }));

      // Notify status change
      notifyStatusChange();

    } catch (error) {
      state.isActive = false;
      state.isListening = false;
      console.error('Failed to start streaming:', error);
      
      notifyError(new Error(`Failed to start streaming: ${error.message}`));
      throw error;
    }
  };

  // Stop streaming session
  const stopStreaming = async () => {
    if (!state.isActive) {
      console.warn('Streaming not active');
      return;
    }

    console.log('🔇 Stopping speech streaming...');

    try {
      // Stop speech recognition
      if (state.isListening) {
        await state.speechRecognition.stopListening();
        state.isListening = false;
      }

      // Stop synchronization
      if (state.synchronization) {
        state.synchronization.removeStream('speech_analysis');
      }

      state.isActive = false;
      console.log('✅ Speech streaming stopped');

      // Notify stream end
      notifyCallbacks('onStreamEnd', createSpeechEvent({
        type: 'stream_end',
        data: { sessionId: state.activeSession }
      }));

      // Notify status change
      notifyStatusChange();

    } catch (error) {
      console.error('Error stopping streaming:', error);
      notifyError(new Error(`Error stopping streaming: ${error.message}`));
    }
  };

  // Create new session
  const createSession = async (sessionId) => {
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Create context for this session
    const _contextId = await state.contextManager.createContext(sessionId);
    
    console.log(`📋 Created streaming session: ${sessionId}`);
    return sessionId;
  };

  // Switch to different session
  const switchSession = async (sessionId) => {
    const wasActive = state.isActive;
    
    if (wasActive) {
      await stopStreaming();
    }

    state.activeSession = sessionId;
    await state.contextManager.switchContext(sessionId);

    if (wasActive) {
      await startStreaming(sessionId);
    }

    console.log(`🔄 Switched to session: ${sessionId}`);
    return true;
  };

  // Get system status
  const getStatus = () => {
    const uptime = state.startTime ? Date.now() - state.startTime : 0;
    
    return createSpeechPipelineStatus({
      isInitialized: state.isInitialized,
      isListening: state.isListening,
      isProcessing: state.isAnalyzing,
      
      speechRecognition: {
        available: !!state.speechRecognition,
        isActive: state.isListening,
        ...(state.speechRecognition ? state.speechRecognition.getStatus() : {})
      },
      
      llm: state.analysisEngine ? {
        backend: state.analysisEngine.getStatus().llmStatus?.activeBackend,
        modelLoaded: state.analysisEngine.getStatus().llmStatus?.isReady,
        isReady: state.analysisEngine.isInitialized()
      } : {},
      
      context: state.contextManager ? {
        activeSession: state.activeSession,
        chunkCount: state.contextManager.getContextData()?.chunks?.length || 0,
        lastActivity: state.metrics.lastActivity
      } : {},
      
      metrics: {
        ...state.metrics,
        uptime
      },
      
      health: {
        overall: calculateOverallHealth(),
        speechRecognition: state.speechRecognition?.isInitialized() ? 'healthy' : 'unhealthy',
        llmBackend: state.analysisEngine?.isInitialized() ? 'healthy' : 'unhealthy',
        performance: state.metrics.averageLatency < 1000 ? 'healthy' : 'degraded'
      }
    });
  };

  // Cleanup resources
  const cleanup = async () => {
    console.log('🧹 Cleaning up speech streaming system...');

    if (state.isActive) {
      await stopStreaming();
    }

    // Cleanup components
    if (state.speechRecognition) {
      await state.speechRecognition.cleanup();
      state.speechRecognition = null;
    }

    if (state.analysisEngine) {
      await state.analysisEngine.cleanup();
      state.analysisEngine = null;
    }

    if (state.contextManager) {
      await state.contextManager.cleanup();
      state.contextManager = null;
    }

    if (state.synchronization) {
      state.synchronization.stop();
      state.synchronization = null;
    }

    // Clear state
    state.streams.clear();
    state.isInitialized = false;
    state.activeSession = null;

    console.log('✅ Speech streaming system cleanup complete');
  };

  // Private helper functions
  const setupEventHandlers = () => {
    if (!state.speechRecognition || !state.analysisEngine) return;

    // Handle speech recognition results
    state.speechRecognition.onResult(async (_event, result) => {
      state.metrics.totalTranscriptions++;
      state.metrics.lastActivity = Date.now();

      console.log(`🎤 Final transcription: "${result.transcript}"`);

      // Notify transcription
      notifyCallbacks('onTranscription', createSpeechEvent({
        type: 'transcription',
        data: { result }
      }));

      // Add to context and analyze if auto-analyze is enabled
      if (state.config.autoAnalyze && result.transcript.trim()) {
        await processTranscription(result.transcript, result);
      }
    });

    state.speechRecognition.onInterimResult((_event, result) => {
      // Handle interim results - could be used for real-time feedback
      console.log(`🎤 Interim: "${result.transcript}"`);
    });

    state.speechRecognition.onError((error) => {
      state.metrics.errorCount++;
      notifyError(new Error(`Speech recognition error: ${error.data?.error || error.message}`));
    });

    // Handle analysis results
    state.analysisEngine.onAnalysisComplete((event) => {
      console.log(`🤖 Analysis complete: ${event.data.result.analyses.length} results`);
      
      // Notify analysis complete
      notifyCallbacks('onAnalysis', createSpeechEvent({
        type: 'analysis_complete',
        data: { result: event.data.result }
      }));
    });

    state.analysisEngine.onAnalysisError((error) => {
      state.metrics.errorCount++;
      notifyError(new Error(`Analysis error: ${error.data?.error || error.message}`));
    });
  };

  const setupSynchronizationHandlers = () => {
    if (!state.synchronization) return;

    state.synchronization.onSync((syncedStreams) => {
      // Handle synchronized multimodal data
      console.log(`🔄 Synchronized data: ${syncedStreams.size} streams`);
    });
  };

  const processTranscription = async (text, originalResult) => {
    try {
      state.isAnalyzing = true;
      
      // Add to context
      await state.contextManager.addChunk(text, state.activeSession, {
        confidence: originalResult.confidence,
        duration: originalResult.audioLength || 0
      });

      // Get context for analysis
      const context = state.contextManager.getContext(state.activeSession);

      // Analyze with context
      const startTime = performance.now();
      const _analysisResult = await state.analysisEngine.analyzeText(text, context, {
        conversationContext: {
          chunkIndex: state.contextManager.getContextData(state.activeSession)?.totalChunks || 0,
          totalChunks: state.contextManager.getContextData(state.activeSession)?.totalChunks || 1
        }
      });

      // Update metrics
      const latency = performance.now() - startTime;
      state.metrics.totalAnalyses++;
      state.metrics.averageLatency = 
        (state.metrics.averageLatency * (state.metrics.totalAnalyses - 1) + latency) / 
        state.metrics.totalAnalyses;

      console.log(`✅ Processed transcription in ${latency.toFixed(2)}ms`);

    } catch (error) {
      console.error('Error processing transcription:', error);
      notifyError(error);
    } finally {
      state.isAnalyzing = false;
      notifyStatusChange();
    }
  };

  const calculateOverallHealth = () => {
    if (!state.isInitialized) return 'uninitialized';
    
    const components = [
      state.speechRecognition?.isInitialized(),
      state.analysisEngine?.isInitialized(),
      state.contextManager?.isInitialized()
    ];
    
    const healthyComponents = components.filter(Boolean).length;
    const totalComponents = components.length;
    
    if (healthyComponents === totalComponents) return 'healthy';
    if (healthyComponents > totalComponents / 2) return 'degraded';
    return 'unhealthy';
  };

  const notifyStatusChange = () => {
    const status = getStatus();
    notifyCallbacks('onStatusChange', createSpeechEvent({
      type: 'status_change',
      data: { status }
    }));
  };

  const notifyError = (error) => {
    notifyCallbacks('onError', createSpeechEvent({
      type: 'error',
      data: { error: error.message },
      severity: 'error'
    }));
  };

  // Event subscription methods
  const onSystemReady = (callback) => subscribeCallback('onSystemReady', callback);
  const onStreamStart = (callback) => subscribeCallback('onStreamStart', callback);
  const onStreamEnd = (callback) => subscribeCallback('onStreamEnd', callback);
  const onTranscription = (callback) => subscribeCallback('onTranscription', callback);
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

  const notifyCallbacks = (eventType, event) => {
    state.callbacks[eventType].forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.warn(`Speech streaming ${eventType} callback error:`, error);
      }
    });
  };

  return {
    // Core functionality
    initialize,
    startStreaming,
    stopStreaming,
    cleanup,

    // Session management
    createSession,
    switchSession,
    getActiveSession: () => state.activeSession,

    // Status and configuration
    getStatus,
    isInitialized: () => state.isInitialized,
    isActive: () => state.isActive,
    isListening: () => state.isListening,

    // Component access
    getSpeechRecognition: () => state.speechRecognition,
    getAnalysisEngine: () => state.analysisEngine,
    getContextManager: () => state.contextManager,
    getSynchronization: () => state.synchronization,

    // Event handlers
    onSystemReady,
    onStreamStart,
    onStreamEnd,
    onTranscription,
    onAnalysis,
    onError,
    onStatusChange,

    // Configuration updates
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
    },

    // Metrics and monitoring
    getMetrics: () => ({ ...state.metrics }),
    resetMetrics: () => {
      state.metrics = {
        sessionsStarted: 0,
        totalTranscriptions: 0,
        totalAnalyses: 0,
        averageLatency: 0,
        uptime: 0,
        lastActivity: null,
        errorCount: 0
      };
    },

    // Advanced features
    addExternalStream: (streamId, stream) => {
      if (state.synchronization) {
        state.synchronization.addStream(streamId, stream);
      }
    },

    // Manual processing (for testing/development)
    processText: async (text, options = {}) => {
      if (!state.isInitialized) {
        throw new Error('System not initialized');
      }
      return await processTranscription(text, { 
        confidence: 0.95, 
        ...options 
      });
    }
  };
};

// Export streaming configuration
export { DEFAULT_STREAM_CONFIG };

// Export default factory
// Export default factory (already exported above as const)