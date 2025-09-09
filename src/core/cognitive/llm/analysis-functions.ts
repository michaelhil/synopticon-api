/**
 * @fileoverview LLM Analysis Functions
 * 
 * Specialized analysis functions for performance assessment, situational awareness,
 * and advisory generation using Large Language Models with structured prompting.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  AnalysisFunctions,
  AnalysisFunctionsFactory,
  LLMProvider,
  PerformanceData,
  FusionData,
  AdvisoryContext,
  PerformanceAnalysisResult,
  SituationalAwarenessResult,
  AdvisoryResult,
  AnalysisPrompts
} from './types.js';

/**
 * Create analysis functions with structured prompting
 */
export const createAnalysisFunctions: AnalysisFunctionsFactory = (): AnalysisFunctions => {
  
  /**
   * Analyze human performance data with cognitive insights
   */
  const analyzePerformance = async (
    performanceData: PerformanceData, 
    llmProvider: LLMProvider
  ): Promise<PerformanceAnalysisResult> => {
    const prompt = buildPerformanceAnalysisPrompt(performanceData);
    
    const response = await llmProvider.makeRequest([
      { 
        role: 'system', 
        content: ANALYSIS_PROMPTS.performance.system
      },
      { 
        role: 'user', 
        content: prompt 
      }
    ], {
      max_tokens: 800,
      temperature: 0.1
    });

    return {
      analysis: response.content,
      confidence: extractConfidenceFromResponse(response.content),
      recommendations: extractRecommendationsFromResponse(response.content),
      timestamp: Date.now(),
      source: 'llm-performance-analysis'
    };
  };

  /**
   * Analyze situational awareness from fused data
   */
  const analyzeSituationalAwareness = async (
    fusionData: FusionData, 
    llmProvider: LLMProvider
  ): Promise<SituationalAwarenessResult> => {
    const prompt = buildSituationalAwarenessPrompt(fusionData);
    
    const response = await llmProvider.makeRequest([
      { 
        role: 'system', 
        content: ANALYSIS_PROMPTS.situationalAwareness.system
      },
      { 
        role: 'user', 
        content: prompt 
      }
    ], {
      max_tokens: 1000,
      temperature: 0.2
    });

    return {
      assessment: response.content,
      awarenessLevel: extractAwarenessLevel(response.content),
      riskFactors: extractRiskFactors(response.content),
      recommendations: extractRecommendationsFromResponse(response.content),
      timestamp: Date.now(),
      source: 'llm-situational-analysis'
    };
  };

  /**
   * Generate advisory based on operational context
   */
  const generateAdvisory = async (
    context: AdvisoryContext, 
    llmProvider: LLMProvider
  ): Promise<AdvisoryResult> => {
    const prompt = buildAdvisoryPrompt(context);
    
    const response = await llmProvider.makeRequest([
      { 
        role: 'system', 
        content: ANALYSIS_PROMPTS.advisory.system
      },
      { 
        role: 'user', 
        content: prompt 
      }
    ], {
      max_tokens: 600,
      temperature: 0.3
    });

    return {
      advisory: response.content,
      priority: extractPriority(response.content),
      actionItems: extractActionItems(response.content),
      timeframe: extractTimeframe(response.content),
      timestamp: Date.now(),
      source: 'llm-advisory'
    };
  };

  return {
    analyzePerformance,
    analyzeSituationalAwareness,
    generateAdvisory
  };
};

/**
 * Structured analysis prompts for consistent LLM responses
 */
const ANALYSIS_PROMPTS: AnalysisPrompts = {
  performance: {
    system: `You are a cognitive performance analyst with expertise in human factors engineering. 
Provide concise, actionable insights based on performance metrics. Structure your response with:
1. Performance Assessment (current state)
2. Risk Indicators (potential issues)
3. Specific Recommendations (actionable steps)
4. Confidence Level (as percentage)

Keep responses under 300 words and focus on practical implications.`,
    
    template: `Analyze this human performance data and provide insights:

Performance Metrics:
{metrics}

Historical Context:
{context}

Please provide:
1. Performance assessment
2. Risk indicators
3. Specific recommendations
4. Confidence level`
  },

  situationalAwareness: {
    system: `You are a situational awareness expert providing tactical and strategic guidance. 
Analyze multi-modal data to assess overall operational readiness. Structure your response with:
1. Situational Assessment (current state)
2. Risk Factors (potential threats/challenges)
3. Recommendations (tactical and strategic)
4. Overall Status (GREEN/YELLOW/RED)

Focus on actionable intelligence and maintain operational security awareness.`,
    
    template: `Assess situational awareness based on this fused data:

Human State:
{humanState}

System State:
{systemState}

Environmental State:
{environmentState}

Provide situational awareness assessment with specific recommendations for optimization.`
  },

  advisory: {
    system: `You are an intelligent advisory system providing clear, concise operational guidance.
Generate advisories that are:
1. Clear and actionable
2. Prioritized by urgency
3. Contextually appropriate
4. Operationally sound

Structure responses with immediate actions, short-term planning, and strategic considerations.`,
    
    template: `Generate an advisory message based on this operational context:

Mission Context:
{missionContext}

Current Conditions:
{conditions}

User Intent: {userQuery}

Provide a clear, actionable advisory message suitable for operational personnel.`
  }
};

/**
 * Build performance analysis prompt with structured data
 */
const buildPerformanceAnalysisPrompt = (data: PerformanceData): string => {
  const metricsSection = [
    `- Accuracy: ${formatMetric(data.accuracy, 'percentage')}`,
    `- Reaction Time: ${formatMetric(data.reactionTime, 'milliseconds')}`,
    `- Error Rate: ${formatMetric(data.errorRate, 'percentage')}`,
    `- Workload: ${formatMetric(data.workload, 'scale')}`,
    `- Fatigue: ${formatMetric(data.fatigue, 'scale')}`
  ].join('\n');

  const contextSection = [
    `- Performance trend: ${data.trend || 'stable'}`,
    `- Session duration: ${data.sessionDuration || 'N/A'} minutes`,
    `- Task complexity: ${data.taskComplexity || 'moderate'}`
  ].join('\n');

  return ANALYSIS_PROMPTS.performance.template
    .replace('{metrics}', metricsSection)
    .replace('{context}', contextSection);
};

/**
 * Build situational awareness prompt with structured data
 */
const buildSituationalAwarenessPrompt = (data: FusionData): string => {
  const humanSection = data.human ? [
    `- Cognitive Load: ${formatMetric(data.human.cognitiveLoad, 'scale')}`,
    `- Fatigue Level: ${formatMetric(data.human.fatigue, 'scale')}`,
    `- Stress Level: ${formatMetric(data.human.stress, 'scale')}`
  ].join('\n') : 'Not available';

  const systemSection = data.system ? [
    `- Health: ${formatMetric(data.system.health, 'percentage')}`,
    `- Automation Level: ${formatMetric(data.system.automationLevel, 'percentage')}`,
    `- Performance: ${formatMetric(data.system.performance, 'scale')}`
  ].join('\n') : 'Not available';

  const environmentSection = data.environment ? [
    `- Risk Level: ${formatMetric(data.environment.totalRisk, 'scale')}`,
    `- Weather Impact: ${formatMetric(data.environment.weatherRisk, 'scale')}`,
    `- Traffic Complexity: ${formatMetric(data.environment.trafficRisk, 'scale')}`
  ].join('\n') : 'Not available';

  return ANALYSIS_PROMPTS.situationalAwareness.template
    .replace('{humanState}', humanSection)
    .replace('{systemState}', systemSection)
    .replace('{environmentState}', environmentSection);
};

/**
 * Build advisory prompt with operational context
 */
const buildAdvisoryPrompt = (context: AdvisoryContext): string => {
  const missionSection = context.mission ? [
    `- Phase: ${context.mission.phase || 'unknown'}`,
    `- Objectives: ${context.mission.objectives?.join(', ') || 'N/A'}`,
    `- Progress: ${context.mission.progress || 'N/A'}%`
  ].join('\n') : 'Not specified';

  const conditionsSection = [
    `- Alert Level: ${context.alerts?.level || 'normal'}`,
    `- Performance Status: ${context.performance?.status || 'nominal'}`,
    `- Environmental Conditions: ${context.environment?.status || 'normal'}`
  ].join('\n');

  return ANALYSIS_PROMPTS.advisory.template
    .replace('{missionContext}', missionSection)
    .replace('{conditions}', conditionsSection)
    .replace('{userQuery}', context.userQuery || 'General advisory');
};

/**
 * Format metric values for display in prompts
 */
const formatMetric = (value: unknown, type: 'percentage' | 'milliseconds' | 'scale'): string => {
  if (value === undefined || value === null) return 'N/A';
  if (typeof value !== 'number') return String(value);

  switch (type) {
    case 'percentage':
      return `${(value * 100).toFixed(0)}%`;
    case 'milliseconds':
      return `${value.toFixed(0)}ms`;
    case 'scale':
      return `${(value * 100).toFixed(0)}% (0-100 scale)`;
    default:
      return String(value);
  }
};

/**
 * Extract confidence level from LLM response
 */
export const extractConfidenceFromResponse = (content: string): number => {
  // Look for confidence patterns
  const patterns = [
    /confidence[:\s]*(\d+)%/i,
    /(\d+)%\s*confidence/i,
    /confidence[:\s]*(\d+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      return Math.min(1, Math.max(0, value > 1 ? value / 100 : value));
    }
  }

  // Default confidence based on response length and structure
  if (content.length > 200 && content.includes('recommendation')) {
    return 0.8;
  }
  
  return 0.7; // Default moderate confidence
};

/**
 * Extract recommendations from LLM response
 */
export const extractRecommendationsFromResponse = (content: string): string[] => {
  const recommendations: string[] = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    // Match various list formats
    const patterns = [
      /^[\s]*[-•*]\s*(.+)$/,           // Bullet points
      /^[\s]*\d+\.\s*(.+)$/,          // Numbered lists
      /^[\s]*[►▶→]\s*(.+)$/,          // Arrow points
      /^[\s]*Recommendation:\s*(.+)$/i // Explicit recommendations
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const recommendation = match[1].trim();
        if (recommendation.length > 10 && recommendation.length < 200) {
          recommendations.push(recommendation);
        }
        break;
      }
    }
  });
  
  return recommendations.slice(0, 5); // Limit to 5 recommendations
};

/**
 * Extract situational awareness level from response
 */
export const extractAwarenessLevel = (content: string): 'low' | 'moderate' | 'high' => {
  const contentLower = content.toLowerCase();
  
  // Explicit level indicators
  if (contentLower.includes('high awareness') || content.includes('GREEN')) return 'high';
  if (contentLower.includes('low awareness') || content.includes('RED')) return 'low';
  if (contentLower.includes('moderate awareness') || content.includes('YELLOW')) return 'moderate';
  
  // Contextual indicators
  if (contentLower.includes('excellent') || contentLower.includes('optimal')) return 'high';
  if (contentLower.includes('poor') || contentLower.includes('degraded')) return 'low';
  if (contentLower.includes('acceptable') || contentLower.includes('adequate')) return 'moderate';
  
  return 'moderate'; // Default
};

/**
 * Extract risk factors from response
 */
export const extractRiskFactors = (content: string): string[] => {
  const factors: string[] = [];
  const riskKeywords = [
    'risk', 'hazard', 'danger', 'threat', 'concern', 'issue', 'problem', 
    'vulnerability', 'weakness', 'alert', 'warning'
  ];
  
  const lines = content.split('\n');
  
  lines.forEach(line => {
    const lineLower = line.toLowerCase();
    
    // Check if line contains risk-related keywords
    const hasRiskKeyword = riskKeywords.some(keyword => lineLower.includes(keyword));
    
    if (hasRiskKeyword && line.length > 20 && line.length < 150) {
      // Clean up the line
      const cleaned = line
        .replace(/^[\s]*[-•*\d.]\s*/, '')  // Remove list markers
        .replace(/^[\s]*\**\s*/, '')       // Remove asterisks
        .trim();
      
      if (cleaned.length > 10) {
        factors.push(cleaned);
      }
    }
  });
  
  return factors.slice(0, 3); // Limit to top 3 risk factors
};

/**
 * Extract priority level from response
 */
export const extractPriority = (content: string): 'low' | 'normal' | 'high' => {
  const contentLower = content.toLowerCase();
  
  // High priority indicators
  if (content.includes('🚨') || contentLower.includes('emergency')) return 'high';
  if (contentLower.includes('urgent') || contentLower.includes('immediate')) return 'high';
  if (contentLower.includes('critical') || contentLower.includes('priority')) return 'high';
  
  // Low priority indicators
  if (contentLower.includes('routine') || contentLower.includes('when convenient')) return 'low';
  if (contentLower.includes('low priority') || contentLower.includes('optional')) return 'low';
  
  return 'normal'; // Default
};

/**
 * Extract action items from response
 */
export const extractActionItems = (content: string): string[] => {
  const actions: string[] = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    // Look for action-oriented language
    const actionPatterns = [
      /^[\s]*\d+\.\s*(.+action.+)$/i,
      /^[\s]*[-•*]\s*(.+(?:implement|activate|execute|perform|conduct).+)$/i,
      /^[\s]*(?:action|step|task):\s*(.+)$/i
    ];

    for (const pattern of actionPatterns) {
      const match = line.match(pattern);
      if (match) {
        const action = match[1].trim();
        if (action.length > 15 && action.length < 150) {
          actions.push(action);
        }
        break;
      }
    }
  });
  
  return actions.slice(0, 3); // Limit to 3 action items
};

/**
 * Extract timeframe from response
 */
export const extractTimeframe = (content: string): 'immediate' | 'short-term' | 'medium-term' | 'ongoing' => {
  const contentLower = content.toLowerCase();
  
  // Immediate timeframe
  if (contentLower.includes('immediate') || contentLower.includes('now') || contentLower.includes('asap')) {
    return 'immediate';
  }
  
  // Short-term timeframe
  if (contentLower.includes('minutes') || contentLower.includes('short-term') || contentLower.includes('< 1 hour')) {
    return 'short-term';
  }
  
  // Medium-term timeframe
  if (contentLower.includes('hours') || contentLower.includes('medium-term') || contentLower.includes('today')) {
    return 'medium-term';
  }
  
  return 'ongoing'; // Default
};

/**
 * Response quality assessment utilities
 */
export const ResponseQuality = {
  /**
   * Assess the quality of an LLM response
   */
  assessQuality: (content: string, expectedLength = 200): {
    score: number;
    factors: Record<string, number>;
    issues: string[];
  } => {
    const factors = {
      length: Math.min(1, content.length / expectedLength),
      structure: content.includes('\n') && content.includes('-') ? 1 : 0.5,
      completeness: content.includes('recommendation') ? 1 : 0.7,
      clarity: content.split('.').length > 2 ? 1 : 0.6,
      specificity: /\d+%/.test(content) ? 1 : 0.8
    };

    const issues: string[] = [];
    if (factors.length < 0.5) issues.push('Response too short');
    if (factors.structure < 0.8) issues.push('Poor structure');
    if (factors.completeness < 0.8) issues.push('Missing recommendations');

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;

    return { score, factors, issues };
  },

  /**
   * Validate response format
   */
  validateFormat: (content: string, expectedElements: string[]): {
    valid: boolean;
    missing: string[];
  } => {
    const contentLower = content.toLowerCase();
    const missing: string[] = [];

    expectedElements.forEach(element => {
      if (!contentLower.includes(element.toLowerCase())) {
        missing.push(element);
      }
    });

    return {
      valid: missing.length === 0,
      missing
    };
  }
};