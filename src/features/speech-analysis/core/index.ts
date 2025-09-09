/**
 * Speech Analysis Core - Main API Interface
 * Modular architecture assembling configuration, events, and components
 */

import { 
  createConfigurationManager,
  type SpeechAnalysisConfiguration 
} from './configuration-manager.js';

import { 
  createEventManager,
  type EventManager,
  type EventSubscription 
} from './event-manager.js';

import { 
  createComponentFactory,
  type ComponentFactory 
} from './component-factory.js';

// Re-export utility functions
import { validatePrompts, suggestPrompts } from '../analysis-engine.js';
import { analyzeContext, CONTEXT_STRATEGIES } from '../context-manager.js';

// Re-export type creators
import {
  createSpeechRecognitionResult,
  createSpeechAnalysisResult,
  createConversationContext,
  createLLMConfig,
  createSpeechPipelineStatus,
  createSpeechEvent
} from '../../../core/configuration/types.js';

export interface SpeechAnalysisAPI {
  // Core functionality
  initialize: (options?: Record<string, any>) => Promise<boolean>;
  startSession: (sessionId?: string) => Promise<string>;
  stopSession: () => Promise<void>;
  processText: (text: string, options?: Record<string, any>) => Promise<any>;
  cleanup: () => Promise<void>;

  // Configuration management
  updatePrompts: (newPrompts: string[]) => boolean;
  updateSystemPrompt: (newSystemPrompt: string) => boolean;
  getConfiguration: () => SpeechAnalysisConfiguration;

  // Session management
  getAnalysisHistory: (sessionId?: string) => Promise<any[]>;
  clearSession: (sessionId?: string) => Promise<void>;
  generateSummary: (sessionId?: string, options?: Record<string, any>) => Promise<any>;
  exportConversationData: (sessionId?: string, format?: string) => Promise<any>;

  // Status and monitoring
  getStatus: () => any;
  isInitialized: () => boolean;
  isActive: () => boolean;

  // Event subscriptions
  onReady: (callback: (data: any) => void) => EventSubscription;
  onTranscription: (callback: (data: any) => void) => EventSubscription;
  onAnalysis: (callback: (data: any) => void) => EventSubscription;
  onError: (callback: (data: any) => void) => EventSubscription;
  onStatusChange: (callback: (data: any) => void) => EventSubscription;
  onQualityUpdate: (callback: (data: any) => void) => EventSubscription;
  onAnalyticsUpdate: (callback: (data: any) => void) => EventSubscription;

  // Component access
  getStreamingSystem: () => any;
  getSpeechRecognition: () => any;
  getAnalysisEngine: () => any;
  getContextManager: () => any;
  getAudioQualityAnalyzer: () => any;
  getConversationAnalytics: () => any;
  getConversationFlow: () => any;

  // Audio quality methods
  getAudioQualityStats: () => any;
  getCurrentAudioQuality: () => any;

  // Analytics methods
  getAnalyticsMetrics: () => any;
  getAnalyticsInsights: () => any;
  generateAnalyticsReport: () => any;

  // Conversation flow methods
  getConversationFlowSummary: () => any;
  processConversationFlow: (speakerData: any, audioFeatures: any, timestamp: number) => any;
}

/**
 * Main Speech Analysis API factory using modular architecture
 */
export const createSpeechAnalysisAPI = (config: Record<string, any> = {}): SpeechAnalysisAPI => {
  // Create modular components
  const configManager = createConfigurationManager(config);
  const eventManager = createEventManager();
  const componentFactory = createComponentFactory();

  let isInitializedState = false;

  /**
   * Initialize the speech analysis system
   */
  const initialize = async (options: Record<string, any> = {}): Promise<boolean> => {
    if (isInitializedState) {
      return true;
    }

    try {
      // Update configuration with new options
      configManager.updateConfiguration(options);
      const configuration = configManager.getConfiguration();

      // Initialize all components
      const initResult = await componentFactory.initializeComponents(configuration);

      if (!initResult.success) {
        throw new Error(`Component initialization failed: ${initResult.errors.join(', ')`);
      }

      // Setup event forwarding from components
      const components = componentFactory.getComponents();
      eventManager.setupEventForwarding(components.streamingSystem);
      eventManager.setupAudioQualityEvents(components.audioQualityAnalyzer);
      eventManager.setupAnalyticsEvents(components.conversationAnalytics);

      isInitializedState = true;

      // Notify ready callbacks
      eventManager.emit('onReady', {
        api: 'speech_analysis',
        components: initResult.components,
        configuration
      });

      return true;

    } catch (error) {
      console.error('Speech Analysis API initialization failed:', error);
      throw new Error(`Speech Analysis API initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  /**
   * Start a speech analysis session
   */
  const startSession = async (sessionId?: string): Promise<string> => {
    if (!isInitializedState) {
      throw new Error('Speech Analysis API not initialized');
    }

    return await componentFactory.startSession(sessionId);
  };

  /**
   * Stop the current session
   */
  const stopSession = async (): Promise<void> => {
    if (!isInitializedState) {
      return;
    }

    await componentFactory.stopSession();
  };

  /**
   * Process text manually without speech recognition
   */
  const processText = async (text: string, options: Record<string, any> = {}): Promise<any> => {
    if (!isInitializedState) {
      throw new Error('Speech Analysis API not initialized');
    }

    if (!text || !text.trim()) {
      throw new Error('No text provided for processing');
    }

    const methods = componentFactory.getComponentMethods();
    return await methods.processText(text, {
      confidence: 0.95,
      ...options
    });
  };

  /**
   * Update analysis prompts
   */
  const updatePrompts = (newPrompts: string[]): boolean => {
    const validation = validatePrompts(newPrompts);
    if (!validation.valid) {
      throw new Error(`Invalid prompts: ${validation.error}`);
    }

    const methods = componentFactory.getComponentMethods();
    const analysisEngine = methods.getAnalysisEngine();
    if (analysisEngine) {
      analysisEngine.updatePrompts(newPrompts);
      configManager.updateConfiguration({
        analysisConfig: { prompts: [...newPrompts] }
      });
      return true;
    }

    throw new Error('Analysis engine not available');
  };

  /**
   * Update system prompt
   */
  const updateSystemPrompt = (newSystemPrompt: string): boolean => {
    if (!newSystemPrompt || !newSystemPrompt.trim()) {
      throw new Error('System prompt cannot be empty');
    }

    const methods = componentFactory.getComponentMethods();
    const analysisEngine = methods.getAnalysisEngine();
    if (analysisEngine) {
      analysisEngine.updateSystemPrompt(newSystemPrompt);
      configManager.updateConfiguration({
        analysisConfig: { systemPrompt: newSystemPrompt }
      });
      return true;
    }

    throw new Error('Analysis engine not available');
  };

  /**
   * Get analysis history
   */
  const getAnalysisHistory = async (sessionId?: string): Promise<any[]> => {
    const contextManager = componentFactory.getComponentMethods().getContextManager();
    if (!contextManager) {
      throw new Error('Context manager not available');
    }

    return contextManager.getAnalysisHistory?.(sessionId) || [];
  };

  /**
   * Clear session data
   */
  const clearSession = async (sessionId?: string): Promise<void> => {
    const contextManager = componentFactory.getComponentMethods().getContextManager();
    if (contextManager) {
      await contextManager.clearSession?.(sessionId);
    }
  };

  /**
   * Generate conversation summary
   */
  const generateSummary = async (sessionId?: string, options: Record<string, any> = {}): Promise<any> => {
    const contextManager = componentFactory.getComponentMethods().getContextManager();
    if (!contextManager) {
      throw new Error('Context manager not available');
    }

    return await contextManager.generateSummary?.(sessionId, options);
  };

  /**
   * Export conversation data
   */
  const exportConversationData = async (sessionId?: string, format = 'json'): Promise<any> => {
    const history = await getAnalysisHistory(sessionId);
    const summary = await generateSummary(sessionId);
    const methods = componentFactory.getComponentMethods();

    const exportData = {
      sessionId: sessionId || 'current',
      timestamp: new Date().toISOString(),
      configuration: configManager.getConfiguration(),
      analysisHistory: history,
      summary,
      audioQualityStats: methods.getAudioQualityStats(),
      analyticsMetrics: methods.getAnalyticsMetrics(),
      conversationFlowSummary: methods.getConversationFlowSummary()
    };

    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(exportData, null, 2);
    case 'csv':
      // Simple CSV conversion for analysis history
      const csvRows = history.map(item => 
        `"${item.timestamp}","${item.text?.replace(/"/g, '""') || ''}","${item.analysis?.join('\n'); ') || ''}"`
      );
      return ['Timestamp,Text,Analysis', ...csvRows].join('\n')

    default:
      return exportData;
    }
  };

  /**
   * Get current status
   */
  const getStatus = () => {
    const componentStatus = componentFactory.getComponentStatus();
    return {
      initialized: isInitializedState,
      components: componentStatus,
      configuration: configManager.getConfiguration(),
      subscribers: eventManager.getSubscriberCounts()
    };
  };

  /**
   * Cleanup all resources
   */
  const cleanup = async (): Promise<void> => {
    try {
      await componentFactory.cleanup();
      eventManager.cleanup();
      isInitializedState = false;
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  };

  // Get component methods for delegation
  const methods = componentFactory.getComponentMethods();

  // Return the complete API interface
  return {
    // Core functionality
    initialize,
    startSession,
    stopSession,
    processText,
    cleanup,

    // Configuration management
    updatePrompts,
    updateSystemPrompt,
    getConfiguration: () => configManager.getConfiguration(),

    // Session management
    getAnalysisHistory,
    clearSession,
    generateSummary,
    exportConversationData,

    // Status and monitoring
    getStatus,
    isInitialized: () => isInitializedState,
    isActive: () => componentFactory.isActive(),

    // Event subscriptions
    onReady: (callback) => eventManager.onReady(callback),
    onTranscription: (callback) => eventManager.onTranscription(callback),
    onAnalysis: (callback) => eventManager.onAnalysis(callback),
    onError: (callback) => eventManager.onError(callback),
    onStatusChange: (callback) => eventManager.onStatusChange(callback),
    onQualityUpdate: (callback) => eventManager.onQualityUpdate(callback),
    onAnalyticsUpdate: (callback) => eventManager.onAnalyticsUpdate(callback),

    // Component access
    getStreamingSystem: () => componentFactory.getStreamingSystem(),
    getSpeechRecognition: () => methods.getSpeechRecognition(),
    getAnalysisEngine: () => methods.getAnalysisEngine(),
    getContextManager: () => methods.getContextManager(),
    getAudioQualityAnalyzer: () => componentFactory.getAudioQualityAnalyzer(),
    getConversationAnalytics: () => componentFactory.getConversationAnalytics(),
    getConversationFlow: () => componentFactory.getConversationFlow(),

    // Audio quality methods
    getAudioQualityStats: () => methods.getAudioQualityStats(),
    getCurrentAudioQuality: () => methods.getCurrentAudioQuality(),

    // Analytics methods  
    getAnalyticsMetrics: () => methods.getAnalyticsMetrics(),
    getAnalyticsInsights: () => methods.getAnalyticsInsights(),
    generateAnalyticsReport: () => methods.generateAnalyticsReport(),

    // Conversation flow methods
    getConversationFlowSummary: () => methods.getConversationFlowSummary(),
    processConversationFlow: (speakerData, audioFeatures, timestamp) => 
      methods.processConversationFlow(speakerData, audioFeatures, timestamp)
  };
};

// Re-export utility functions and factories
export {
  validatePrompts,
  suggestPrompts,
  analyzeContext,
  CONTEXT_STRATEGIES,
  createSpeechRecognitionResult,
  createSpeechAnalysisResult,
  createConversationContext,
  createLLMConfig,
  createSpeechPipelineStatus,
  createSpeechEvent
};

// Export types
export type { 
  SpeechAnalysisConfiguration,
  EventManager,
  EventSubscription,
  ComponentFactory
};

// Default export
