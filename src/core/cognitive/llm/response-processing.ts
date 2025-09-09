/**
 * @fileoverview Response Processing Utilities
 * 
 * Advanced utilities for parsing, validating, and processing LLM responses
 * with structured extraction and quality assessment capabilities.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type { ResponseParsers } from './types.js';

/**
 * Advanced response parsing utilities
 */
export const createResponseParsers = (): ResponseParsers => {
  
  /**
   * Extract confidence level with multiple pattern matching
   */
  const extractConfidence = (content: string): number => {
    // Enhanced confidence extraction patterns
    const patterns = [
      /confidence[:\s]*(\d+(?:\.\d+)?)%/i,
      /(\d+(?:\.\d+)?)%\s*confidence/i,
      /confidence[:\s]*(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*(?:100|10|1)/i,
      /certainty[:\s]*(\d+(?:\.\d+)?)%/i,
      /reliability[:\s]*(\d+(?:\.\d+)?)%/i,
      /accuracy[:\s]*(\d+(?:\.\d+)?)%/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        let value = parseFloat(match[1]);
        
        // Normalize based on scale
        if (value > 1) {
          value = value / 100; // Convert percentage to decimal
        }
        
        return Math.min(1, Math.max(0, value));
      }
    }

    // Contextual confidence assessment
    return assessContextualConfidence(content);
  };

  /**
   * Extract recommendations with advanced parsing
   */
  const extractRecommendations = (content: string): string[] => {
    const recommendations: string[] = [];
    const lines = content.split('\n');

    
    // Enhanced recommendation patterns
    const patterns = [
      /^[\s]*[-•*►▶→]\s*(.+)$/,                    // Various bullet points
      /^[\s]*\d+\.\s*(.+)$/,                      // Numbered lists
      /^[\s]*[a-z]\)\s*(.+)$/i,                   // Lettered lists
      /^[\s]*(?:recommendation|suggest|advise)[:\s]*(.+)$/i, // Explicit recommendations
      /^[\s]*(?:action|step|task)[:\s]*(.+)$/i,   // Action items
      /^[\s]*consider[:\s]*(.+)$/i,               // Considerations
      /^[\s]*should[:\s]*(.+)$/i                  // Shoulds
    ];

    lines.forEach(line => {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const recommendation = cleanRecommendationText(match[1]);
          if (isValidRecommendation(recommendation)) {
            recommendations.push(recommendation);
          }
          break;
        }
      }
    });

    // Extract recommendations from sections
    const sectionRecommendations = extractSectionRecommendations(content);
    recommendations.push(...sectionRecommendations);
    
    return deduplicateRecommendations(recommendations).slice(0, 5);
  };

  /**
   * Extract situational awareness level with contextual analysis
   */
  const extractAwarenessLevel = (content: string): 'low' | 'moderate' | 'high' => {
    const contentLower = content.toLowerCase();
    
    // Explicit indicators
    const highIndicators = [
      'high awareness', 'excellent situational', 'optimal awareness', 
      'green', 'fully aware', 'comprehensive understanding'
    ];
    
    const lowIndicators = [
      'low awareness', 'poor situational', 'degraded awareness',
      'red', 'limited awareness', 'insufficient understanding'
    ];
    
    const moderateIndicators = [
      'moderate awareness', 'adequate situational', 'acceptable awareness',
      'yellow', 'amber', 'partial awareness'
    ];

    // Check for explicit indicators
    for (const indicator of highIndicators) {
      if (contentLower.includes(indicator)) return 'high';
    }
    
    for (const indicator of lowIndicators) {
      if (contentLower.includes(indicator)) return 'low';
    }
    
    for (const indicator of moderateIndicators) {
      if (contentLower.includes(indicator)) return 'moderate';
    }

    // Contextual assessment based on content quality and detail
    const score = assessAwarenessScore(content);
    if (score >= 0.7) return 'high';
    if (score <= 0.4) return 'low';
    return 'moderate';
  };

  /**
   * Extract risk factors with categorization
   */
  const extractRiskFactors = (content: string): string[] => {
    const factors: string[] = [];
    const lines = content.split('\n');

    
    const riskCategories = {
      technical: ['system', 'equipment', 'technical', 'hardware', 'software'],
      human: ['fatigue', 'stress', 'workload', 'attention', 'performance'],
      environmental: ['weather', 'visibility', 'traffic', 'terrain', 'conditions'],
      operational: ['procedure', 'protocol', 'mission', 'objective', 'timeline']
    };

    const riskKeywords = [
      'risk', 'hazard', 'danger', 'threat', 'concern', 'issue', 'problem',
      'vulnerability', 'weakness', 'alert', 'warning', 'critical', 'failure'
    ];
    
    lines.forEach(line => {
      const lineLower = line.toLowerCase();
      
      // Check for risk keywords
      const hasRiskKeyword = riskKeywords.some(keyword => lineLower.includes(keyword));
      
      if (hasRiskKeyword && line.length > 15 && line.length < 200) {
        const cleaned = cleanRiskFactorText(line);
        if (cleaned.length > 10) {
          // Categorize and add risk factor
          const category = categorizeRiskFactor(cleaned, riskCategories);
          const formattedFactor = category ? `${category}: ${cleaned}` : cleaned;
          factors.push(formattedFactor);
        }
      }
    });
    
    return deduplicateAndRankRiskFactors(factors).slice(0, 3);
  };

  /**
   * Extract priority with enhanced classification
   */
  const extractPriority = (content: string): 'low' | 'normal' | 'high' => {
    const contentLower = content.toLowerCase();
    
    // High priority indicators
    const highPriorityPatterns = [
      /🚨|emergency|urgent|immediate|critical|asap|now/i,
      /high\s+priority|priority:\s*high/i,
      /action\s+required|immediate\s+attention/i
    ];

    // Low priority indicators  
    const lowPriorityPatterns = [
      /routine|when\s+convenient|low\s+priority|optional/i,
      /priority:\s*low|non-urgent|defer/i
    ];

    for (const pattern of highPriorityPatterns) {
      if (pattern.test(content)) return 'high';
    }

    for (const pattern of lowPriorityPatterns) {
      if (pattern.test(content)) return 'low';
    }

    // Contextual priority assessment
    const urgencyScore = assessUrgencyScore(content);
    if (urgencyScore >= 0.7) return 'high';
    if (urgencyScore <= 0.3) return 'low';
    
    return 'normal';
  };

  /**
   * Extract action items with categorization
   */
  const extractActionItems = (content: string): string[] => {
    const actions: string[] = [];
    const lines = content.split('\n');

    
    const actionPatterns = [
      /^[\s]*\d+\.\s*(.+(?:implement|activate|execute|perform|conduct|initiate).+)$/i,
      /^[\s]*[-•*]\s*(.+(?:action|step|task).+)$/i,
      /^[\s]*(?:immediate|short-term|long-term)[:\s]*(.+)$/i,
      /^[\s]*action\s+(?:item|required)[:\s]*(.+)$/i
    ];

    lines.forEach(line => {
      for (const pattern of actionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const action = cleanActionItemText(match[1]);
          if (isValidActionItem(action)) {
            actions.push(action);
          }
          break;
        }
      }
    });

    // Extract actions from structured sections
    const sectionActions = extractSectionActionItems(content);
    actions.push(...sectionActions);
    
    return deduplicateActionItems(actions).slice(0, 3);
  };

  /**
   * Extract timeframe with enhanced parsing
   */
  const extractTimeframe = (content: string): 'immediate' | 'short-term' | 'medium-term' | 'ongoing' => {
    const contentLower = content.toLowerCase();
    
    const timeframePatterns = {
      immediate: [
        /immediate|now|asap|urgent|emergency|< ?\d+\s*(?:sec|min)/i,
        /within\s+(?:minutes?|seconds?)/i
      ],
      'short-term': [
        /short[- ]?term|minutes?|< ?\d+\s*hours?|next\s+hour/i,
        /within\s+(?:1-15|15)\s*min/i
      ],
      'medium-term': [
        /medium[- ]?term|hours?|today|this\s+(?:shift|day)/i,
        /within\s+(?:\d+\s*)?hours?/i
      ]
    };

    for (const [timeframe, patterns] of Object.entries(timeframePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return timeframe as any;
        }
      }
    }

    return 'ongoing';
  };

  return {
    extractConfidence,
    extractRecommendations,
    extractAwarenessLevel,
    extractRiskFactors,
    extractPriority,
    extractActionItems,
    extractTimeframe
  };
};

/**
 * Assess contextual confidence based on response characteristics
 */
const assessContextualConfidence = (content: string): number => {
  let score = 0.5; // Base confidence

  // Length factor
  if (content.length > 100) score += 0.1;
  if (content.length > 300) score += 0.1;

  // Structure factor
  if (content.includes('\n') && content.includes('-')) score += 0.1;
  if (content.match(/\d+\./)) score += 0.1;

  // Content quality factors
  if (content.includes('recommendation')) score += 0.1;
  if (content.match(/\d+%/)) score += 0.1;
  if (content.includes('analysis') || content.includes('assessment')) score += 0.1;

  // Uncertainty indicators (reduce confidence)
  if (content.includes('may') || content.includes('might') || content.includes('possibly')) score -= 0.1;
  if (content.includes('unclear') || content.includes('uncertain')) score -= 0.2;

  return Math.max(0.3, Math.min(0.95, score));
};

/**
 * Clean recommendation text
 */
const cleanRecommendationText = (text: string): string => {
  return text
    .replace(/^[\s]*[-•*\d.()]\s*/, '')
    .replace(/^[\s]*recommendation[:\s]*/i, '')
    .replace(/^[\s]*consider[:\s]*/i, '')
    .trim();
};

/**
 * Validate recommendation quality
 */
const isValidRecommendation = (text: string): boolean => {
  return text.length >= 10 && 
         text.length <= 200 && 
         !text.match(/^[A-Z\s]+$/) && // Not all caps
         text.split(' ').length >= 3;  // At least 3 words
};

/**
 * Extract recommendations from structured sections
 */
const extractSectionRecommendations = (content: string): string[] => {
  const recommendations: string[] = [];
  const sections = ['recommendations', 'suggestions', 'actions', 'next steps'];
  
  for (const sectionName of sections) {
    const regex = new RegExp(`${sectionName}[:\s]*([^]*?)(?=

|
[A-Z]|$)`, 'i');
    const match = content.match(regex);
    
    if (match) {
      const sectionContent = match[1];
      const lines = sectionContent.split('\n');

      
      lines.forEach(line => {
        if (line.trim() && line.match(/^[\s]*[-•*\d.]/)) {
          const cleaned = cleanRecommendationText(line);
          if (isValidRecommendation(cleaned)) {
            recommendations.push(cleaned);
          }
        }
      });
    }
  }
  
  return recommendations;
};

/**
 * Deduplicate recommendations using similarity matching
 */
const deduplicateRecommendations = (recommendations: string[]): string[] => {
  const unique: string[] = [];
  
  for (const rec of recommendations) {
    const isDuplicate = unique.some(existing => 
      calculateSimilarity(rec.toLowerCase(), existing.toLowerCase()) > 0.7
    );
    
    if (!isDuplicate) {
      unique.push(rec);
    }
  }
  
  return unique;
};

/**
 * Assess situational awareness score from content
 */
const assessAwarenessScore = (content: string): number => {
  let score = 0.5;

  const positiveIndicators = ['comprehensive', 'detailed', 'thorough', 'complete', 'accurate'];
  const negativeIndicators = ['limited', 'incomplete', 'unclear', 'insufficient', 'poor'];

  positiveIndicators.forEach(indicator => {
    if (content.toLowerCase().includes(indicator)) score += 0.1;
  });

  negativeIndicators.forEach(indicator => {
    if (content.toLowerCase().includes(indicator)) score -= 0.1;
  });

  return Math.max(0, Math.min(1, score));
};

/**
 * Clean risk factor text
 */
const cleanRiskFactorText = (text: string): string => {
  return text
    .replace(/^[\s]*[-•*\d.()]\s*/, '')
    .replace(/^[\s]*(?:risk|hazard|concern)[:\s]*/i, '')
    .trim();
};

/**
 * Categorize risk factor by type
 */
const categorizeRiskFactor = (text: string, categories: Record<string, string[]>): string | null => {
  const textLower = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => textLower.includes(keyword))) {
      return category;
    }
  }
  
  return null;
};

/**
 * Deduplicate and rank risk factors by severity
 */
const deduplicateAndRankRiskFactors = (factors: string[]): string[] => {
  const unique = [...new Set(factors)];
  
  // Sort by perceived severity (based on keywords)
  return unique.sort((a, b) => {
    const severityA = assessRiskSeverity(a);
    const severityB = assessRiskSeverity(b);
    return severityB - severityA;
  });
};

/**
 * Assess risk severity from text
 */
const assessRiskSeverity = (text: string): number => {
  const textLower = text.toLowerCase();
  const highSeverityWords = ['critical', 'emergency', 'failure', 'danger'];
  const mediumSeverityWords = ['warning', 'concern', 'issue', 'problem'];
  
  if (highSeverityWords.some(word => textLower.includes(word))) return 3;
  if (mediumSeverityWords.some(word => textLower.includes(word))) return 2;
  return 1;
};

/**
 * Assess urgency score from content
 */
const assessUrgencyScore = (content: string): number => {
  const contentLower = content.toLowerCase();
  let score = 0.5;

  const urgentWords = ['urgent', 'immediate', 'critical', 'emergency', 'now', 'asap'];
  const routineWords = ['routine', 'when convenient', 'optional', 'defer'];

  urgentWords.forEach(word => {
    if (contentLower.includes(word)) score += 0.1;
  });

  routineWords.forEach(word => {
    if (contentLower.includes(word)) score -= 0.1;
  });

  return Math.max(0, Math.min(1, score));
};

/**
 * Clean action item text
 */
const cleanActionItemText = (text: string): string => {
  return text
    .replace(/^[\s]*[-•*\d.()]\s*/, '')
    .replace(/^[\s]*(?:action|step|task)[:\s]*/i, '')
    .trim();
};

/**
 * Validate action item quality
 */
const isValidActionItem = (text: string): boolean => {
  return text.length >= 15 && 
         text.length <= 150 && 
         text.includes(' ') &&
         !text.match(/^[A-Z\s]+$/);
};

/**
 * Extract action items from structured sections
 */
const extractSectionActionItems = (content: string): string[] => {
  const actions: string[] = [];
  const actionSections = ['immediate', 'short-term', 'actions required', 'next steps'];
  
  for (const sectionName of actionSections) {
    const regex = new RegExp(`${sectionName}[:\s]*([^]*?)(?=

|
[A-Z]|$)`, 'i');
    const match = content.match(regex);
    
    if (match) {
      const sectionContent = match[1];
      const lines = sectionContent.split('\n');

      
      lines.forEach(line => {
        if (line.trim() && line.match(/^[\s]*[-•*\d.]/)) {
          const cleaned = cleanActionItemText(line);
          if (isValidActionItem(cleaned)) {
            actions.push(cleaned);
          }
        }
      });
    }
  }
  
  return actions;
};

/**
 * Deduplicate action items
 */
const deduplicateActionItems = (actions: string[]): string[] => {
  const unique: string[] = [];
  
  for (const action of actions) {
    const isDuplicate = unique.some(existing => 
      calculateSimilarity(action.toLowerCase(), existing.toLowerCase()) > 0.8
    );
    
    if (!isDuplicate) {
      unique.push(action);
    }
  }
  
  return unique;
};

/**
 * Calculate text similarity (simple implementation)
 */
const calculateSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.split(' ');
  const words2 = text2.split(' ');
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return totalWords > 0 ? commonWords.length / totalWords : 0;
};

/**
 * Response validation utilities
 */
export const ResponseValidation = {
  /**
   * Validate response completeness
   */
  validateCompleteness: (content: string, requiredElements: string[]): {
    complete: boolean;
    missing: string[];
    score: number;
  } => {
    const contentLower = content.toLowerCase();
    const missing: string[] = [];
    
    requiredElements.forEach(element => {
      if (!contentLower.includes(element.toLowerCase())) {
        missing.push(element);
      }
    });
    
    const score = (requiredElements.length - missing.length) / requiredElements.length;
    
    return {
      complete: missing.length === 0,
      missing,
      score
    };
  },

  /**
   * Assess response quality metrics
   */
  assessQuality: (content: string): {
    score: number;
    metrics: {
      length: number;
      structure: number;
      clarity: number;
      actionability: number;
    };
  } => {
    const metrics = {
      length: Math.min(1, content.length / 200),
      structure: content.includes('\n') && (content.includes('-') || content.match(/\d+\./)) ? 1 : 0.5,
      clarity: content.split('.').length > 2 ? 1 : 0.6,
      actionability: content.toLowerCase().includes('recommend') || content.toLowerCase().includes('action') ? 1 : 0.7
    };
    
    const score = Object.values(metrics).reduce((sum, val) => sum + val, 0) / Object.keys(metrics).length;
    
    return { score, metrics };
  }
};