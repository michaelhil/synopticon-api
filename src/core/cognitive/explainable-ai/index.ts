/**
 * @fileoverview Explainable AI Engine - Main Factory and Orchestration
 * 
 * Comprehensive explainable AI system providing transparent, multi-method
 * explanations for cognitive state predictions with feature attribution,
 * rule-based reasoning, and causal inference.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createFeatureAttributionEngine } from './feature-attribution-engine.js';
import { createRuleBasedExplainer } from './rule-based-explainer.js';
import { createCausalReasoningEngine } from './causal-reasoning-engine.js';
import { createExplanationAggregator } from './explanation-aggregator.js';
import type {
  ExplainableAIEngine,
  ExplainableAIConfig,
  AggregratedExplanation,
  Features,
  ExplanationOptions,
  FeatureExplanation,
  FeatureInterpretation,
  FeatureRange,
  ExplanationStyle
} from './types.js';

// Logger interface for consistent logging
interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, error?: Error) => void;
}

// Simple logger implementation
const logger: Logger = {
  info: (message: string) => console.log(`ℹ️ ${message}`),
  warn: (message: string) => console.warn(`⚠️ ${message}`),
  error: (message: string, error?: Error) => console.error(`❌ ${message}`, error)
};

/**
 * Main Explainable AI Engine Factory
 * Coordinates all explanation methods to provide comprehensive, transparent predictions
 */
export const createExplainableAIEngine = (config: ExplainableAIConfig = {}): ExplainableAIEngine => {
  const {
    enableAttribution = true,
    enableRules = true,
    enableCausal = true,
    explanationStyle = 'balanced',
    ...engineConfigs
  } = config;

  // Initialize explanation engines
  const attributionEngine = enableAttribution ? 
    createFeatureAttributionEngine(engineConfigs.attribution) : null;
  
  const ruleEngine = enableRules ? 
    createRuleBasedExplainer(engineConfigs.rules) : null;
  
  const causalEngine = enableCausal ? 
    createCausalReasoningEngine(engineConfigs.causal) : null;
  
  const aggregator = createExplanationAggregator({ 
    preferredExplanationStyle: explanationStyle,
    ...engineConfigs.aggregator 
  });

  /**
   * Generate comprehensive explanation for a prediction
   */
  const explainPrediction = (prediction: number, features: Features, options: ExplanationOptions = {}): AggregratedExplanation => {
    const {
      includeDetailed = true,
      customContext = {}
    } = options;

    try {
      // Generate explanations from each enabled engine
      const attributionExplanation = attributionEngine ? 
        attributionEngine.explainPrediction(prediction, features) : 
        { attributions: {}, confidence: 0.5 };

      const ruleExplanation = ruleEngine ? 
        ruleEngine.explainWithRules(features) : 
        { rules: [], primaryExplanation: '', confidence: 0.5, supportingFacts: [] };

      const causalExplanation = causalEngine ? 
        causalEngine.performCausalAnalysis(features) : 
        { 
          causalGraph: { nodes: [], edges: [] },
          primaryCause: null,
          alternativeCauses: [],
          interventionSuggestions: [],
          confidence: 0.5,
          causalChains: [],
          timestamp: Date.now()
        };

      // Aggregate explanations
      const explanation = aggregator.aggregateExplanations(
        attributionExplanation,
        ruleExplanation, 
        causalExplanation,
        prediction
      );

      // Add custom context if provided
      if (Object.keys(customContext).length > 0) {
        explanation.context = customContext;
      }

      return explanation;

    } catch (error) {
      logger.error('Error generating prediction explanation:', error as Error);
      
      // Fallback explanation
      return createFallbackExplanation(prediction);
    }
  };

  /**
   * Generate detailed feature explanations
   */
  const explainFeatures = (features: Features): Record<string, FeatureExplanation> => {
    const featureExplanations: Record<string, FeatureExplanation> = {};
    
    Object.entries(features).forEach(([name, value]) => {
      featureExplanations[name] = {
        value,
        formattedName: formatFeatureName(name),
        interpretation: interpretFeatureValue(name, value),
        normalRange: getFeatureNormalRange(name),
        category: categorizeFeatureValue(name, value)
      };
    });

    return featureExplanations;
  };

  /**
   * Interpret individual feature values
   */
  const interpretFeatureValue = (featureName: string, value: unknown): FeatureInterpretation => {
    if (typeof value !== 'number') {
      return {
        description: 'Non-numeric value',
        severity: 'normal',
        recommendation: 'Ensure feature provides numeric data'
      };
    }

    const interpretations: Record<string, (val: number) => FeatureInterpretation> = {
      'fixationDuration': (val) => ({
        description: val > 300 ? 'Stable gaze pattern' : val > 150 ? 'Normal focus duration' : 'Rapid visual scanning',
        severity: val < 100 ? 'warning' : val > 500 ? 'attention' : 'normal',
        recommendation: val < 100 ? 'May indicate attention issues' : val > 500 ? 'Consider task difficulty' : 'Good focus stability'
      }),
      'saccadeVelocity': (val) => ({
        description: val > 400 ? 'Very rapid eye movements' : val > 200 ? 'Active visual search' : 'Slow eye movements',
        severity: val > 500 ? 'warning' : 'normal',
        recommendation: val > 500 ? 'May indicate stress or search difficulty' : 'Normal eye movement pattern'
      }),
      'pupilDilation': (val) => ({
        description: val > 0.7 ? 'High cognitive arousal' : val > 0.4 ? 'Normal arousal level' : 'Low arousal',
        severity: val > 0.8 ? 'attention' : val < 0.2 ? 'warning' : 'normal',
        recommendation: val > 0.8 ? 'May indicate cognitive overload' : val < 0.2 ? 'Consider engagement level' : 'Good arousal level'
      }),
      'circadianFactor': (val) => ({
        description: val > 0.7 ? 'Peak alertness period' : val > 0.4 ? 'Moderate alertness' : 'Low alertness period',
        severity: val < 0.3 ? 'warning' : 'normal',
        recommendation: val < 0.3 ? 'Consider task scheduling' : 'Good timing for current task'
      }),
      'fatigueLevel': (val) => ({
        description: val > 0.7 ? 'High fatigue detected' : val > 0.4 ? 'Moderate fatigue' : 'Low fatigue level',
        severity: val > 0.7 ? 'critical' : val > 0.5 ? 'warning' : 'normal',
        recommendation: val > 0.7 ? 'Rest break recommended' : val > 0.5 ? 'Monitor fatigue levels' : 'Good energy level'
      })
    };
    
    const interpreter = interpretations[featureName];
    return interpreter ? interpreter(value) : {
      description: 'Normal range',
      severity: 'normal',
      recommendation: 'Continue monitoring'
    };
  };

  /**
   * Get normal range for feature values
   */
  const getFeatureNormalRange = (featureName: string): FeatureRange => {
    const ranges: Record<string, FeatureRange> = {
      'fixationDuration': { min: 150, max: 400, unit: 'ms', optimal: { min: 200, max: 350 } },
      'saccadeVelocity': { min: 100, max: 300, unit: 'deg/s', optimal: { min: 150, max: 250 } },
      'pupilDilation': { min: 0.3, max: 0.7, unit: 'normalized', optimal: { min: 0.4, max: 0.6 } },
      'circadianFactor': { min: 0.4, max: 0.9, unit: 'factor', optimal: { min: 0.6, max: 0.8 } },
      'fatigueLevel': { min: 0.0, max: 0.4, unit: 'normalized', optimal: { min: 0.0, max: 0.2 } },
      'blinkRate': { min: 10, max: 20, unit: 'per minute', optimal: { min: 12, max: 18 } },
      'heartRate': { min: 0.4, max: 0.8, unit: 'normalized', optimal: { min: 0.5, max: 0.7 } }
    };
    
    return ranges[featureName] || { 
      min: 0, 
      max: 1, 
      unit: 'normalized', 
      optimal: { min: 0.3, max: 0.7 } 
    };
  };

  /**
   * Categorize feature value relative to normal range
   */
  const categorizeFeatureValue = (featureName: string, value: unknown): 'below-normal' | 'normal' | 'above-normal' | 'optimal' => {
    if (typeof value !== 'number') return 'normal';
    
    const range = getFeatureNormalRange(featureName);
    
    // Check optimal range first
    if (range.optimal && value >= range.optimal.min && value <= range.optimal.max) {
      return 'optimal';
    }
    
    if (value < range.min) return 'below-normal';
    if (value > range.max) return 'above-normal';
    return 'normal';
  };

  /**
   * Create fallback explanation when main processing fails
   */
  const createFallbackExplanation = (prediction: number): AggregratedExplanation => {
    return {
      prediction: {
        value: prediction,
        confidence: 0.3,
        category: categorizePrediction(prediction)
      },
      explanation: {
        primary: `Your cognitive state appears ${categorizePrediction(prediction)} based on available data.`,
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
        style: 'simple' as ExplanationStyle,
        supportingEvidence: ['Analysis system encountered processing limitations']
      },
      recommendations: ['Continue monitoring cognitive state', 'Check system configuration'],
      uncertainty: {
        level: 'high',
        factors: ['Explanation generation failed'],
        confidence: 0.3,
        recommendations: ['Verify data sources', 'Check system status']
      },
      metadata: {
        explanationMethods: ['fallback'],
        generatedAt: Date.now(),
        version: '1.0',
        confidence: 0.3
      },
      error: 'Unable to generate detailed explanation'
    };
  };

  /**
   * Integration with fusion engine systems
   */
  const integrateWithFusionEngine = (fusionEngine: any): boolean => {
    if (!fusionEngine) {
      logger.warn('Fusion engine not provided for XAI integration');
      return false;
    }

    try {
      // Add explanation capability to fusion engine
      fusionEngine.addExplanationEngine = (predictionData: any) => {
        return explainPrediction(
          predictionData.prediction, 
          predictionData.features, 
          predictionData.options || {}
        );
      };

      logger.info('✨ XAI Engine integrated with Fusion Engine');
      return true;
    } catch (error) {
      logger.error('Failed to integrate with fusion engine:', error as Error);
      return false;
    }
  };

  /**
   * Get system health and status
   */
  const getSystemHealth = () => {
    return {
      engines: {
        attribution: attributionEngine !== null,
        rules: ruleEngine !== null,
        causal: causalEngine !== null,
        aggregator: true
      },
      lastExplanationTime: Date.now(),
      version: '1.0.0',
      status: 'operational'
    };
  };

  return {
    // Core explanation functionality
    explainPrediction,
    explainFeatures,
    
    // Engine access
    getAttributionEngine: () => attributionEngine,
    getRuleEngine: () => ruleEngine,
    getCausalEngine: () => causalEngine,
    getAggregator: () => aggregator,
    
    // Configuration
    setExplanationStyle: (style: ExplanationStyle) => aggregator.setExplanationStyle(style),
    getExplanationStyle: () => aggregator.getExplanationStyle(),
    
    // Custom rules and relationships
    addRule: (rule: any) => ruleEngine ? ruleEngine.addCustomRule(rule) : false,
    
    // Integration
    integrateWithFusionEngine,
    
    // System status
    getSystemHealth,
    
    // Utility functions
    formatFeatureName,
    categorizePrediction,
    
    // Cleanup
    cleanup: () => {
      logger.info('🧹 Explainable AI Engine cleaned up');
    }
  };
};

/**
 * Format feature name for human readability
 */
export const formatFeatureName = (featureName: string): string => {
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
 * Categorize prediction into human-readable categories
 */
export const categorizePrediction = (prediction: number): string => {
  if (prediction > 0.8) return 'excellent';
  if (prediction > 0.7) return 'optimal';
  if (prediction > 0.5) return 'good';
  if (prediction > 0.3) return 'moderate';
  return 'suboptimal';
};

// Export all component engines for direct access
export { createFeatureAttributionEngine } from './feature-attribution-engine.js';
export { createRuleBasedExplainer } from './rule-based-explainer.js';
export { createCausalReasoningEngine } from './causal-reasoning-engine.js';
export { createExplanationAggregator } from './explanation-aggregator.js';

// Export types for external use
export type * from './types.js';