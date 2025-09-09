/**
 * Speech Analysis Configuration Manager
 * Handles configuration merging, validation, and management
 */

import { DEFAULT_STREAM_CONFIG } from '../streaming.js';

export interface SpeechAnalysisConfiguration {
  readonly language: string;
  readonly continuous: boolean;
  readonly interimResults: boolean;
  readonly autoAnalyze: boolean;
  readonly enableSync: boolean;
  readonly llmConfig: LLMConfiguration;
  readonly analysisConfig: AnalysisConfiguration;
  readonly contextConfig: ContextConfiguration;
  readonly streamConfig: StreamConfiguration;
  readonly audioQualityConfig: AudioQualityConfiguration;
  readonly analyticsConfig: AnalyticsConfiguration;
  readonly flowConfig: FlowConfiguration;
}

export interface LLMConfiguration {
  readonly preferredBackend: string;
  readonly fallbackBackends: readonly string[];
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly [key: string]: any;
}

export interface AnalysisConfiguration {
  readonly prompts: readonly string[];
  readonly systemPrompt: string;
  readonly maxConcurrency: number;
  readonly [key: string]: any;
}

export interface ContextConfiguration {
  readonly strategy: string;
  readonly maxChunks: number;
  readonly summaryThreshold: number;
  readonly [key: string]: any;
}

export interface StreamConfiguration {
  readonly [key: string]: any;
}

export interface AudioQualityConfiguration {
  readonly enabled: boolean;
  readonly fftSize: number;
  readonly smoothingTimeConstant: number;
  readonly [key: string]: any;
}

export interface AnalyticsConfiguration {
  readonly enabled: boolean;
  readonly trackSentiment: boolean;
  readonly trackTopics: boolean;
  readonly trackSpeakingPatterns: boolean;
  readonly [key: string]: any;
}

export interface FlowConfiguration {
  readonly enabled: boolean;
  readonly minSilenceDuration: number;
  readonly maxSilenceDuration: number;
  readonly interruptionThreshold: number;
  readonly [key: string]: any;
}

/**
 * Creates the default configuration for speech analysis
 */
export const createDefaultConfiguration = (config: Record<string, any> = {}): SpeechAnalysisConfiguration => {
  return {
    language: config.language || 'en-US',
    continuous: config.continuous !== false,
    interimResults: config.interimResults !== false,
    autoAnalyze: config.autoAnalyze !== false,
    enableSync: config.enableSync !== false,
    
    llmConfig: {
      preferredBackend: config.preferredBackend || 'webllm',
      fallbackBackends: config.fallbackBackends || ['transformers_js', 'mock'],
      model: config.model || 'Llama-3.2-1B-Instruct-q4f32_1',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 100,
      ...config.llmConfig
    },
    
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
    
    contextConfig: {
      strategy: config.contextStrategy || 'hybrid',
      maxChunks: config.maxChunks || 10,
      summaryThreshold: config.summaryThreshold || 20,
      ...config.contextConfig
    },
    
    streamConfig: {
      ...DEFAULT_STREAM_CONFIG,
      ...config.streamConfig
    },
    
    audioQualityConfig: {
      enabled: config.enableAudioQuality !== false,
      fftSize: config.fftSize || 2048,
      smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
      ...config.audioQualityConfig
    },
    
    analyticsConfig: {
      enabled: config.enableAnalytics !== false,
      trackSentiment: config.trackSentiment !== false,
      trackTopics: config.trackTopics !== false,
      trackSpeakingPatterns: config.trackSpeakingPatterns !== false,
      ...config.analyticsConfig
    },
    
    flowConfig: {
      enabled: config.enableConversationFlow !== false,
      minSilenceDuration: config.minSilenceDuration || 0.5,
      maxSilenceDuration: config.maxSilenceDuration || 3.0,
      interruptionThreshold: config.interruptionThreshold || 0.2,
      ...config.flowConfig
    }
  };
};

/**
 * Merges configuration with options
 */
export const mergeConfiguration = (
  baseConfig: SpeechAnalysisConfiguration, 
  options: Record<string, any> = {}
): SpeechAnalysisConfiguration => {
  return {
    ...baseConfig,
    ...options,
    llmConfig: { ...baseConfig.llmConfig, ...options.llmConfig },
    analysisConfig: { ...baseConfig.analysisConfig, ...options.analysisConfig },
    contextConfig: { ...baseConfig.contextConfig, ...options.contextConfig },
    streamConfig: { ...baseConfig.streamConfig, ...options.streamConfig },
    audioQualityConfig: { ...baseConfig.audioQualityConfig, ...options.audioQualityConfig },
    analyticsConfig: { ...baseConfig.analyticsConfig, ...options.analyticsConfig },
    flowConfig: { ...baseConfig.flowConfig, ...options.flowConfig }
  };
};

/**
 * Validates the configuration
 */
export const validateConfiguration = (config: SpeechAnalysisConfiguration): string[] => {
  const errors: string[] = [];
  
  if (!config.language) {
    errors.push('Language is required');
  }
  
  if (!config.llmConfig.model) {
    errors.push('LLM model is required');
  }
  
  if (config.llmConfig.temperature < 0 || config.llmConfig.temperature > 2) {
    errors.push('LLM temperature must be between 0 and 2');
  }
  
  if (config.llmConfig.maxTokens < 1) {
    errors.push('LLM maxTokens must be greater than 0');
  }
  
  if (!config.analysisConfig.prompts || config.analysisConfig.prompts.length === 0) {
    errors.push('At least one analysis prompt is required');
  }
  
  if (!config.analysisConfig.systemPrompt) {
    errors.push('System prompt is required');
  }
  
  if (config.analysisConfig.maxConcurrency < 1) {
    errors.push('Max concurrency must be at least 1');
  }
  
  if (config.contextConfig.maxChunks < 1) {
    errors.push('Max chunks must be at least 1');
  }
  
  if (config.contextConfig.summaryThreshold < 1) {
    errors.push('Summary threshold must be at least 1');
  }
  
  if (config.audioQualityConfig.enabled) {
    if (config.audioQualityConfig.fftSize < 256) {
      errors.push('FFT size must be at least 256');
    }
    
    if (config.audioQualityConfig.smoothingTimeConstant < 0 || config.audioQualityConfig.smoothingTimeConstant > 1) {
      errors.push('Smoothing time constant must be between 0 and 1');
    }
  }
  
  if (config.flowConfig.enabled) {
    if (config.flowConfig.minSilenceDuration < 0) {
      errors.push('Min silence duration must be non-negative');
    }
    
    if (config.flowConfig.maxSilenceDuration <= config.flowConfig.minSilenceDuration) {
      errors.push('Max silence duration must be greater than min silence duration');
    }
    
    if (config.flowConfig.interruptionThreshold < 0 || config.flowConfig.interruptionThreshold > 1) {
      errors.push('Interruption threshold must be between 0 and 1');
    }
  }
  
  return errors;
};

/**
 * Creates a configuration manager instance
 */
export const createConfigurationManager = (initialConfig: Record<string, any> = {}) => {
  let currentConfig = createDefaultConfiguration(initialConfig);
  
  return {
    getConfiguration: () => ({ ...currentConfig }),
    
    updateConfiguration: (updates: Record<string, any>): void => {
      const newConfig = mergeConfiguration(currentConfig, updates);
      const errors = validateConfiguration(newConfig);
      
      if (errors.length > 0) {
        throw new Error(`Configuration validation failed: ${errors.join(', ')`);
      }
      
      currentConfig = newConfig;
    },
    
    validateConfiguration: () => validateConfiguration(currentConfig),
    
    resetConfiguration: (newConfig: Record<string, any> = {}): void => {
      currentConfig = createDefaultConfiguration(newConfig);
    }
  };
};
