/**
 * Multi-Prompt Analysis Engine
 * Processes speech transcripts using multiple analysis prompts concurrently
 * Following functional programming patterns with factory functions
 */

import { createLLMClient } from './llm-client.js';
import {
  createSpeechAnalysisResult,
  createAnalysisPromptResult,
  createSpeechEvent
} from '../core/types.js';

// Default analysis prompts
const DEFAULT_PROMPTS = [
  'Analyse sentiment, show as 5 keywords, nothing else.',
  'Identify most controversial statement and respond with a counterargument.'
];

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant analyzing speech from conversations. IMPORTANT: Always consider both the provided conversation context AND the current speech segment in your analysis. Keep all responses to 25 words or less.';

// Create analysis engine factory
export const createAnalysisEngine = (config = {}) => {
  const state = {
    llmClient: null,
    isInitialized: false,
    prompts: config.prompts || [...DEFAULT_PROMPTS],
    systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    maxConcurrency: config.maxConcurrency || 3,
    analysisTimeout: config.analysisTimeout || 30000,
    
    // Analysis queue and processing
    analysisQueue: [],
    isProcessing: false,
    processingPromises: new Map(),
    
    // Performance metrics
    metrics: {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      averageLatency: 0,
      promptPerformance: new Map()
    },

    // Event callbacks
    callbacks: {
      onAnalysisStart: [],
      onAnalysisComplete: [],
      onAnalysisError: [],
      onQueueUpdate: []
    }
  };

  // Initialize the analysis engine
  const initialize = async (llmConfig = {}) => {
    if (state.isInitialized) {
      console.warn('Analysis engine already initialized');
      return true;
    }

    console.log('🔄 Initializing analysis engine...');

    try {
      // Initialize LLM client
      state.llmClient = createLLMClient({
        ...llmConfig,
        defaultSystemPrompt: state.systemPrompt
      });

      await state.llmClient.initialize();

      // Setup LLM event handlers
      state.llmClient.onError((error) => {
        notifyCallbacks('onAnalysisError', createSpeechEvent({
          type: 'llm_error',
          data: { error: error.message },
          severity: 'error'
        }));
      });

      state.isInitialized = true;
      console.log('✅ Analysis engine initialized successfully');
      return true;

    } catch (error) {
      console.error('Analysis engine initialization failed:', error);
      throw new Error(`Analysis engine initialization failed: ${error.message}`);
    }
  };

  // Analyze speech text with all configured prompts
  const analyzeText = async (text, context = '', options = {}) => {
    if (!state.isInitialized || !state.llmClient) {
      throw new Error('Analysis engine not initialized');
    }

    if (!text || !text.trim()) {
      throw new Error('No text provided for analysis');
    }

    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    console.log(`🔄 Starting analysis ${analysisId} for: "${text.substring(0, 50)}..."`);

    // Notify analysis start
    notifyCallbacks('onAnalysisStart', createSpeechEvent({
      type: 'analysis_start',
      data: { 
        analysisId,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        promptCount: state.prompts.length 
      }
    }));

    try {
      // Use current prompts or provided prompts
      const prompts = options.prompts || state.prompts;
      const systemPrompt = options.systemPrompt || state.systemPrompt;

      if (prompts.length === 0) {
        throw new Error('No analysis prompts configured');
      }

      // Generate analyses using LLM client
      const analyses = await state.llmClient.generateMultipleAnalyses(
        prompts, 
        text, 
        systemPrompt
      );

      // Update metrics
      const latency = performance.now() - startTime;
      state.metrics.totalAnalyses++;
      state.metrics.successfulAnalyses++;
      state.metrics.averageLatency = 
        (state.metrics.averageLatency * (state.metrics.totalAnalyses - 1) + latency) / 
        state.metrics.totalAnalyses;

      // Update per-prompt performance
      analyses.forEach((analysis, index) => {
        const prompt = prompts[index];
        if (!state.metrics.promptPerformance.has(prompt)) {
          state.metrics.promptPerformance.set(prompt, {
            totalRuns: 0,
            successfulRuns: 0,
            averageLatency: 0
          });
        }
        
        const promptMetrics = state.metrics.promptPerformance.get(prompt);
        promptMetrics.totalRuns++;
        if (!analysis.error) {
          promptMetrics.successfulRuns++;
        }
        promptMetrics.averageLatency = 
          (promptMetrics.averageLatency * (promptMetrics.totalRuns - 1) + analysis.processingTime) / 
          promptMetrics.totalRuns;
      });

      // Create analysis result
      const result = createSpeechAnalysisResult({
        text,
        context,
        analyses,
        conversationContext: options.conversationContext || {},
        processingTime: latency,
        llmModel: state.llmClient.getStatus().activeBackend,
        systemPrompt
      });

      console.log(`✅ Analysis ${analysisId} completed in ${latency.toFixed(2)}ms`);

      // Notify completion
      notifyCallbacks('onAnalysisComplete', createSpeechEvent({
        type: 'analysis_complete',
        data: { 
          analysisId,
          result,
          latency: latency.toFixed(2)
        }
      }));

      return result;

    } catch (error) {
      const latency = performance.now() - startTime;
      state.metrics.totalAnalyses++;
      state.metrics.failedAnalyses++;

      console.error(`❌ Analysis ${analysisId} failed:`, error.message);

      // Notify error
      notifyCallbacks('onAnalysisError', createSpeechEvent({
        type: 'analysis_error',
        data: { 
          analysisId,
          error: error.message,
          text: text.substring(0, 100),
          latency: latency.toFixed(2)
        },
        severity: 'error'
      }));

      throw error;
    }
  };

  // Batch analyze multiple texts
  const analyzeTextBatch = async (texts, contexts = [], options = {}) => {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('No texts provided for batch analysis');
    }

    console.log(`🔄 Starting batch analysis of ${texts.length} texts...`);

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const results = [];

    try {
      // Process texts with respect to concurrency limits
      const maxConcurrent = Math.min(texts.length, state.maxConcurrency);
      
      for (let i = 0; i < texts.length; i += maxConcurrent) {
        const batch = texts.slice(i, i + maxConcurrent);
        const batchContexts = contexts.slice(i, i + maxConcurrent);
        
        const batchPromises = batch.map(async (text, index) => {
          const context = batchContexts[index] || '';
          const textOptions = {
            ...options,
            conversationContext: {
              ...options.conversationContext,
              chunkIndex: i + index,
              totalChunks: texts.length
            }
          };

          try {
            return await analyzeText(text, context, textOptions);
          } catch (error) {
            console.warn(`Batch analysis failed for text ${i + index + 1}:`, error.message);
            return createSpeechAnalysisResult({
              text,
              context,
              analyses: [createAnalysisPromptResult({
                prompt: 'Batch analysis failed',
                result: `Error: ${error.message}`,
                error: error.message
              })],
              processingTime: 0,
              llmModel: 'error'
            });
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      console.log(`✅ Batch analysis ${batchId} completed: ${results.length} results`);
      return results;

    } catch (error) {
      console.error(`❌ Batch analysis ${batchId} failed:`, error.message);
      throw error;
    }
  };

  // Update analysis prompts
  const updatePrompts = (newPrompts) => {
    if (!Array.isArray(newPrompts) || newPrompts.length === 0) {
      throw new Error('Invalid prompts: must be non-empty array');
    }

    const oldPrompts = [...state.prompts];
    state.prompts = newPrompts.map(p => p.trim()).filter(p => p.length > 0);

    console.log(`📝 Updated analysis prompts: ${oldPrompts.length} → ${state.prompts.length}`);
    return true;
  };

  // Update system prompt
  const updateSystemPrompt = (newSystemPrompt) => {
    if (!newSystemPrompt || !newSystemPrompt.trim()) {
      throw new Error('Invalid system prompt: must be non-empty string');
    }

    const oldPrompt = state.systemPrompt;
    state.systemPrompt = newSystemPrompt.trim();

    console.log('🤖 Updated system prompt');
    return true;
  };

  // Reset prompts to defaults
  const resetToDefaults = () => {
    state.prompts = [...DEFAULT_PROMPTS];
    state.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    console.log('↺ Reset to default prompts and system prompt');
    return true;
  };

  // Get engine status
  const getStatus = () => ({
    isInitialized: state.isInitialized,
    promptCount: state.prompts.length,
    systemPromptLength: state.systemPrompt.length,
    llmStatus: state.llmClient ? state.llmClient.getStatus() : null,
    metrics: {
      ...state.metrics,
      promptPerformance: Object.fromEntries(state.metrics.promptPerformance)
    },
    queueLength: state.analysisQueue.length,
    isProcessing: state.isProcessing
  });

  // Get current configuration
  const getConfiguration = () => ({
    prompts: [...state.prompts],
    systemPrompt: state.systemPrompt,
    maxConcurrency: state.maxConcurrency,
    analysisTimeout: state.analysisTimeout
  });

  // Cleanup resources
  const cleanup = async () => {
    console.log('🧹 Cleaning up analysis engine...');

    if (state.llmClient) {
      await state.llmClient.cleanup();
      state.llmClient = null;
    }

    // Clear any pending operations
    state.analysisQueue.length = 0;
    state.processingPromises.clear();
    state.isProcessing = false;
    state.isInitialized = false;

    console.log('✅ Analysis engine cleanup complete');
  };

  // Event subscription methods
  const onAnalysisStart = (callback) => subscribeCallback('onAnalysisStart', callback);
  const onAnalysisComplete = (callback) => subscribeCallback('onAnalysisComplete', callback);
  const onAnalysisError = (callback) => subscribeCallback('onAnalysisError', callback);
  const onQueueUpdate = (callback) => subscribeCallback('onQueueUpdate', callback);

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
        console.warn(`Analysis engine ${eventType} callback error:`, error);
      }
    });
  };

  return {
    // Core functionality
    initialize,
    analyzeText,
    analyzeTextBatch,
    cleanup,

    // Configuration
    updatePrompts,
    updateSystemPrompt,
    resetToDefaults,
    getConfiguration,

    // Status and metrics
    getStatus,
    isInitialized: () => state.isInitialized,
    getMetrics: () => ({ ...state.metrics }),

    // Event handlers
    onAnalysisStart,
    onAnalysisComplete,
    onAnalysisError,
    onQueueUpdate,

    // Access to underlying components
    getLLMClient: () => state.llmClient,
    
    // Utility methods
    getPrompts: () => [...state.prompts],
    getSystemPrompt: () => state.systemPrompt,
    getPromptPerformance: (prompt) => state.metrics.promptPerformance.get(prompt) || null
  };
};

// Prompt validation utilities
export const validatePrompt = (prompt) => {
  if (typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt must be a string' };
  }

  if (prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }

  if (prompt.length > 1000) {
    return { valid: false, error: 'Prompt too long (max 1000 characters)' };
  }

  return { valid: true };
};

export const validatePrompts = (prompts) => {
  if (!Array.isArray(prompts)) {
    return { valid: false, error: 'Prompts must be an array' };
  }

  if (prompts.length === 0) {
    return { valid: false, error: 'Must provide at least one prompt' };
  }

  if (prompts.length > 10) {
    return { valid: false, error: 'Too many prompts (max 10)' };
  }

  for (let i = 0; i < prompts.length; i++) {
    const validation = validatePrompt(prompts[i]);
    if (!validation.valid) {
      return { valid: false, error: `Prompt ${i + 1}: ${validation.error}` };
    }
  }

  return { valid: true };
};

// Prompt suggestion utilities
export const suggestPrompts = (domain = 'general') => {
  const suggestions = {
    general: [
      'Analyse sentiment, show as 5 keywords, nothing else.',
      'Identify most controversial statement and respond with a counterargument.',
      'Extract key themes and topics mentioned.',
      'Assess emotional tone and intensity level.',
      'Identify any requests, questions, or action items.'
    ],
    
    educational: [
      'Identify learning objectives and key concepts.',
      'Assess comprehension level and engagement.',
      'Extract questions or areas of confusion.',
      'Identify examples or analogies used.',
      'Evaluate teaching effectiveness indicators.'
    ],
    
    business: [
      'Identify action items and decisions made.',
      'Extract key metrics, numbers, and KPIs mentioned.',
      'Assess meeting effectiveness and engagement.',
      'Identify risks, issues, or concerns raised.',
      'Extract next steps and deadlines.'
    ],
    
    therapy: [
      'Assess emotional state and mood indicators.',
      'Identify coping mechanisms mentioned.',
      'Extract goals and progress indicators.',
      'Identify concerns or stress factors.',
      'Assess therapeutic progress and insights.'
    ],
    
    research: [
      'Extract hypotheses and research questions.',
      'Identify methodology and approaches discussed.',
      'Extract findings and observations.',
      'Identify limitations and future work.',
      'Assess research validity and significance.'
    ]
  };

  return suggestions[domain] || suggestions.general;
};

// Export default factory
export { createAnalysisEngine };