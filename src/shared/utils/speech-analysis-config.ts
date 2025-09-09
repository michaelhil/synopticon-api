/**
 * Configuration management for speech analysis pipeline
 */

export type SpeechRecognitionLanguage = 
  | 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' 
  | 'it-IT' | 'pt-BR' | 'ru-RU' | 'zh-CN' | 'ja-JP' | 'ko-KR';

export type LLMBackend = 'webllm' | 'transformers_js' | 'tfjs_models' | 'mock';

export type ContextStrategy = 'rolling' | 'summary' | 'hybrid' | 'none';

export interface SpeechAnalysisConfig {
  // Speech recognition configuration
  language: SpeechRecognitionLanguage;
  continuous: boolean;
  interimResults: boolean;
  
  // Analysis configuration
  prompts: readonly string[];
  systemPrompt: string;
  
  // LLM backend preferences (JavaScript-only, no Python)
  preferredBackend: LLMBackend;
  fallbackBackends: readonly LLMBackend[];
  
  // Context management
  contextStrategy: ContextStrategy;
  maxChunks: number;
  summaryThreshold: number;
  
  // Processing options
  autoStart: boolean;
  autoAnalyze: boolean;
  enableSync: boolean;
  
  // Performance settings
  maxConcurrency: number;
  requestTimeout: number;
  
  // Fallback mode
  useFallback: boolean;
  mockMode: boolean;
}

export interface SpeechAnalysisConfigInput {
  language?: SpeechRecognitionLanguage;
  continuous?: boolean;
  interimResults?: boolean;
  prompts?: string[];
  systemPrompt?: string;
  preferredBackend?: LLMBackend;
  fallbackBackends?: LLMBackend[];
  contextStrategy?: ContextStrategy;
  maxChunks?: number;
  summaryThreshold?: number;
  autoStart?: boolean;
  autoAnalyze?: boolean;
  enableSync?: boolean;
  maxConcurrency?: number;
  requestTimeout?: number;
  useFallback?: boolean;
  mockMode?: boolean;
  [key: string]: unknown;
}

export const DEFAULT_PROMPTS = [
  'Analyse sentiment, show as 5 keywords, nothing else.',
  'Identify most controversial statement and respond with a counterargument.',
  'Extract key themes and topics mentioned.',
  'Assess emotional tone and intensity level.'
] as const;

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant analyzing speech from conversations. Always consider both the provided conversation context AND the current speech segment in your analysis. Keep all responses to 25 words or less.' as const;

export const createSpeechAnalysisConfig = (config: SpeechAnalysisConfigInput = {}): SpeechAnalysisConfig => ({
  // Speech recognition configuration
  language: config.language ?? 'en-US',
  continuous: config.continuous !== false,
  interimResults: config.interimResults !== false,
  
  // Analysis configuration
  prompts: config.prompts ?? DEFAULT_PROMPTS,
  systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  
  // LLM backend preferences (JavaScript-only, no Python)
  preferredBackend: config.preferredBackend ?? 'webllm',
  fallbackBackends: config.fallbackBackends ?? ['transformers_js', 'tfjs_models', 'mock'],
  
  // Context management
  contextStrategy: config.contextStrategy ?? 'hybrid',
  maxChunks: config.maxChunks ?? 10,
  summaryThreshold: config.summaryThreshold ?? 20,
  
  // Processing options
  autoStart: config.autoStart === true,
  autoAnalyze: config.autoAnalyze !== false,
  enableSync: config.enableSync !== false,
  
  // Performance settings
  maxConcurrency: config.maxConcurrency ?? 2,
  requestTimeout: config.requestTimeout ?? 30000,
  
  // Fallback mode
  useFallback: config.useFallback === true,
  mockMode: config.mockMode === true
});

export const validateSpeechAnalysisConfig = (config: SpeechAnalysisConfig): string[] => {
  const errors: string[] = [];
  
  if (config.maxConcurrency < 1) {
    errors.push('Max concurrency must be at least 1');
  }
  
  if (config.requestTimeout < 1000) {
    errors.push('Request timeout must be at least 1000ms');
  }
  
  if (config.maxChunks < 1) {
    errors.push('Max chunks must be at least 1');
  }
  
  if (config.summaryThreshold < 1) {
    errors.push('Summary threshold must be at least 1');
  }
  
  if (!config.prompts || config.prompts.length === 0) {
    errors.push('At least one analysis prompt is required');
  }
  
  return errors;
};

export const updateSpeechAnalysisConfig = (
  currentConfig: SpeechAnalysisConfig,
  updates: Partial<SpeechAnalysisConfigInput>
): SpeechAnalysisConfig => {
  const newConfig = createSpeechAnalysisConfig({
    ...currentConfig,
    ...updates
  });
  
  const errors = validateSpeechAnalysisConfig(newConfig);
  
  if (errors.length > 0) {
    throw new Error(`Invalid speech analysis configuration: ${errors.join(', ')`});
  }
  
  return newConfig;
};