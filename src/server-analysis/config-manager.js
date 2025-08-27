/**
 * Configuration management for server analysis
 */

export const createAnalysisConfig = (config = {}) => {
  return {
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
      ...config.contextConfig
    },
    
    // Conversation analytics
    analyticsConfig: {
      enableSentiment: config.enableSentiment !== false,
      enableTopics: config.enableTopics !== false,
      enableSummary: config.enableSummary !== false,
      enableActionItems: config.enableActionItems !== false,
      minConfidence: config.minConfidence || 0.7,
      ...config.analyticsConfig
    }
  };
};

export const validateConfig = (config) => {
  const errors = [];
  
  if (config.maxSessions <= 0) {
    errors.push('maxSessions must be greater than 0');
  }
  
  if (config.sessionTimeout <= 0) {
    errors.push('sessionTimeout must be greater than 0');
  }
  
  if (config.llmConfig.maxTokens <= 0) {
    errors.push('maxTokens must be greater than 0');
  }
  
  if (config.analysisConfig.maxConcurrency <= 0) {
    errors.push('maxConcurrency must be greater than 0');
  }
  
  return errors;
};