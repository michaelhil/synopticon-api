/**
 * Server Analysis Endpoint
 * Handles speech analysis on the server side
 * Receives transcripts from browser clients and performs LLM analysis
 * Following functional programming patterns with factory functions
 */

import { createLLMClient } from './features/speech-analysis/llm-client.js';
import { createAnalysisEngine } from './features/speech-analysis/analysis-engine.js';
import { createAnalysisConfig, validateConfig } from './server-analysis/config-manager.js';
import { createSessionManager } from './server-analysis/session-manager.js';
import { createAnalysisProcessor } from './server-analysis/analysis-processor.js';
import { createTranscriptProcessor } from './server-analysis/transcript-processor.js';
import { createBunHandlers } from './server-analysis/bun-handlers.js';

// Create server analysis handler factory
export const createServerAnalysisHandler = (config = {}) => {
  const analysisConfig = createAnalysisConfig(config);
  
  // Validate configuration
  const configErrors = validateConfig(analysisConfig);
  if (configErrors.length > 0) {
    throw new Error(`Configuration errors: ${configErrors.join(', ')}`);
  }
  
  const sessionManager = createSessionManager(analysisConfig);
  
  // Initialize components
  let llmClient = null;
  let analysisEngine = null;
  let analysisProcessor = null;
  let transcriptProcessor = null;
  let bunHandlers = null;
  
  const initialize = async () => {
    try {
      console.log('🚀 Initializing server analysis handler...');
      
      llmClient = createLLMClient(analysisConfig.llmConfig);
      analysisEngine = createAnalysisEngine({
        llmClient,
        ...analysisConfig.analysisConfig
      });
      
      analysisProcessor = createAnalysisProcessor(llmClient, analysisEngine, analysisConfig);
      transcriptProcessor = createTranscriptProcessor(analysisEngine, analysisConfig);
      
      sessionManager.startCleanupTimer();
      
      // Create Bun.serve handlers
      bunHandlers = createBunHandlers(
        sessionManager,
        (sessionId, transcripts) => transcriptProcessor.processTranscripts(sessionManager, sessionId, transcripts),
        (sessionId) => transcriptProcessor.getSession(sessionManager, sessionId),
        (sessionId, metadata) => transcriptProcessor.updateSessionMetadata(sessionManager, sessionId, metadata),
        (sessionId) => transcriptProcessor.endSession(sessionManager, sessionId)
      );
      
      console.log('✅ Server analysis handler initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize server analysis handler:', error);
      throw error;
    }
  };
  
  const processRequest = async (sessionId, transcript, requestConfig = {}) => {
    if (!analysisProcessor) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return analysisProcessor.processAnalysisRequest(sessionId, transcript, requestConfig, sessionManager);
  };
  
  const processTranscripts = async (sessionId, transcripts) => {
    if (!transcriptProcessor) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return transcriptProcessor.processTranscripts(sessionManager, sessionId, transcripts);
  };
  
  const getSession = (sessionId) => {
    if (!transcriptProcessor) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return transcriptProcessor.getSession(sessionManager, sessionId);
  };
  
  const updateSessionMetadata = (sessionId, metadata) => {
    if (!transcriptProcessor) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return transcriptProcessor.updateSessionMetadata(sessionManager, sessionId, metadata);
  };
  
  const endSession = (sessionId) => {
    if (!transcriptProcessor) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return transcriptProcessor.endSession(sessionManager, sessionId);
  };
  
  const getSessionSummary = async (sessionId) => {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return analysisProcessor.getSessionSummary(session);
  };
  
  const cleanup = async () => {
    console.log('🧹 Cleaning up server analysis handler...');
    
    sessionManager.stopCleanupTimer();
    sessionManager.cleanupExpiredSessions();
    
    if (llmClient && llmClient.cleanup) {
      await llmClient.cleanup();
    }
    
    console.log('✅ Server analysis handler cleanup completed');
  };
  
  const getStatistics = () => {
    if (!transcriptProcessor) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return transcriptProcessor.getStatistics(sessionManager);
  };
  
  const createAnalysisHandler = () => {
    if (!bunHandlers) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return bunHandlers.createAnalysisHandler();
  };
  
  const createWebSocketHandler = () => {
    if (!bunHandlers) {
      throw new Error('Server analysis handler not initialized');
    }
    
    return bunHandlers.createWebSocketHandler();
  };
  
  const updateConfig = (newConfig) => {
    Object.assign(analysisConfig, createAnalysisConfig(newConfig));
  };
  
  return {
    // Core functionality
    initialize,
    processRequest,
    processTranscripts,
    getSession,
    updateSessionMetadata,
    endSession,
    getSessionSummary,
    cleanup,
    
    // Bun.serve handlers
    createAnalysisHandler,
    createWebSocketHandler,
    
    // Statistics and management
    getStatistics,
    getSessionStats: () => sessionManager.getSessionStats(),
    getActiveSessions: () => sessionManager.getAllSessions().map(s => s.id),
    
    // Configuration
    updateConfig,
    getConfig: () => ({ ...analysisConfig })
  };
};

// Create complete server analysis handler (original functionality)
export const createServerAnalysisEndpoint = (config = {}) => {
  // Preserve original API for backward compatibility
  const state = {
    sessions: new Map(),
    config: {
      maxSessions: config.maxSessions || 100,
      sessionTimeout: config.sessionTimeout || 3600000, // 1 hour
      cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
      
      // LLM configuration
      llmConfig: {
        preferredBackend: config.llmBackend || 'ollama',
        model: config.llmModel || 'llama3.2',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 150,
        apiUrl: config.llmApiUrl || 'http://host.docker.internal:11434',
        ...config.llmConfig
      },
      
      // Analysis configuration
      analysisConfig: {
        prompts: config.prompts || [
          'Analyze the sentiment and key themes in this conversation segment.',
          'Identify any action items or decisions made.',
          'Summarize the main points in 2-3 sentences.'
        ],
        systemPrompt: config.systemPrompt || 
          'You are an AI assistant analyzing conversation transcripts. Provide concise, actionable insights.',
        maxConcurrency: config.maxConcurrency || 3,
        ...config.analysisConfig
      },
      
      // Context configuration
      contextConfig: {
        strategy: config.contextStrategy || 'sliding_window',
        maxChunks: config.maxChunks || 20,
        chunkSize: config.chunkSize || 500,
        overlapTokens: config.overlapTokens || 50,
        summaryThreshold: config.summaryThreshold || 30,
        ...config.contextConfig
      },
      
      // Analytics configuration
      analyticsConfig: {
        enabled: config.enableAnalytics !== false,
        trackSentiment: true,
        trackTopics: true,
        trackSpeakingPatterns: true,
        ...config.analyticsConfig
      }
    },
    
    // Shared resources
    llmClient: null,
    analysisEngine: null,
    cleanupTimer: null
  };

  // Use the new modular handler internally
  const handler = createServerAnalysisHandler(state.config);
  
  // Expose original API
  return {
    initialize: handler.initialize,
    processTranscripts: handler.processTranscripts,
    getSession: handler.getSession,
    updateSessionMetadata: handler.updateSessionMetadata,
    endSession: handler.endSession,
    cleanup: handler.cleanup,
    
    // Bun.serve handlers
    createAnalysisHandler: handler.createAnalysisHandler,
    createWebSocketHandler: handler.createWebSocketHandler,
    
    // Statistics
    getStatistics: handler.getStatistics,
    getActiveSessions: handler.getActiveSessions,
    
    // Configuration
    updateConfig: handler.updateConfig,
    getConfig: handler.getConfig
  };
};

// Export default configuration
export const DEFAULT_SERVER_CONFIG = {
  maxSessions: 100,
  sessionTimeout: 3600000, // 1 hour
  cleanupInterval: 300000, // 5 minutes
  llmBackend: 'ollama',
  llmModel: 'llama3.2',
  llmApiUrl: 'http://host.docker.internal:11434',
  temperature: 0.7,
  maxTokens: 150,
  enableAnalytics: true
};