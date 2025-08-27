/**
 * Speech Analysis Component Factory
 * Creates and manages speech analysis component instances
 */

import { createSpeechStreaming } from '../streaming.js';
import { createAudioQualityAnalyzer } from '../audio-quality.js';
import { createConversationAnalytics } from '../conversation-analytics.js';
import { createConversationAnalytics as createConversationFlow } from '../audio/conversation-analytics.js';
import type { 
  SpeechAnalysisConfiguration,
  AudioQualityConfiguration,
  AnalyticsConfiguration,
  FlowConfiguration 
} from './configuration-manager.ts';

export interface ComponentState {
  streamingSystem: any;
  audioQualityAnalyzer: any;
  conversationAnalytics: any;
  conversationFlow: any;
  isInitialized: boolean;
}

export interface ComponentInitializationResult {
  success: boolean;
  components: string[];
  errors: string[];
}

/**
 * Creates a component factory for speech analysis
 */
export const createComponentFactory = () => {
  let state: ComponentState = {
    streamingSystem: null,
    audioQualityAnalyzer: null,
    conversationAnalytics: null,
    conversationFlow: null,
    isInitialized: false
  };

  /**
   * Initialize all components based on configuration
   */
  const initializeComponents = async (configuration: SpeechAnalysisConfiguration): Promise<ComponentInitializationResult> => {
    const result: ComponentInitializationResult = {
      success: true,
      components: [],
      errors: []
    };

    try {
      // Always create the streaming system (core requirement)
      state.streamingSystem = createSpeechStreaming(configuration.streamConfig);
      result.components.push('streaming');

      // Initialize audio quality analyzer if enabled
      if (configuration.audioQualityConfig.enabled) {
        try {
          state.audioQualityAnalyzer = createAudioQualityAnalyzer(configuration.audioQualityConfig);
          await state.audioQualityAnalyzer.initialize();
          result.components.push('audio_quality');
        } catch (error) {
          const errorMessage = `Audio quality analyzer initialization failed: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          state.audioQualityAnalyzer = null;
        }
      }

      // Initialize conversation analytics if enabled
      if (configuration.analyticsConfig.enabled) {
        try {
          state.conversationAnalytics = createConversationAnalytics(configuration.analyticsConfig);
          result.components.push('analytics');
        } catch (error) {
          const errorMessage = `Conversation analytics initialization failed: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          state.conversationAnalytics = null;
        }
      }

      // Initialize conversation flow analysis if enabled
      if (configuration.flowConfig.enabled) {
        try {
          state.conversationFlow = createConversationFlow(configuration.flowConfig);
          result.components.push('conversation_flow');
        } catch (error) {
          const errorMessage = `Conversation flow initialization failed: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          state.conversationFlow = null;
        }
      }

      // Initialize the streaming system with configuration
      await state.streamingSystem.initialize({
        language: configuration.language,
        llmConfig: configuration.llmConfig,
        prompts: configuration.analysisConfig.prompts,
        systemPrompt: configuration.analysisConfig.systemPrompt,
        contextStrategy: configuration.contextConfig.strategy,
        maxChunks: configuration.contextConfig.maxChunks,
        summaryThreshold: configuration.contextConfig.summaryThreshold,
        enableSync: configuration.enableSync
      });

      result.components.push('recognition', 'analysis', 'context');
      state.isInitialized = true;

      // Consider initialization successful if streaming system is ready
      result.success = true;

    } catch (error) {
      const errorMessage = `Core streaming system initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
      result.success = false;
      state.isInitialized = false;
    }

    return result;
  };

  /**
   * Start session for all active components
   */
  const startSession = async (sessionId?: string): Promise<string> => {
    if (!state.isInitialized || !state.streamingSystem) {
      throw new Error('Components not initialized');
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
      try {
        state.conversationAnalytics.initialize();
        state.conversationAnalytics.startAnalysis();
      } catch (error) {
        console.warn('Conversation analytics failed to start:', error);
      }
    }

    // Conversation flow analysis starts automatically with speaker data
    return targetSessionId;
  };

  /**
   * Stop session for all active components
   */
  const stopSession = async (): Promise<void> => {
    if (!state.isInitialized || !state.streamingSystem) {
      return;
    }

    // Stop audio quality analysis
    if (state.audioQualityAnalyzer) {
      try {
        state.audioQualityAnalyzer.stopAnalysis();
      } catch (error) {
        console.warn('Audio quality stop failed:', error);
      }
    }

    // Stop conversation analytics
    if (state.conversationAnalytics) {
      try {
        state.conversationAnalytics.stopAnalysis();
      } catch (error) {
        console.warn('Conversation analytics stop failed:', error);
      }
    }

    // Stop conversation flow analysis
    if (state.conversationFlow) {
      try {
        state.conversationFlow.reset();
      } catch (error) {
        console.warn('Conversation flow reset failed:', error);
      }
    }

    // Stop streaming system
    await state.streamingSystem.stopStreaming();
  };

  /**
   * Cleanup all components and resources
   */
  const cleanup = async (): Promise<void> => {
    try {
      await stopSession();
    } catch (error) {
      console.warn('Stop session during cleanup failed:', error);
    }

    // Cleanup streaming system
    if (state.streamingSystem) {
      try {
        await state.streamingSystem.cleanup();
      } catch (error) {
        console.warn('Streaming system cleanup failed:', error);
      }
    }

    // Cleanup audio quality analyzer
    if (state.audioQualityAnalyzer) {
      try {
        await state.audioQualityAnalyzer.cleanup();
      } catch (error) {
        console.warn('Audio quality cleanup failed:', error);
      }
    }

    // Cleanup conversation analytics
    if (state.conversationAnalytics) {
      try {
        await state.conversationAnalytics.cleanup();
      } catch (error) {
        console.warn('Conversation analytics cleanup failed:', error);
      }
    }

    // Reset state
    state = {
      streamingSystem: null,
      audioQualityAnalyzer: null,
      conversationAnalytics: null,
      conversationFlow: null,
      isInitialized: false
    };
  };

  /**
   * Get current component status
   */
  const getComponentStatus = () => {
    return {
      isInitialized: state.isInitialized,
      streamingSystem: {
        available: !!state.streamingSystem,
        active: state.streamingSystem?.isActive?.() || false
      },
      audioQualityAnalyzer: {
        available: !!state.audioQualityAnalyzer,
        analyzing: state.audioQualityAnalyzer?.isAnalyzing?.() || false
      },
      conversationAnalytics: {
        available: !!state.conversationAnalytics,
        analyzing: state.conversationAnalytics?.isAnalyzing?.() || false
      },
      conversationFlow: {
        available: !!state.conversationFlow
      }
    };
  };

  /**
   * Get component instances
   */
  const getComponents = () => {
    return {
      streamingSystem: state.streamingSystem,
      audioQualityAnalyzer: state.audioQualityAnalyzer,
      conversationAnalytics: state.conversationAnalytics,
      conversationFlow: state.conversationFlow
    };
  };

  /**
   * Get specific component methods
   */
  const getComponentMethods = () => {
    return {
      // Streaming system methods
      processText: (text: string, options: any) => 
        state.streamingSystem?.processText?.(text, options),
      
      getSpeechRecognition: () => 
        state.streamingSystem?.getSpeechRecognition?.(),
      
      getAnalysisEngine: () => 
        state.streamingSystem?.getAnalysisEngine?.(),
      
      getContextManager: () => 
        state.streamingSystem?.getContextManager?.(),

      // Audio quality methods
      getAudioQualityStats: () => 
        state.audioQualityAnalyzer?.getQualityStats?.() || null,
      
      getCurrentAudioQuality: () => 
        state.audioQualityAnalyzer?.getCurrentQuality?.() || null,

      // Analytics methods
      getAnalyticsMetrics: () => 
        state.conversationAnalytics?.getMetrics?.() || null,
      
      getAnalyticsInsights: () => 
        state.conversationAnalytics?.getInsights?.() || null,
      
      generateAnalyticsReport: () => 
        state.conversationAnalytics?.generateReport?.() || null,

      // Conversation flow methods
      getConversationFlowSummary: () => 
        state.conversationFlow?.getConversationSummary?.() || null,
      
      processConversationFlow: (speakerData: any, audioFeatures: any, timestamp: number) =>
        state.conversationFlow?.analyze?.(speakerData, audioFeatures, timestamp) || null
    };
  };

  return {
    // Core lifecycle methods
    initializeComponents,
    startSession,
    stopSession,
    cleanup,

    // State accessors
    getComponentStatus,
    getComponents,
    getComponentMethods,

    // Getters for individual components (for backward compatibility)
    getStreamingSystem: () => state.streamingSystem,
    getAudioQualityAnalyzer: () => state.audioQualityAnalyzer,
    getConversationAnalytics: () => state.conversationAnalytics,
    getConversationFlow: () => state.conversationFlow,

    // Status helpers
    isInitialized: () => state.isInitialized,
    isActive: () => state.streamingSystem?.isActive?.() || false
  };
};

export type ComponentFactory = ReturnType<typeof createComponentFactory>;