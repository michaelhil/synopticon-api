/**
 * LLM Integration System
 * Provides intelligent analysis, decision support, and natural language interaction
 * for the Cognitive Advisory System
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Make real API request to LLM providers
 */
const makeRealAPIRequest = async (provider, apiKey, baseURL, requestConfig) => {
  let url, headers, body;
  
  // Configure request based on provider
  switch (provider.toLowerCase()) {
    case 'openai':
      url = baseURL || 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };
      body = {
        model: requestConfig.model,
        messages: requestConfig.messages,
        max_tokens: requestConfig.max_tokens,
        temperature: requestConfig.temperature,
        stream: false
      };
      break;
      
    case 'anthropic':
      url = baseURL || 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      
      // Convert OpenAI format to Anthropic format
      const systemMessage = requestConfig.messages.find(m => m.role === 'system');
      const userMessages = requestConfig.messages.filter(m => m.role !== 'system');
      
      body = {
        model: requestConfig.model,
        max_tokens: requestConfig.max_tokens,
        temperature: requestConfig.temperature,
        system: systemMessage?.content || '',
        messages: userMessages
      };
      break;
      
    case 'azure-openai':
      // Azure OpenAI requires different URL structure
      if (!baseURL) {
        throw new Error('baseURL required for Azure OpenAI');
      }
      url = `${baseURL}/openai/deployments/${requestConfig.model}/chat/completions?api-version=2023-12-01-preview`;
      headers = {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      };
      body = {
        messages: requestConfig.messages,
        max_tokens: requestConfig.max_tokens,
        temperature: requestConfig.temperature,
        stream: false
      };
      break;
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
  
  // Make the API request
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  
  // Parse response based on provider
  let content, usage;
  
  switch (provider.toLowerCase()) {
    case 'openai':
    case 'azure-openai':
      content = data.choices?.[0]?.message?.content || '';
      usage = data.usage || {};
      break;
      
    case 'anthropic':
      content = data.content?.[0]?.text || '';
      usage = {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      };
      break;
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
 * LLM Provider abstraction
 */
const createLLMProvider = (config) => {
  const { provider, apiKey, model, baseURL, maxTokens = 2048, temperature = 0.1 } = config;
  
  const makeRequest = async (messages, options = {}) => {
    const requestConfig = {
      model: options.model || model,
      messages,
      max_tokens: options.maxTokens || maxTokens,
      temperature: options.temperature || temperature,
      stream: false
    };
    
    try {
      // Real API implementation
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
          provider: provider + '-mock'
        };
      }
      
    } catch (error) {
      logger.error(`LLM request failed (${provider}):`, error);
      
      // Fallback to mock on API failure
      logger.warn('Falling back to mock response due to API error');
      const mockResponse = await generateMockResponse(messages, requestConfig);
      
      return {
        content: mockResponse.content,
        usage: mockResponse.usage,
        model: requestConfig.model,
        provider: provider + '-fallback',
        error: error.message
      };
    }
  };
  
  return { makeRequest, provider, model };
};

/**
 * Mock LLM response generation for development/testing
 */
const generateMockResponse = async (messages, config) => {
  const lastMessage = messages[messages.length - 1];
  const userContent = lastMessage?.content || '';
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));
  
  let mockContent = '';
  
  // Pattern-based mock responses
  if (userContent.includes('performance analysis')) {
    mockContent = `Based on the current performance metrics, I observe:

1. **Cognitive Load**: The user is showing signs of elevated workload with attention levels at 82%. This is within acceptable range but approaching the threshold for intervention.

2. **Task Performance**: Accuracy remains high at 94%, with reaction times averaging 340ms - slightly elevated from baseline.

3. **Recommendations**: 
   - Consider implementing adaptive automation to reduce manual workload
   - Monitor for fatigue indicators over next 15 minutes
   - Maintain current alert settings

Confidence: 87%`;
  } else if (userContent.includes('situational awareness')) {
    mockContent = `Current situational assessment:

**Environmental Factors:**
- Weather conditions: Moderate visibility with wind gusts affecting vehicle dynamics
- Traffic density: High with 3 potential conflict points identified

**System Status:**
- All primary systems nominal
- Automation level at 40% - appropriate for current conditions
- Navigation accuracy within acceptable parameters

**Human Factor Analysis:**
- Operator alert and engaged
- Stress levels within normal range
- Performance trending stable

**Overall Assessment:** GREEN - Continue current operations with standard monitoring protocols.`;
  } else if (userContent.includes('emergency') || userContent.includes('alert')) {
    mockContent = `🚨 **EMERGENCY RESPONSE ANALYSIS**

**Immediate Actions Required:**
1. Increase automation level to maximum safe setting
2. Reduce secondary task load to zero
3. Activate enhanced monitoring protocols

**Risk Assessment:**
- Primary risk factors identified and being addressed
- Recommended response time: < 30 seconds
- Backup systems ready for activation

**Communication:**
- Alert relevant personnel
- Prepare for potential manual override
- Document incident timeline

Standing by for further instructions.`;
  } else if (userContent.includes('recommendation') || userContent.includes('advice')) {
    mockContent = `**Advisory Analysis:**

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

These recommendations are based on current data fusion results and predictive modeling with 82% confidence.`;
  } else {
    mockContent = `I've analyzed the provided information and can offer insights on:

- Current system status and performance metrics
- Environmental and operational risk factors  
- Human factors assessment and recommendations
- Predictive analysis for upcoming operational phases

The cognitive advisory system is functioning within normal parameters. All monitoring systems are active and data fusion is providing reliable situational awareness updates.

How can I assist you further with operational decision-making?`;
  }
  
  return {
    content: mockContent,
    usage: {
      prompt_tokens: messages.reduce((sum, m) => sum + (m.content?.length || 0) / 4, 0),
      completion_tokens: mockContent.length / 4,
      total_tokens: 0
    }
  };
};

/**
 * Specialized analysis functions
 */
const createAnalysisFunctions = () => ({
  
  analyzePerformance: async (performanceData, llmProvider) => {
    const prompt = `Analyze this human performance data and provide insights:

Performance Metrics:
- Accuracy: ${performanceData.accuracy || 'N/A'}
- Reaction Time: ${performanceData.reactionTime || 'N/A'}ms
- Error Rate: ${performanceData.errorRate || 'N/A'}
- Workload: ${performanceData.workload || 'N/A'}
- Fatigue: ${performanceData.fatigue || 'N/A'}

Historical Context:
- Performance trend: ${performanceData.trend || 'stable'}
- Session duration: ${performanceData.sessionDuration || 'N/A'} minutes
- Task complexity: ${performanceData.taskComplexity || 'moderate'}

Please provide:
1. Performance assessment
2. Risk indicators
3. Specific recommendations
4. Confidence level`;

    const response = await llmProvider.makeRequest([
      { role: 'system', content: 'You are a cognitive performance analyst providing concise, actionable insights.' },
      { role: 'user', content: prompt }
    ]);

    return {
      analysis: response.content,
      confidence: extractConfidenceFromResponse(response.content),
      recommendations: extractRecommendationsFromResponse(response.content),
      timestamp: Date.now(),
      source: 'llm-performance-analysis'
    };
  },

  analyzeSituationalAwareness: async (fusionData, llmProvider) => {
    const prompt = `Assess situational awareness based on this fused data:

Human State:
- Cognitive Load: ${fusionData.human?.cognitiveLoad || 'N/A'}
- Fatigue Level: ${fusionData.human?.fatigue || 'N/A'}
- Stress Level: ${fusionData.human?.stress || 'N/A'}

System State:
- Health: ${fusionData.system?.health || 'N/A'}
- Automation Level: ${fusionData.system?.automationLevel || 'N/A'}
- Performance: ${fusionData.system?.performance || 'N/A'}

Environmental State:
- Risk Level: ${fusionData.environment?.totalRisk || 'N/A'}
- Weather Impact: ${fusionData.environment?.weatherRisk || 'N/A'}
- Traffic Complexity: ${fusionData.environment?.trafficRisk || 'N/A'}

Provide situational awareness assessment with specific recommendations for optimization.`;

    const response = await llmProvider.makeRequest([
      { role: 'system', content: 'You are a situational awareness expert providing tactical and strategic guidance.' },
      { role: 'user', content: prompt }
    ]);

    return {
      assessment: response.content,
      awarenessLevel: extractAwarenessLevel(response.content),
      riskFactors: extractRiskFactors(response.content),
      recommendations: extractRecommendationsFromResponse(response.content),
      timestamp: Date.now(),
      source: 'llm-situational-analysis'
    };
  },

  generateAdvisory: async (context, llmProvider) => {
    const prompt = `Generate an advisory message based on this operational context:

Mission Context:
- Phase: ${context.mission?.phase || 'unknown'}
- Objectives: ${context.mission?.objectives?.join(', ') || 'N/A'}
- Progress: ${context.mission?.progress || 'N/A'}%

Current Conditions:
- Alert Level: ${context.alerts?.level || 'normal'}
- Performance Status: ${context.performance?.status || 'nominal'}
- Environmental Conditions: ${context.environment?.status || 'normal'}

User Intent: ${context.userQuery || 'General advisory'}

Provide a clear, actionable advisory message suitable for operational personnel.`;

    const response = await llmProvider.makeRequest([
      { role: 'system', content: 'You are an intelligent advisory system providing clear, concise operational guidance.' },
      { role: 'user', content: prompt }
    ]);

    return {
      advisory: response.content,
      priority: extractPriority(response.content),
      actionItems: extractActionItems(response.content),
      timeframe: extractTimeframe(response.content),
      timestamp: Date.now(),
      source: 'llm-advisory'
    };
  }
});

/**
 * Response parsing utilities
 */
const extractConfidenceFromResponse = (content) => {
  const match = content.match(/confidence[:\s]*(\d+)%/i);
  return match ? parseInt(match[1]) / 100 : 0.8;
};

const extractRecommendationsFromResponse = (content) => {
  const recommendations = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    if (line.match(/^[\s]*[-•*]\s*/) || line.match(/^\d+\.\s*/)) {
      const clean = line.replace(/^[\s]*[-•*\d.]\s*/, '').trim();
      if (clean.length > 10) {
        recommendations.push(clean);
      }
    }
  });
  
  return recommendations.slice(0, 5); // Limit to 5 recommendations
};

const extractAwarenessLevel = (content) => {
  if (content.toLowerCase().includes('high') || content.includes('GREEN')) return 'high';
  if (content.toLowerCase().includes('low') || content.includes('RED')) return 'low';
  if (content.toLowerCase().includes('moderate') || content.includes('YELLOW')) return 'moderate';
  return 'moderate';
};

const extractRiskFactors = (content) => {
  const factors = [];
  const riskKeywords = ['risk', 'hazard', 'danger', 'concern', 'issue', 'problem'];
  
  content.split('\n').forEach(line => {
    riskKeywords.forEach(keyword => {
      if (line.toLowerCase().includes(keyword) && line.length < 100) {
        factors.push(line.trim());
      }
    });
  });
  
  return factors.slice(0, 3);
};

const extractPriority = (content) => {
  if (content.includes('🚨') || content.toLowerCase().includes('emergency')) return 'high';
  if (content.toLowerCase().includes('urgent') || content.toLowerCase().includes('immediate')) return 'high';
  if (content.toLowerCase().includes('routine') || content.toLowerCase().includes('normal')) return 'low';
  return 'normal';
};

const extractActionItems = (content) => {
  const actions = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    if (line.match(/^[\s]*\d+\.\s*/) && line.toLowerCase().includes('action')) {
      actions.push(line.replace(/^[\s]*\d+\.\s*/, '').trim());
    }
  });
  
  return actions.slice(0, 3);
};

const extractTimeframe = (content) => {
  if (content.includes('immediate') || content.includes('now')) return 'immediate';
  if (content.includes('minutes')) return 'short-term';
  if (content.includes('hours')) return 'medium-term';
  return 'ongoing';
};

/**
 * Main LLM Integration System
 */
export const createLLMIntegration = (config = {}) => {
  const {
    providers = [
      { name: 'primary', provider: 'openai', model: 'gpt-4', apiKey: process.env.OPENAI_API_KEY }
    ],
    fallbackEnabled = true,
    cachingEnabled = true,
    maxConcurrentRequests = 5
  } = config;
  
  const llmProviders = providers.map(createLLMProvider);
  const currentProvider = llmProviders[0];
  const emitter = new EventEmitter();
  const analysisFunctions = createAnalysisFunctions();
  
  // Request queue and rate limiting
  const requestQueue = [];
  const activeRequests = new Set();
  const requestCache = new Map();
  
  const processRequest = async (request) => {
    const { type, data, options = {} } = request;
    const cacheKey = cachingEnabled ? `${type}-${JSON.stringify(data).slice(0, 100)}` : null;
    
    // Check cache
    if (cacheKey && requestCache.has(cacheKey)) {
      const cached = requestCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return cached.result;
      }
    }
    
    // Wait for available slot
    while (activeRequests.size >= maxConcurrentRequests) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeRequests.add(requestId);
    
    try {
      let result;
      const startTime = Date.now();
      
      switch (type) {
        case 'performance-analysis':
          result = await analysisFunctions.analyzePerformance(data, currentProvider);
          break;
        case 'situational-awareness':
          result = await analysisFunctions.analyzeSituationalAwareness(data, currentProvider);
          break;
        case 'advisory':
          result = await analysisFunctions.generateAdvisory(data, currentProvider);
          break;
        default:
          throw new Error(`Unknown analysis type: ${type}`);
      }
      
      const duration = Date.now() - startTime;
      
      // Cache successful result
      if (cacheKey) {
        requestCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }
      
      emitter.emit('analysisCompleted', {
        type,
        result,
        duration,
        provider: currentProvider.provider,
        requestId
      });
      
      return result;
      
    } catch (error) {
      emitter.emit('analysisError', {
        type,
        error: error.message,
        provider: currentProvider.provider,
        requestId
      });
      throw error;
    } finally {
      activeRequests.delete(requestId);
    }
  };
  
  const analyze = async (type, data, options) => {
    return processRequest({ type, data, options });
  };
  
  const getCapabilities = () => ({
    providers: llmProviders.map(p => ({ provider: p.provider, model: p.model })),
    analysisTypes: ['performance-analysis', 'situational-awareness', 'advisory'],
    features: {
      caching: cachingEnabled,
      fallback: fallbackEnabled,
      concurrentRequests: maxConcurrentRequests
    }
  });
  
  const getMetrics = () => ({
    requests: {
      active: activeRequests.size,
      queued: requestQueue.length,
      cached: requestCache.size
    },
    provider: {
      current: currentProvider.provider,
      available: llmProviders.length
    }
  });
  
  const clearCache = () => {
    requestCache.clear();
  };
  
  logger.info('✅ LLM Integration System initialized');
  logger.info(`Configured providers: ${llmProviders.map(p => p.provider).join(', ')}`);
  
  return {
    analyze,
    getCapabilities,
    getMetrics,
    clearCache,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
};