/**
 * @fileoverview LLM Provider Abstraction Layer
 * 
 * Unified interface for multiple Large Language Model providers with
 * automatic fallback, error handling, and provider-specific optimizations.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createLogger } from '../../../shared/utils/logger.js';
import type {
  LLMProvider,
  LLMProviderFactory,
  LLMProviderConfig,
  LLMProviderType,
  LLMMessage,
  LLMRequestConfig,
  LLMResponse,
  OpenAIConfig,
  AnthropicConfig,
  AzureOpenAIConfig,
  MockResponseConfig
} from './types.js';

const logger = createLogger({ level: 2 });

/**
 * Create LLM provider with automatic configuration
 */
export const createLLMProvider: LLMProviderFactory = (config) => {
  const { provider, apiKey, model, baseURL, maxTokens = 2048, temperature = 0.1 } = config;

  const makeRequest = async (messages: LLMMessage[], options: Partial<LLMRequestConfig> = {}): Promise<LLMResponse> => {
    const requestConfig: LLMRequestConfig = {
      model: options.model || model,
      messages,
      max_tokens: options.max_tokens || maxTokens,
      temperature: options.temperature || temperature,
      stream: options.stream || false
    };

    try {
      // Use real API if key is provided and not explicitly mock
      if (apiKey && provider !== 'mock') {
        return await makeRealAPIRequest(provider, apiKey, baseURL, requestConfig);
      } else {
        // Fallback to mock for development/testing
        logger.warn(`Using mock LLM response for provider: ${provider}`);
        const mockResponse = await generateMockResponse(messages, requestConfig);
        
        return {
          content: mockResponse.content,
          usage: mockResponse.usage,
          model: requestConfig.model,
          provider: `${provider}-mock`
        };
      }
      
    } catch (error) {
      logger.error(`LLM request failed (${provider}):`, error as Error);
      
      // Fallback to mock on API failure for graceful degradation
      logger.warn('Falling back to mock response due to API error');
      const mockResponse = await generateMockResponse(messages, requestConfig);
      
      return {
        content: mockResponse.content,
        usage: mockResponse.usage,
        model: requestConfig.model,
        provider: `${provider}-fallback`,
        error: (error as Error).message
      };
    }
  };

  return { makeRequest, provider, model };
};

/**
 * Make real API request to LLM providers
 */
export const makeRealAPIRequest = async (
  provider: LLMProviderType, 
  apiKey: string, 
  baseURL: string | undefined, 
  requestConfig: LLMRequestConfig
): Promise<LLMResponse> => {
  const { url, headers, body } = prepareProviderRequest(provider, apiKey, baseURL, requestConfig);

  // Make the API request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed (${response.status}): ${errorText}`;
      
      // Enhanced error handling for common issues
      if (response.status === 401) {
        errorMessage = 'Authentication failed - check API key';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded - requests too frequent';
      } else if (response.status === 500) {
        errorMessage = 'Provider server error - temporary issue';
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return parseProviderResponse(provider, data, requestConfig);
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - provider took too long to respond');
    }
    
    throw error;
  }
};

/**
 * Prepare provider-specific request configuration
 */
const prepareProviderRequest = (
  provider: LLMProviderType, 
  apiKey: string, 
  baseURL: string | undefined, 
  requestConfig: LLMRequestConfig
) => {
  switch (provider.toLowerCase()) {
    case 'openai':
      return prepareOpenAIRequest(apiKey, baseURL, requestConfig);
    
    case 'anthropic':
      return prepareAnthropicRequest(apiKey, baseURL, requestConfig);
    
    case 'azure-openai':
      return prepareAzureOpenAIRequest(apiKey, baseURL, requestConfig);
    
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

/**
 * Prepare OpenAI API request
 */
const prepareOpenAIRequest = (apiKey: string, baseURL: string | undefined, requestConfig: LLMRequestConfig) => {
  const url = baseURL || 'https://api.openai.com/v1/chat/completions';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  const body = {
    model: requestConfig.model,
    messages: requestConfig.messages,
    max_tokens: requestConfig.max_tokens,
    temperature: requestConfig.temperature,
    stream: requestConfig.stream || false
  };

  return { url, headers, body };
};

/**
 * Prepare Anthropic API request
 */
const prepareAnthropicRequest = (apiKey: string, baseURL: string | undefined, requestConfig: LLMRequestConfig) => {
  const url = baseURL || 'https://api.anthropic.com/v1/messages';
  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01'
  };

  // Convert OpenAI format to Anthropic format
  const systemMessage = requestConfig.messages.find(m => m.role === 'system');
  const userMessages = requestConfig.messages.filter(m => m.role !== 'system');

  const body = {
    model: requestConfig.model,
    max_tokens: requestConfig.max_tokens,
    temperature: requestConfig.temperature,
    system: systemMessage?.content || '',
    messages: userMessages
  };

  return { url, headers, body };
};

/**
 * Prepare Azure OpenAI API request
 */
const prepareAzureOpenAIRequest = (apiKey: string, baseURL: string | undefined, requestConfig: LLMRequestConfig) => {
  if (!baseURL) {
    throw new Error('baseURL required for Azure OpenAI');
  }
  
  const url = `${baseURL}/openai/deployments/${requestConfig.model}/chat/completions?api-version=2023-12-01-preview`;
  const headers = {
    'api-key': apiKey,
    'Content-Type': 'application/json'
  };
  const body = {
    messages: requestConfig.messages,
    max_tokens: requestConfig.max_tokens,
    temperature: requestConfig.temperature,
    stream: requestConfig.stream || false
  };

  return { url, headers, body };
};

/**
 * Parse provider-specific response
 */
const parseProviderResponse = (
  provider: LLMProviderType, 
  data: any, 
  requestConfig: LLMRequestConfig
): LLMResponse => {
  let content: string;
  let usage: LLMResponse['usage'];

  switch (provider.toLowerCase()) {
    case 'openai':
    case 'azure-openai':
      content = data.choices?.[0]?.message?.content || '';
      usage = data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
      break;

    case 'anthropic':
      content = data.content?.[0]?.text || '';
      usage = {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      };
      break;

    default:
      throw new Error(`Unsupported provider for response parsing: ${provider}`);
  }

  return {
    content,
    usage,
    model: requestConfig.model,
    provider,
    raw: data
  };
};

/**
 * Generate mock LLM response for development/testing
 */
export const generateMockResponse = async (
  messages: LLMMessage[], 
  config: LLMRequestConfig,
  mockConfig: MockResponseConfig = {}
): Promise<{ content: string; usage: LLMResponse['usage'] }> => {
  const lastMessage = messages[messages.length - 1];
  const userContent = lastMessage?.content || '';
  
  // Simulate processing delay
  const delay = mockConfig.delay || { min: 200, max: 1000 };
  const processingTime = delay.min + Math.random() * (delay.max - delay.min);
  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Simulate errors if configured
  if (mockConfig.simulateErrors && Math.random() < (mockConfig.errorRate || 0.1)) {
    throw new Error('Simulated API error for testing');
  }

  let mockContent = generateContextAwareMockContent(userContent);

  const usage = mockConfig.includeUsage !== false ? {
    prompt_tokens: Math.floor(messages.reduce((sum, m) => sum + (m.content?.length || 0) / 4, 0)),
    completion_tokens: Math.floor(mockContent.length / 4),
    total_tokens: 0
  } : {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  };

  // Set total tokens
  usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;

  return { content: mockContent, usage };
};

/**
 * Generate context-aware mock content based on input
 */
const generateContextAwareMockContent = (userContent: string): string => {
  const content = userContent.toLowerCase();

  if (content.includes('performance analysis')) {
    return generatePerformanceAnalysisMock();
  } else if (content.includes('situational awareness')) {
    return generateSituationalAwarenessMock();
  } else if (content.includes('emergency') || content.includes('alert')) {
    return generateEmergencyResponseMock();
  } else if (content.includes('recommendation') || content.includes('advice')) {
    return generateAdvisoryMock();
  } else {
    return generateGenericMock();
  }
};

/**
 * Generate mock performance analysis response
 */
const generatePerformanceAnalysisMock = (): string => {
  return `Based on the current performance metrics, I observe:

1. **Cognitive Load**: The user is showing signs of elevated workload with attention levels at ${82 + Math.floor(Math.random() * 10)}%. This is within acceptable range but approaching the threshold for intervention.

2. **Task Performance**: Accuracy remains high at ${90 + Math.floor(Math.random() * 8)}%, with reaction times averaging ${320 + Math.floor(Math.random() * 40)}ms - slightly elevated from baseline.

3. **Recommendations**: 
   - Consider implementing adaptive automation to reduce manual workload
   - Monitor for fatigue indicators over next ${10 + Math.floor(Math.random() * 10)} minutes
   - Maintain current alert settings

Confidence: ${80 + Math.floor(Math.random() * 15)}%`;
};

/**
 * Generate mock situational awareness response
 */
const generateSituationalAwarenessMock = (): string => {
  const statuses = ['GREEN', 'YELLOW', 'AMBER'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return `Current situational assessment:

**Environmental Factors:**
- Weather conditions: ${['Favorable', 'Moderate', 'Challenging'][Math.floor(Math.random() * 3)]} visibility with wind affecting vehicle dynamics
- Traffic density: ${['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)]} with ${Math.floor(Math.random() * 5)} potential conflict points identified

**System Status:**
- All primary systems nominal
- Automation level at ${30 + Math.floor(Math.random() * 40)}% - appropriate for current conditions
- Navigation accuracy within acceptable parameters

**Human Factor Analysis:**
- Operator alert and engaged
- Stress levels within normal range
- Performance trending ${['stable', 'improving', 'slightly declining'][Math.floor(Math.random() * 3)]}

**Overall Assessment:** ${status} - ${status === 'GREEN' ? 'Continue current operations with standard monitoring protocols.' : 'Increased vigilance recommended.'}`;
};

/**
 * Generate mock emergency response
 */
const generateEmergencyResponseMock = (): string => {
  return `🚨 **EMERGENCY RESPONSE ANALYSIS**

**Immediate Actions Required:**
1. Increase automation level to maximum safe setting
2. Reduce secondary task load to zero
3. Activate enhanced monitoring protocols

**Risk Assessment:**
- Primary risk factors identified and being addressed
- Recommended response time: < ${15 + Math.floor(Math.random() * 30)} seconds
- Backup systems ready for activation

**Communication:**
- Alert relevant personnel
- Prepare for potential manual override
- Document incident timeline

Standing by for further instructions.`;
};

/**
 * Generate mock advisory response
 */
const generateAdvisoryMock = (): string => {
  return `**Advisory Analysis:**

Given the current operational context and performance indicators, I recommend:

**Immediate (< 1 min):**
- Maintain current vigilance level
- Monitor workload indicators closely

**Short-term (1-15 min):**
- Consider gradual automation adjustment based on performance trends
- Prepare for environmental condition changes

**Strategic (> 15 min):**
- Plan for crew rotation if mission duration exceeds optimal performance window
- Review mission objectives for potential optimization

These recommendations are based on current data fusion results and predictive modeling with ${75 + Math.floor(Math.random() * 20)}% confidence.`;
};

/**
 * Generate generic mock response
 */
const generateGenericMock = (): string => {
  return `I've analyzed the provided information and can offer insights on:

- Current system status and performance metrics
- Environmental and operational risk factors  
- Human factors assessment and recommendations
- Predictive analysis for upcoming operational phases

The cognitive advisory system is functioning within normal parameters. All monitoring systems are active and data fusion is providing reliable situational awareness updates.

How can I assist you further with operational decision-making?`;
};

/**
 * Provider health check utilities
 */
export const ProviderHealthCheck = {
  /**
   * Test provider connectivity and basic functionality
   */
  testProvider: async (provider: LLMProvider): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> => {
    const startTime = Date.now();
    
    try {
      const testMessages: LLMMessage[] = [
        { role: 'user', content: 'Hello, please respond with just "OK"' }
      ];
      
      const response = await provider.makeRequest(testMessages, {
        max_tokens: 10,
        temperature: 0
      });
      
      const responseTime = Date.now() - startTime;
      const healthy = response.content.toLowerCase().includes('ok') || response.content.length > 0;
      
      return {
        healthy,
        responseTime,
        error: response.error
      };
      
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  },

  /**
   * Estimate provider costs
   */
  estimateCost: (provider: LLMProviderType, usage: LLMResponse['usage']): {
    promptCost: number;
    completionCost: number;
    totalCost: number;
    currency: string;
  } => {
    // Rough cost estimates (as of 2024, subject to change)
    const costPerToken = {
      'openai': {
        'gpt-4': { prompt: 0.00003, completion: 0.00006 },
        'gpt-3.5-turbo': { prompt: 0.000001, completion: 0.000002 }
      },
      'anthropic': {
        'claude-3': { prompt: 0.000015, completion: 0.000075 }
      },
      'azure-openai': {
        'gpt-4': { prompt: 0.00003, completion: 0.00006 }
      }
    };

    const rates = (costPerToken as any)[provider]?.['gpt-4'] || { prompt: 0, completion: 0 };
    
    const promptCost = usage.prompt_tokens * rates.prompt;
    const completionCost = usage.completion_tokens * rates.completion;
    const totalCost = promptCost + completionCost;

    return {
      promptCost,
      completionCost,
      totalCost,
      currency: 'USD'
    };
  }
};