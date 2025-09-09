/**
 * @fileoverview Explanation Aggregator
 * 
 * Combines multiple explanation approaches (attribution, rules, causal) into
 * coherent, user-friendly explanations with style adaptation.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  ExplanationAggregator,
  ExplanationAggregatorConfig,
  AggregratedExplanation,
  AttributionExplanation,
  RuleExplanation,
  CausalExplanation,
  ExplanationStyle,
  UncertaintyAssessment,
  Features
} from './types.js';

/**
 * Create explanation aggregator for combining multiple explanation methods
 */
export const createExplanationAggregator = (config: ExplanationAggregatorConfig = {}): ExplanationAggregator => {
  const {
    preferredExplanationStyle = 'balanced',
    includeUncertainty = true,
    maxRecommendations = 3,
    confidenceThreshold = 0.5
  } = config;

  /**
   * Aggregate explanations from multiple methods
   */
  const aggregateExplanations = (
    attributionExplanation: AttributionExplanation,
    ruleExplanation: RuleExplanation,
    causalExplanation: CausalExplanation,
    prediction: number
  ): AggregratedExplanation => {
    try {
      const explanations = {
        attribution: attributionExplanation,
        rules: ruleExplanation,
        causal: causalExplanation
      };

      // Generate primary explanation based on style preference
      const primaryExplanation = generatePrimaryExplanation(explanations, prediction);
      
      // Combine recommendations
      const allRecommendations = [
        ...(ruleExplanation.rules?.flatMap(rule => rule.recommendations || []) || []),
        ...(causalExplanation.interventionSuggestions?.map(intervention => intervention.description) || [])
      ];
      
      // Remove duplicates and limit count
      const uniqueRecommendations = [...new Set(allRecommendations)].slice(0, maxRecommendations);

      // Calculate overall confidence
      const confidenceScores = [
        attributionExplanation.confidence || 0,
        ruleExplanation.confidence || 0,
        causalExplanation.primaryCause?.strength || 0
      ].filter(score => score > 0);
      
      const overallConfidence = confidenceScores.length > 0 ? 
        confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length : 0.5;

      // Generate uncertainty assessment
      const uncertainty = includeUncertainty 
        ? calculateUncertainty(explanations, overallConfidence)
        : null;

      return {
        prediction: {
          value: prediction,
          confidence: overallConfidence,
          category: categorizePrediction(prediction)
        },
        explanation: {
          primary: primaryExplanation,
          detailed: explanations,
          style: preferredExplanationStyle,
          supportingEvidence: generateSupportingEvidence(explanations)
        },
        recommendations: uniqueRecommendations,
        uncertainty,
        metadata: {
          explanationMethods: ['attribution', 'rules', 'causal'],
          generatedAt: Date.now(),
          version: '1.0',
          confidence: overallConfidence
        }
      };
    } catch (error) {
      console.error('Explanation aggregation failed:', error);
      return createFallbackExplanation(prediction);
    }
  };

  /**
   * Generate primary explanation based on style preference
   */
  const generatePrimaryExplanation = (explanations: {
    attribution: AttributionExplanation;
    rules: RuleExplanation;
    causal: CausalExplanation;
  }, prediction: number): string => {
    const { attribution, rules, causal } = explanations;

    switch (preferredExplanationStyle) {
      case 'technical':
        return generateTechnicalExplanation(attribution, prediction);
      case 'simple':
        return generateSimpleExplanation(rules, causal, prediction);
      case 'balanced':
      default:
        return generateBalancedExplanation(attribution, rules, causal, prediction);
    }
  };

  /**
   * Generate technical explanation focusing on feature attributions
   */
  const generateTechnicalExplanation = (attribution: AttributionExplanation, prediction: number): string => {
    const topFactors = Object.entries(attribution.attributions || {})
      .sort((a, b) => Math.abs(b[1].importance) - Math.abs(a[1].importance))
      .slice(0, 3)
      .map(([name, attr]) => 
        `${formatFeatureName(name)} (${attr.direction} by ${Math.round(Math.abs(attr.importance) * 100)}%)`
      );

    if (topFactors.length === 0) {
      return `Prediction: ${Math.round(prediction * 100)}% based on current behavioral patterns.`;
    }

    return `Prediction: ${Math.round(prediction * 100)}% confidence based on: ${topFactors.join(', ')}. ` +
           `Primary contributor: ${topFactors[0]}.`;
  };

  /**
   * Generate simple explanation using rules and causal insights
   */
  const generateSimpleExplanation = (rules: RuleExplanation, causal: CausalExplanation, prediction: number): string => {
    const primaryRule = rules.rules?.[0];
    const primaryCause = causal.primaryCause;

    // Prefer rule-based explanation for simplicity
    if (primaryRule && primaryRule.confidence >= confidenceThreshold) {
      return `${primaryRule.conclusion}. ${primaryRule.explanation}`;
    } 
    
    // Fall back to causal explanation
    if (primaryCause && primaryCause.strength >= confidenceThreshold) {
      const effectsList = primaryCause.effects.slice(0, 2).join(' and ');
      return `${primaryCause.causeName} is affecting your ${effectsList}. ` +
             `${getSimpleRecommendation(primaryCause.interventions)}`;
    }

    // Generic fallback
    const category = categorizePrediction(prediction);
    return `Your cognitive state is ${category}. ${getGenericAdvice(category)}`;
  };

  /**
   * Generate balanced explanation combining multiple approaches
   */
  const generateBalancedExplanation = (
    attribution: AttributionExplanation,
    rules: RuleExplanation,
    causal: CausalExplanation,
    prediction: number
  ): string => {
    const category = categorizePrediction(prediction);
    const primaryRule = rules.rules?.[0];
    const primaryCause = causal.primaryCause;
    const topAttribution = Object.entries(attribution.attributions || {})
      .sort((a, b) => Math.abs(b[1].importance) - Math.abs(a[1].importance))[0];

    let explanation = `Your cognitive state is ${category}.`;

    // Add rule-based insight if available
    if (primaryRule && primaryRule.confidence >= confidenceThreshold) {
      explanation += ` ${primaryRule.explanation}`;
    }

    // Add causal insight
    if (primaryCause && primaryCause.strength >= confidenceThreshold) {
      const mainEffect = primaryCause.effects[0];
      explanation += ` The main contributing factor is ${primaryCause.causeName.toLowerCase()}, which impacts ${mainEffect}.`;
    }

    // Add attribution detail if available and not redundant
    if (topAttribution && topAttribution[1].importance > 0.3) {
      const [featureName, attr] = topAttribution;
      explanation += ` Key behavioral indicator: ${formatFeatureName(featureName)} ` +
                    `is ${attr.direction === 'positive' ? 'supporting' : 'reducing'} performance.`;
    }

    return explanation;
  };

  /**
   * Generate supporting evidence from all explanation methods
   */
  const generateSupportingEvidence = (explanations: {
    attribution: AttributionExplanation;
    rules: RuleExplanation;
    causal: CausalExplanation;
  }): string[] => {
    const evidence: string[] = [];

    // Attribution evidence
    const topAttributions = Object.entries(explanations.attribution.attributions || {})
      .sort((a, b) => Math.abs(b[1].importance) - Math.abs(a[1].importance))
      .slice(0, 2);

    topAttributions.forEach(([name, attr]) => {
      evidence.push(`${formatFeatureName(name)}: ${attr.direction} impact (${Math.round(Math.abs(attr.importance) * 100)}%)`);
    });

    // Rule evidence
    explanations.rules.rules?.slice(0, 2).forEach(rule => {
      evidence.push(`${rule.conclusion} (confidence: ${Math.round(rule.confidence * 100)}%)`);
    });

    // Causal evidence
    if (explanations.causal.primaryCause) {
      const cause = explanations.causal.primaryCause;
      evidence.push(`${cause.causeName} affects ${cause.effects.join(', ')} (strength: ${Math.round(cause.strength * 100)}%)`);
    }

    return evidence.slice(0, 5); // Limit to top 5 pieces of evidence
  };

  /**
   * Calculate uncertainty assessment
   */
  const calculateUncertainty = (explanations: {
    attribution: AttributionExplanation;
    rules: RuleExplanation;
    causal: CausalExplanation;
  }, overallConfidence: number): UncertaintyAssessment => {
    const uncertaintyFactors: string[] = [];

    // Low overall confidence
    if (overallConfidence < 0.6) {
      uncertaintyFactors.push('Limited confidence in analysis');
    }

    // Low attribution confidence
    if (explanations.attribution.confidence < 0.6) {
      uncertaintyFactors.push('Insufficient data for precise feature analysis');
    }

    // Conflicting rules
    if (explanations.rules.rules && explanations.rules.rules.length > 1) {
      const confidenceDiff = explanations.rules.rules[0].confidence - explanations.rules.rules[1].confidence;
      if (confidenceDiff < 0.2) {
        uncertaintyFactors.push('Multiple cognitive patterns detected with similar likelihood');
      }
    }

    // Weak causal evidence
    if (explanations.causal.primaryCause && explanations.causal.primaryCause.strength < 0.5) {
      uncertaintyFactors.push('Causal relationships are not strongly established');
    }

    // Disagreement between methods
    const methodConfidences = [
      explanations.attribution.confidence || 0,
      explanations.rules.confidence || 0,
      explanations.causal.primaryCause?.strength || 0
    ];
    
    const maxConfidence = Math.max(...methodConfidences);
    const minConfidence = Math.min(...methodConfidences);
    if (maxConfidence - minConfidence > 0.4) {
      uncertaintyFactors.push('Analysis methods show varying levels of agreement');
    }

    // Determine uncertainty level
    let level: 'low' | 'medium' | 'high';
    if (uncertaintyFactors.length === 0 && overallConfidence > 0.7) {
      level = 'low';
    } else if (uncertaintyFactors.length <= 2 && overallConfidence > 0.5) {
      level = 'medium';
    } else {
      level = 'high';
    }

    return {
      level,
      factors: uncertaintyFactors,
      confidence: overallConfidence,
      recommendations: generateUncertaintyRecommendations(level, uncertaintyFactors)
    };
  };

  /**
   * Generate recommendations based on uncertainty level
   */
  const generateUncertaintyRecommendations = (level: 'low' | 'medium' | 'high', factors: string[]): string[] => {
    const recommendations: string[] = [];

    switch (level) {
      case 'high':
        recommendations.push('Continue monitoring for more reliable patterns');
        recommendations.push('Consider extending observation period');
        if (factors.some(f => f.includes('data'))) {
          recommendations.push('Ensure all sensors are functioning properly');
        }
        break;

      case 'medium':
        recommendations.push('Recommendations should be applied cautiously');
        if (factors.some(f => f.includes('patterns'))) {
          recommendations.push('Monitor response to interventions closely');
        }
        break;

      case 'low':
        recommendations.push('Analysis is reliable for decision making');
        break;
    }

    return recommendations.slice(0, 3);
  };

  /**
   * Create fallback explanation when aggregation fails
   */
  const createFallbackExplanation = (prediction: number): AggregratedExplanation => {
    const category = categorizePrediction(prediction);
    
    return {
      prediction: {
        value: prediction,
        confidence: 0.3,
        category
      },
      explanation: {
        primary: `Your cognitive state appears ${category} based on available data.`,
        detailed: {
          attribution: { attributions: {}, confidence: 0.3 },
          rules: { rules: [], primaryExplanation: '', confidence: 0.3, supportingFacts: [] },
          causal: { 
            causalGraph: { nodes: [], edges: [] },
            primaryCause: null,
            alternativeCauses: [],
            interventionSuggestions: [],
            confidence: 0.3,
            causalChains: [],
            timestamp: Date.now()
          }
        },
        style: preferredExplanationStyle,
        supportingEvidence: ['Analysis encountered processing limitations']
      },
      recommendations: ['Continue monitoring', 'Ensure system is functioning properly'],
      uncertainty: {
        level: 'high',
        factors: ['Analysis system encountered errors'],
        confidence: 0.3,
        recommendations: ['Check system configuration', 'Verify data sources']
      },
      metadata: {
        explanationMethods: ['fallback'],
        generatedAt: Date.now(),
        version: '1.0',
        confidence: 0.3
      }
    };
  };

  /**
   * Set explanation style preference
   */
  const setExplanationStyle = (style: ExplanationStyle): boolean => {
    if (['technical', 'simple', 'balanced'].includes(style)) {
      return true; // Style updated (would need to modify config in a real implementation)
    }
    return false;
  };

  /**
   * Get current explanation style
   */
  const getExplanationStyle = (): ExplanationStyle => {
    return preferredExplanationStyle;
  };

  return {
    aggregateExplanations,
    setExplanationStyle,
    getExplanationStyle
  };
};

/**
 * Categorize prediction into human-readable categories
 */
const categorizePrediction = (prediction: number): string => {
  if (prediction > 0.8) return 'excellent';
  if (prediction > 0.7) return 'optimal';
  if (prediction > 0.5) return 'good';
  if (prediction > 0.3) return 'moderate';
  return 'suboptimal';
};

/**
 * Format feature name for human readability
 */
const formatFeatureName = (featureName: string): string => {
  const nameMap: Record<string, string> = {
    'fixationDuration': 'gaze stability',
    'saccadeVelocity': 'eye movement speed',
    'pupilDilation': 'pupil size',
    'blinkRate': 'blink frequency',
    'circadianFactor': 'time of day alertness',
    'fatigueLevel': 'fatigue level',
    'taskPhase': 'task stage',
    'noiseLevel': 'noise level',
    'temperature': 'temperature comfort',
    'heartRate': 'heart rate',
    'skinConductance': 'skin conductance',
    'workingMemoryLoad': 'working memory load'
  };
  
  return nameMap[featureName] || featureName.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
};

/**
 * Get simple recommendation from intervention list
 */
const getSimpleRecommendation = (interventions: string[]): string => {
  if (interventions.length === 0) return 'Consider taking a break.';
  
  const simpleInterventions: Record<string, string> = {
    'rest_break': 'Take a short break.',
    'task_simplification': 'Simplify your current task.',
    'environment_optimization': 'Improve your workspace.',
    'hydration_reminder': 'Stay hydrated.',
    'schedule_adjustment': 'Consider timing adjustments.'
  };

  const firstIntervention = interventions[0];
  return simpleInterventions[firstIntervention] || 'Consider making adjustments.';
};

/**
 * Get generic advice based on cognitive state category
 */
const getGenericAdvice = (category: string): string => {
  const advice: Record<string, string> = {
    'excellent': 'Great time for challenging tasks.',
    'optimal': 'Continue with current approach.',
    'good': 'Minor adjustments may help.',
    'moderate': 'Consider break or task changes.',
    'suboptimal': 'Take a break and reassess.'
  };

  return advice[category] || 'Monitor your state closely.';
};