/**
 * Speech Analysis Module - Main API Interface
 * Unified interface for all speech analysis functionality
 * Following functional programming patterns with factory functions
 */

// Import core components
import { createSpeechRecognition } from './speech-recognition.js';
import { createLLMClient } from './llm-client.js';
import { createAnalysisEngine, validatePrompts, suggestPrompts } from './analysis-engine.js';
import { createContextManager, analyzeContext, CONTEXT_STRATEGIES } from './context-manager.js';
import { createSpeechStreaming, DEFAULT_STREAM_CONFIG } from './streaming.js';
import { createAudioQualityAnalyzer } from './audio-quality.js';
import { createConversationAnalytics } from './conversation-analytics.js';

// Import new audio analysis components
import { createConversationAnalytics as createConversationFlow } from '../audio/conversation-analytics.js';

// Import types
import {
  createSpeechRecognitionResult,
  createSpeechAnalysisResult,
  createConversationContext,
  createLLMConfig,
  createSpeechPipelineStatus,
  createSpeechEvent
} from '../core/types.js';

// Main speech analysis API factory
export const createSpeechAnalysisAPI = (config = {}) => {
  const state = {
    streamingSystem: null,
    audioQualityAnalyzer: null,
    conversationAnalytics: null,
    conversationFlow: null,
    isInitialized: false,
    configuration: {
      language: config.language || 'en-US',
      continuous: config.continuous !== false,
      interimResults: config.interimResults !== false,
      autoAnalyze: config.autoAnalyze !== false,
      enableSync: config.enableSync !== false,
      
      // LLM configuration
      llmConfig: {
        preferredBackend: config.preferredBackend || 'webllm',
        fallbackBackends: config.fallbackBackends || ['transformers_js', 'mock'],
        model: config.model || 'Llama-3.2-1B-Instruct-q4f32_1',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 100,
        ...config.llmConfig
      },
      
      // Analysis configuration
      analysisConfig: {
        prompts: config.prompts || [
          'Analyse sentiment, show as 5 keywords, nothing else.',
          'Identify most controversial statement and respond with a counterargument.'
        ],
        systemPrompt: config.systemPrompt || 
          'You are a helpful AI assistant analyzing speech from conversations. Keep responses to 25 words or less.',
        maxConcurrency: config.maxConcurrency || 3,
        ...config.analysisConfig
      },
      
      // Context configuration
      contextConfig: {
        strategy: config.contextStrategy || 'hybrid',
        maxChunks: config.maxChunks || 10,
        summaryThreshold: config.summaryThreshold || 20,
        ...config.contextConfig
      },
      
      // Streaming configuration
      streamConfig: {
        ...DEFAULT_STREAM_CONFIG,
        ...config.streamConfig
      },
      
      // Audio quality configuration
      audioQualityConfig: {
        enabled: config.enableAudioQuality !== false,
        fftSize: config.fftSize || 2048,
        smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
        ...config.audioQualityConfig
      },
      
      // Conversation analytics configuration
      analyticsConfig: {
        enabled: config.enableAnalytics !== false,
        trackSentiment: config.trackSentiment !== false,
        trackTopics: config.trackTopics !== false,
        trackSpeakingPatterns: config.trackSpeakingPatterns !== false,
        ...config.analyticsConfig
      },
      
      // Conversation flow configuration
      flowConfig: {
        enabled: config.enableConversationFlow !== false,
        minSilenceDuration: config.minSilenceDuration || 0.5,
        maxSilenceDuration: config.maxSilenceDuration || 3.0,
        interruptionThreshold: config.interruptionThreshold || 0.2,
        ...config.flowConfig
      }
    },
    
    // Event callbacks
    callbacks: {
      onReady: [],
      onTranscription: [],
      onAnalysis: [],
      onError: [],
      onStatusChange: [],
      onQualityUpdate: [],
      onAnalyticsUpdate: []
    }
  };

  // Initialize the speech analysis system
  const initialize = async (options = {}) => {
    if (state.isInitialized) {
      return true;
    }

    try {
      // Merge options with existing configuration
      const mergedConfig = {
        ...state.configuration,
        ...options,
        llmConfig: { ...state.configuration.llmConfig, ...options.llmConfig },
        analysisConfig: { ...state.configuration.analysisConfig, ...options.analysisConfig },
        contextConfig: { ...state.configuration.contextConfig, ...options.contextConfig },
        streamConfig: { ...state.configuration.streamConfig, ...options.streamConfig }
      };

      // Create streaming system
      state.streamingSystem = createSpeechStreaming(mergedConfig.streamConfig);
      
      // Initialize audio quality analyzer if enabled
      if (mergedConfig.audioQualityConfig.enabled) {
        state.audioQualityAnalyzer = createAudioQualityAnalyzer(mergedConfig.audioQualityConfig);
        await state.audioQualityAnalyzer.initialize();
      }
      
      // Initialize conversation analytics if enabled
      if (mergedConfig.analyticsConfig.enabled) {
        state.conversationAnalytics = createConversationAnalytics(mergedConfig.analyticsConfig);
      }
      
      // Initialize conversation flow analysis if enabled
      if (mergedConfig.flowConfig.enabled) {
        state.conversationFlow = createConversationFlow(mergedConfig.flowConfig);
      }
      
      // Initialize with merged configuration
      await state.streamingSystem.initialize({
        language: mergedConfig.language,
        llmConfig: mergedConfig.llmConfig,
        prompts: mergedConfig.analysisConfig.prompts,
        systemPrompt: mergedConfig.analysisConfig.systemPrompt,
        contextStrategy: mergedConfig.contextConfig.strategy,
        maxChunks: mergedConfig.contextConfig.maxChunks,
        summaryThreshold: mergedConfig.contextConfig.summaryThreshold,
        enableSync: mergedConfig.enableSync
      });

      // Setup event forwarding
      setupEventForwarding();
      setupAudioQualityEvents();
      setupAnalyticsEvents();

      state.isInitialized = true;

      // Notify ready callbacks
      state.callbacks.onReady.forEach(callback => {
        try {
          const components = ['streaming', 'recognition', 'analysis', 'context'];
          if (state.audioQualityAnalyzer) components.push('audio_quality');
          if (state.conversationAnalytics) components.push('analytics');
          if (state.conversationFlow) components.push('conversation_flow');
          
          callback({
            api: 'speech_analysis',
            components,
            configuration: mergedConfig
          });
        } catch (error) {
          console.warn('Ready callback error:', error);
        }
      });

      return true;

    } catch (error) {
      console.error('Speech Analysis API initialization failed:', error);
      throw new Error(`Speech Analysis API initialization failed: ${error.message}`);
    }
  };

  // Start speech analysis session
  const startSession = async (sessionId = null) => {
    if (!state.isInitialized) {
      throw new Error('Speech Analysis API not initialized');
    }

    const targetSessionId = sessionId || await state.streamingSystem.createSession();
    await state.streamingSystem.startStreaming(targetSessionId);
    
    // Start audio quality analysis if available
    if (state.audioQualityAnalyzer) {
      try {
        state.audioQualityAnalyzer.startAnalysis();
      } catch (error) {
        console.warn('Audio quality analysis failed to start:', error);
      }
    }
    
    // Start conversation analytics if available
    if (state.conversationAnalytics) {
      state.conversationAnalytics.initialize();
      state.conversationAnalytics.startAnalysis();
    }
    
    // Start conversation flow analysis if available
    if (state.conversationFlow) {
      // Flow analysis starts automatically with speaker data
    }
    return targetSessionId;
  };

  // Stop current session
  const stopSession = async () => {
    if (!state.isInitialized || !state.streamingSystem) {
      return;
    }

    // Stop audio quality analysis
    if (state.audioQualityAnalyzer) {
      state.audioQualityAnalyzer.stopAnalysis();
    }
    
    // Stop conversation analytics
    if (state.conversationAnalytics) {
      state.conversationAnalytics.stopAnalysis();
    }
    
    // Stop conversation flow analysis
    if (state.conversationFlow) {
      state.conversationFlow.reset();
    }

    await state.streamingSystem.stopStreaming();
  };

  // Process text manually (without speech recognition)
  const processText = async (text, options = {}) => {
    if (!state.isInitialized) {
      throw new Error('Speech Analysis API not initialized');
    }

    if (!text || !text.trim()) {
      throw new Error('No text provided for processing');
    }
    
    const result = await state.streamingSystem.processText(text, {
      confidence: 0.95,
      sessionId: options.sessionId,
      ...options
    });

    return result;
  };

  // Update analysis prompts
  const updatePrompts = (newPrompts) => {
    const validation = validatePrompts(newPrompts);
    if (!validation.valid) {
      throw new Error(`Invalid prompts: ${validation.error}`);
    }

    const analysisEngine = state.streamingSystem?.getAnalysisEngine();
    if (analysisEngine) {
      analysisEngine.updatePrompts(newPrompts);
      state.configuration.analysisConfig.prompts = [...newPrompts];
      return true;
    }

    throw new Error('Analysis engine not available');
  };

  // Update system prompt
  const updateSystemPrompt = (newSystemPrompt) => {
    if (!newSystemPrompt || !newSystemPrompt.trim()) {
      throw new Error('System prompt cannot be empty');
    }

    const analysisEngine = state.streamingSystem?.getAnalysisEngine();
    if (analysisEngine) {
      analysisEngine.updateSystemPrompt(newSystemPrompt);
      state.configuration.analysisConfig.systemPrompt = newSystemPrompt.trim();
      return true;
    }

    throw new Error('Analysis engine not available');
  };

  // Get comprehensive status
  const getStatus = () => {
    if (!state.isInitialized || !state.streamingSystem) {
      return {
        initialized: false,
        components: {
          streaming: false,
          recognition: false,
          analysis: false,
          context: false
        }
      };
    }

    const streamStatus = state.streamingSystem.getStatus();
    
    return {
      initialized: true,
      ...streamStatus,
      configuration: {
        language: state.configuration.language,
        promptCount: state.configuration.analysisConfig.prompts.length,
        contextStrategy: state.configuration.contextConfig.strategy,
        llmBackend: streamStatus.llm?.backend || 'unknown'
      },
      components: {
        streaming: state.streamingSystem.isActive(),
        recognition: streamStatus.speechRecognition?.isActive || false,
        analysis: state.streamingSystem.getAnalysisEngine()?.isInitialized() || false,
        context: state.streamingSystem.getContextManager()?.isInitialized() || false,
        audioQuality: state.audioQualityAnalyzer?.isAnalyzing() || false,
        analytics: state.conversationAnalytics?.isAnalyzing() || false,
        conversationFlow: !!state.conversationFlow
      }
    };
  };

  // Get current configuration
  const getConfiguration = () => ({
    ...state.configuration,
    // Deep copy arrays and objects
    analysisConfig: {
      ...state.configuration.analysisConfig,
      prompts: [...state.configuration.analysisConfig.prompts]
    },
    contextConfig: { ...state.configuration.contextConfig },
    llmConfig: { ...state.configuration.llmConfig },
    streamConfig: { ...state.configuration.streamConfig }
  });

  // Get analysis history for current session
  const getAnalysisHistory = () => {
    const contextManager = state.streamingSystem?.getContextManager();
    if (!contextManager) {
      throw new Error('Context manager not available');
    }

    const contextData = contextManager.getContextData();
    return contextData ? {
      sessionId: contextData.sessionId,
      chunks: contextData.chunks.map(chunk => ({
        chunkId: chunk.chunkId,
        text: chunk.text,
        timestamp: chunk.timestamp,
        confidence: chunk.confidence,
        analysisResults: chunk.analysisResults
      })),
      summary: contextData.summary,
      totalChunks: contextData.totalChunks,
      totalWords: contextData.totalWords
    } : null;
  };

  // Clear current session data
  const clearSession = () => {
    const contextManager = state.streamingSystem?.getContextManager();
    if (!contextManager) {
      throw new Error('Context manager not available');
    }

    const sessionId = state.streamingSystem.getActiveSession();
    contextManager.clearContext(sessionId);
    return true;
  };

  // Generate summary of current conversation
  const generateSummary = async () => {
    const contextManager = state.streamingSystem?.getContextManager();
    if (!contextManager) {
      throw new Error('Context manager not available');
    }

    const sessionId = state.streamingSystem.getActiveSession();
    const summary = await contextManager.generateSummary(sessionId);
    
    return summary;
  };

  // Export conversation data in various formats
  const exportConversationData = (format = 'json', options = {}) => {
    if (!state.isInitialized) {
      throw new Error('Speech Analysis API not initialized');
    }

    const history = getAnalysisHistory();
    const audioQualityStats = state.audioQualityAnalyzer?.getQualityStats();
    const analyticsMetrics = state.conversationAnalytics?.getMetrics();
    const analyticsReport = state.conversationAnalytics?.generateReport();
    const conversationFlowSummary = state.conversationFlow?.getConversationSummary();

    const exportData = {
      exportMetadata: {
        timestamp: new Date().toISOString(),
        sessionId: history?.sessionId || null,
        format,
        version: '1.0.0'
      },
      conversation: {
        summary: history?.summary || '',
        totalChunks: history?.totalChunks || 0,
        totalWords: history?.totalWords || 0,
        transcriptions: history?.chunks?.map(chunk => ({
          timestamp: chunk.timestamp,
          text: chunk.text,
          confidence: chunk.confidence,
          chunkId: chunk.chunkId
        })) || [],
        analyses: history?.chunks?.flatMap(chunk => 
          chunk.analysisResults?.map(result => ({
            timestamp: chunk.timestamp,
            prompt: result.prompt,
            response: result.response,
            chunkId: chunk.chunkId
          })) || []
        ) || []
      },
      audioQuality: audioQualityStats ? {
        current: audioQualityStats.current,
        average: audioQualityStats.average,
        trend: audioQualityStats.trend,
        recommendations: audioQualityStats.recommendations
      } : null,
      analytics: {
        metrics: analyticsMetrics,
        report: analyticsReport
      },
      conversationFlow: conversationFlowSummary ? {
        summary: conversationFlowSummary,
        quality: conversationFlowSummary.overallQuality,
        patterns: conversationFlowSummary.detectedPatterns
      } : null
    };

    switch (format.toLowerCase()) {
      case 'json':
        return {
          data: JSON.stringify(exportData, null, options.pretty ? 2 : 0),
          filename: `conversation_export_${Date.now()}.json`,
          mimeType: 'application/json'
        };

      case 'csv':
        return exportToCSV(exportData, options);

      case 'txt':
        return exportToText(exportData, options);

      case 'md':
      case 'markdown':
        return exportToMarkdown(exportData, options);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  };

  // Export to CSV format
  const exportToCSV = (data, options = {}) => {
    const headers = ['Timestamp', 'Type', 'Content', 'Confidence', 'ChunkId'];
    const rows = [headers.join(',')];

    // Add transcriptions
    data.conversation.transcriptions.forEach(t => {
      const row = [
        t.timestamp,
        'transcription',
        `"${t.text.replace(/"/g, '""')}"`,
        t.confidence || '',
        t.chunkId || ''
      ];
      rows.push(row.join(','));
    });

    // Add analyses
    data.conversation.analyses.forEach(a => {
      const row = [
        a.timestamp,
        'analysis',
        `"${a.response.replace(/"/g, '""')}"`,
        '',
        a.chunkId || ''
      ];
      rows.push(row.join(','));
    });

    return {
      data: rows.join('\n'),
      filename: `conversation_export_${Date.now()}.csv`,
      mimeType: 'text/csv'
    };
  };

  // Export to plain text format
  const exportToText = (data, options = {}) => {
    const lines = [];
    
    lines.push(`Conversation Export - ${new Date(data.exportMetadata.timestamp).toLocaleString()}`);
    lines.push(`Session ID: ${data.exportMetadata.sessionId || 'N/A'}`);
    lines.push(`Total Chunks: ${data.conversation.totalChunks}`);
    lines.push(`Total Words: ${data.conversation.totalWords}`);
    lines.push('');

    if (data.conversation.summary) {
      lines.push('SUMMARY');
      lines.push('=' .repeat(50));
      lines.push(data.conversation.summary);
      lines.push('');
    }

    lines.push('TRANSCRIPTIONS');
    lines.push('=' .repeat(50));
    data.conversation.transcriptions.forEach(t => {
      const date = new Date(t.timestamp).toLocaleString();
      lines.push(`[${date}] ${t.text}`);
      if (t.confidence) {
        lines.push(`  Confidence: ${t.confidence}`);
      }
      lines.push('');
    });

    if (data.conversation.analyses.length > 0) {
      lines.push('ANALYSES');
      lines.push('=' .repeat(50));
      data.conversation.analyses.forEach(a => {
        const date = new Date(a.timestamp).toLocaleString();
        lines.push(`[${date}] ${a.prompt}`);
        lines.push(`Response: ${a.response}`);
        lines.push('');
      });
    }

    if (data.audioQuality) {
      lines.push('AUDIO QUALITY');
      lines.push('=' .repeat(50));
      lines.push(`Current Quality: ${data.audioQuality.current?.quality || 'N/A'}`);
      lines.push(`Average SNR: ${data.audioQuality.average?.signalToNoise?.toFixed(2) || 'N/A'}`);
      lines.push(`Trend: ${data.audioQuality.trend || 'N/A'}`);
      if (data.audioQuality.recommendations?.length > 0) {
        lines.push('Recommendations:');
        data.audioQuality.recommendations.forEach(rec => {
          lines.push(`  - ${rec}`);
        });
      }
      lines.push('');
    }

    if (data.analytics?.report) {
      lines.push('ANALYTICS REPORT');
      lines.push('=' .repeat(50));
      lines.push(data.analytics.report);
    }

    return {
      data: lines.join('\n'),
      filename: `conversation_export_${Date.now()}.txt`,
      mimeType: 'text/plain'
    };
  };

  // Export to Markdown format
  const exportToMarkdown = (data, options = {}) => {
    const lines = [];
    
    lines.push(`# Conversation Export`);
    lines.push(`**Date:** ${new Date(data.exportMetadata.timestamp).toLocaleString()}`);
    lines.push(`**Session ID:** ${data.exportMetadata.sessionId || 'N/A'}`);
    lines.push(`**Total Chunks:** ${data.conversation.totalChunks}`);
    lines.push(`**Total Words:** ${data.conversation.totalWords}`);
    lines.push('');

    if (data.conversation.summary) {
      lines.push('## Summary');
      lines.push(data.conversation.summary);
      lines.push('');
    }

    lines.push('## Transcriptions');
    data.conversation.transcriptions.forEach(t => {
      const date = new Date(t.timestamp).toLocaleString();
      lines.push(`### ${date}`);
      lines.push(t.text);
      if (t.confidence) {
        lines.push(`*Confidence: ${t.confidence}*`);
      }
      lines.push('');
    });

    if (data.conversation.analyses.length > 0) {
      lines.push('## Analyses');
      data.conversation.analyses.forEach(a => {
        const date = new Date(a.timestamp).toLocaleString();
        lines.push(`### ${date}`);
        lines.push(`**Prompt:** ${a.prompt}`);
        lines.push(`**Response:** ${a.response}`);
        lines.push('');
      });
    }

    if (data.audioQuality) {
      lines.push('## Audio Quality');
      lines.push(`- **Current Quality:** ${data.audioQuality.current?.quality || 'N/A'}`);
      lines.push(`- **Average SNR:** ${data.audioQuality.average?.signalToNoise?.toFixed(2) || 'N/A'}`);
      lines.push(`- **Trend:** ${data.audioQuality.trend || 'N/A'}`);
      if (data.audioQuality.recommendations?.length > 0) {
        lines.push('- **Recommendations:**');
        data.audioQuality.recommendations.forEach(rec => {
          lines.push(`  - ${rec}`);
        });
      }
      lines.push('');
    }

    if (data.analytics?.report) {
      lines.push('## Analytics Report');
      lines.push('```');
      lines.push(data.analytics.report);
      lines.push('```');
    }

    return {
      data: lines.join('\n'),
      filename: `conversation_export_${Date.now()}.md`,
      mimeType: 'text/markdown'
    };
  };

  // Cleanup resources
  const cleanup = async () => {
    if (state.audioQualityAnalyzer) {
      await state.audioQualityAnalyzer.cleanup();
      state.audioQualityAnalyzer = null;
    }
    
    if (state.conversationAnalytics) {
      state.conversationAnalytics.cleanup();
      state.conversationAnalytics = null;
    }
    
    if (state.conversationFlow) {
      state.conversationFlow.reset();
      state.conversationFlow = null;
    }

    // Clean up analytics interval
    if (state.analyticsUpdateInterval) {
      clearInterval(state.analyticsUpdateInterval);
      state.analyticsUpdateInterval = null;
    }

    if (state.streamingSystem) {
      await state.streamingSystem.cleanup();
      state.streamingSystem = null;
    }

    state.isInitialized = false;
  };

  // Setup event forwarding from streaming system
  const setupEventForwarding = () => {
    if (!state.streamingSystem) return;

    // Forward transcription events
    state.streamingSystem.onTranscription((event) => {
      state.callbacks.onTranscription.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Transcription callback error:', error);
        }
      });
    });

    // Forward analysis events
    state.streamingSystem.onAnalysis((event) => {
      state.callbacks.onAnalysis.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Analysis callback error:', error);
        }
      });
    });

    // Forward error events
    state.streamingSystem.onError((event) => {
      state.callbacks.onError.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Error callback error:', error);
        }
      });
    });

    // Forward status change events
    state.streamingSystem.onStatusChange((event) => {
      state.callbacks.onStatusChange.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Status change callback error:', error);
        }
      });
    });
  };

  // Setup audio quality event forwarding
  const setupAudioQualityEvents = () => {
    if (!state.audioQualityAnalyzer) return;

    state.audioQualityAnalyzer.onQualityUpdate((event) => {
      state.callbacks.onQualityUpdate.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.warn('Quality update callback error:', error);
        }
      });
    });

    state.audioQualityAnalyzer.onError((event) => {
      state.callbacks.onError.forEach(callback => {
        try {
          callback({
            ...event,
            source: 'audio_quality'
          });
        } catch (error) {
          console.warn('Audio quality error callback error:', error);
        }
      });
    });
  };

  // Setup conversation analytics event forwarding
  const setupAnalyticsEvents = () => {
    if (!state.conversationAnalytics) return;

    // Forward transcription events to analytics
    state.callbacks.onTranscription.push((event) => {
      if (state.conversationAnalytics && event.data?.result) {
        try {
          state.conversationAnalytics.addChunk(
            { 
              text: event.data.result.transcript || event.data.result.text,
              timestamp: event.data.result.timestamp || Date.now()
            },
            event.data.result.participantId || 'default'
          );
        } catch (error) {
          console.warn('Analytics transcription processing error:', error);
        }
      }
    });

    // Forward analysis events to analytics
    state.callbacks.onAnalysis.push((event) => {
      if (state.conversationAnalytics && event.data?.result) {
        try {
          state.conversationAnalytics.addChunk(
            { 
              text: event.data.result.text || '',
              timestamp: event.data.result.timestamp || Date.now()
            },
            'default',
            [event.data.result]
          );
        } catch (error) {
          console.warn('Analytics analysis processing error:', error);
        }
      }
    });

    // Setup analytics update notifications
    const analyticsUpdateInterval = setInterval(() => {
      if (state.conversationAnalytics && state.conversationAnalytics.isAnalyzing()) {
        try {
          const metrics = state.conversationAnalytics.getMetrics();
          state.callbacks.onAnalyticsUpdate.forEach(callback => {
            try {
              callback({
                type: 'analytics_update',
                data: metrics,
                timestamp: Date.now()
              });
            } catch (error) {
              console.warn('Analytics update callback error:', error);
            }
          });
        } catch (error) {
          console.warn('Analytics metrics error:', error);
        }
      }
    }, 5000); // Update every 5 seconds

    // Store interval for cleanup
    state.analyticsUpdateInterval = analyticsUpdateInterval;
  };

  // Event subscription methods
  const onReady = (callback) => subscribeCallback('onReady', callback);
  const onTranscription = (callback) => subscribeCallback('onTranscription', callback);
  const onAnalysis = (callback) => subscribeCallback('onAnalysis', callback);
  const onError = (callback) => subscribeCallback('onError', callback);
  const onStatusChange = (callback) => subscribeCallback('onStatusChange', callback);
  const onQualityUpdate = (callback) => subscribeCallback('onQualityUpdate', callback);
  const onAnalyticsUpdate = (callback) => subscribeCallback('onAnalyticsUpdate', callback);

  // Helper function for event subscription
  const subscribeCallback = (eventType, callback) => {
    state.callbacks[eventType].push(callback);
    return () => {
      const index = state.callbacks[eventType].indexOf(callback);
      if (index !== -1) state.callbacks[eventType].splice(index, 1);
    };
  };

  return {
    // Core functionality
    initialize,
    startSession,
    stopSession,
    processText,
    cleanup,

    // Configuration
    updatePrompts,
    updateSystemPrompt,
    getConfiguration,

    // Session management
    getAnalysisHistory,
    clearSession,
    generateSummary,
    
    // Export functionality
    exportConversationData,

    // Status and monitoring
    getStatus,
    isInitialized: () => state.isInitialized,
    isActive: () => state.streamingSystem?.isActive() || false,

    // Event handlers
    onReady,
    onTranscription,
    onAnalysis,
    onError,
    onStatusChange,
    onQualityUpdate,
    onAnalyticsUpdate,

    // Advanced access to components
    getStreamingSystem: () => state.streamingSystem,
    getSpeechRecognition: () => state.streamingSystem?.getSpeechRecognition(),
    getAnalysisEngine: () => state.streamingSystem?.getAnalysisEngine(),
    getContextManager: () => state.streamingSystem?.getContextManager(),
    getAudioQualityAnalyzer: () => state.audioQualityAnalyzer,
    getConversationAnalytics: () => state.conversationAnalytics,
    getConversationFlow: () => state.conversationFlow,
    
    // Audio quality methods
    getAudioQualityStats: () => state.audioQualityAnalyzer?.getQualityStats() || null,
    getCurrentAudioQuality: () => state.audioQualityAnalyzer?.getCurrentQuality() || null,
    
    // Analytics methods
    getAnalyticsMetrics: () => state.conversationAnalytics?.getMetrics() || null,
    getAnalyticsInsights: () => state.conversationAnalytics?.getInsights() || null,
    generateAnalyticsReport: () => state.conversationAnalytics?.generateReport() || null,
    
    // Conversation flow methods
    getConversationFlowSummary: () => state.conversationFlow?.getConversationSummary() || null,
    processConversationFlow: (speakerData, audioFeatures, timestamp) => 
      state.conversationFlow?.analyze(speakerData, audioFeatures, timestamp) || null,

    // Utilities and validation
    validatePrompts,
    suggestPrompts,
    analyzeContext,
    
    // Configuration presets
    getContextStrategies: () => Object.keys(CONTEXT_STRATEGIES),
    getContextStrategyInfo: (strategy) => CONTEXT_STRATEGIES[strategy]
  };
};

// Export utility functions (not factory functions which are exported from individual modules)
export {
  // Utilities only
  validatePrompts,
  suggestPrompts,
  analyzeContext,
  CONTEXT_STRATEGIES,
  DEFAULT_STREAM_CONFIG
};

// Export factory functions from types
export {
  createSpeechRecognitionResult,
  createSpeechAnalysisResult,
  createConversationContext,
  createLLMConfig,
  createSpeechPipelineStatus,
  createSpeechEvent
};

// Default API instance factory
export const createSpeechAnalysis = (config = {}) => {
  return createSpeechAnalysisAPI(config);
};

// Export default factory (already exported above as const)