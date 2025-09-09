/**
 * @fileoverview Feature Attribution Engine
 * 
 * Calculates the contribution of each input feature to the final prediction
 * using SHAP-like (SHapley Additive exPlanations) methodology and domain-specific
 * feature impact analysis.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  FeatureAttributionEngine,
  FeatureAttributionConfig,
  AttributionExplanation,
  FeatureAttribution,
  Features
} from './types.js';

/**
 * Feature impact calculation functions for different feature types
 */
const FEATURE_IMPACT_FUNCTIONS: Record<string, (value: number) => number> = {
  // Gaze-related features
  fixationDuration: (value) => value > 300 ? 0.2 : value < 100 ? -0.15 : 0,
  saccadeVelocity: (value) => value > 500 ? -0.25 : value < 100 ? -0.1 : 0.1,
  pupilDilation: (value) => value > 0.7 ? 0.3 : value < 0.3 ? -0.2 : 0,
  blinkRate: (value) => value > 20 ? -0.2 : value < 5 ? -0.15 : 0.05,
  
  // Temporal features
  circadianFactor: (value) => (value - 0.5) * 0.4,
  fatigueLevel: (value) => -value * 0.5,
  taskPhase: (value) => {
    const phaseImpactMap: Record<string, number> = {
      'orientation': -0.1,
      'adaptation': 0.0,
      'performance': 0.2,
      'plateau': 0.1,
      'fatigue': -0.3,
      'recovery': 0.0
    };
    return phaseImpactMap[value.toString()] ?? 0;
  },
  
  // Environmental features
  noiseLevel: (value) => value > 0.7 ? -0.15 : 0,
  temperature: (value) => Math.abs(value - 0.5) * -0.1,
  lightingLevel: (value) => value < 0.3 || value > 0.9 ? -0.1 : 0.05,
  
  // Physiological features
  heartRate: (value) => value > 0.8 ? -0.2 : value < 0.3 ? -0.1 : 0,
  skinConductance: (value) => value > 0.7 ? -0.15 : 0,
  cortisol: (value) => value > 0.6 ? -0.25 : 0,
  
  // Cognitive features
  workingMemoryLoad: (value) => value > 0.8 ? -0.3 : value < 0.2 ? 0.1 : 0,
  attentionFocus: (value) => value > 0.7 ? 0.2 : value < 0.3 ? -0.2 : 0,
  cognitiveFlexibility: (value) => value > 0.6 ? 0.15 : value < 0.4 ? -0.15 : 0
};

/**
 * Feature reliability scores for confidence calculation
 */
const FEATURE_RELIABILITY: Record<string, number> = {
  fixationDuration: 0.9,
  saccadeVelocity: 0.85,
  pupilDilation: 0.8,
  circadianFactor: 0.95,
  fatigueLevel: 0.8,
  taskPhase: 0.9,
  noiseLevel: 0.85,
  temperature: 0.9,
  lightingLevel: 0.8,
  heartRate: 0.75,
  skinConductance: 0.7,
  cortisol: 0.7,
  workingMemoryLoad: 0.85,
  attentionFocus: 0.8,
  cognitiveFlexibility: 0.75
};

/**
 * Create feature attribution engine
 */
export const createFeatureAttributionEngine = (
  config: FeatureAttributionConfig = {}
): FeatureAttributionEngine => {
  
  const {
    enableShapley = true,
    maxFeatures = 10,
    attributionThreshold = 0.05
  } = config;

  /**
   * Calculate feature impact on prediction
   */
  const calculateFeatureImpact = (
    featureName: string,
    featureValue: number,
    allFeatures: Features,
    prediction: number
  ): number => {
    const impactFunction = FEATURE_IMPACT_FUNCTIONS[featureName];
    
    if (!impactFunction) {
      // Fallback: simple linear relationship with normalization
      const normalizedValue = Math.max(0, Math.min(1, featureValue));
      return (normalizedValue - 0.5) * 0.1;
    }
    
    const baseImpact = impactFunction(featureValue);
    
    // Apply interaction effects if multiple related features are present
    const interactionEffect = calculateInteractionEffects(
      featureName, 
      featureValue, 
      allFeatures
    );
    
    return baseImpact + interactionEffect;
  };

  /**
   * Calculate interaction effects between features
   */
  const calculateInteractionEffects = (
    featureName: string,
    featureValue: number,
    allFeatures: Features
  ): number => {
    let interactionEffect = 0;

    // Define feature interaction groups
    const interactionGroups: Record<string, string[]> = {
      gaze: ['fixationDuration', 'saccadeVelocity', 'pupilDilation', 'blinkRate'],
      physiological: ['heartRate', 'skinConductance', 'cortisol'],
      environmental: ['noiseLevel', 'temperature', 'lightingLevel'],
      cognitive: ['workingMemoryLoad', 'attentionFocus', 'cognitiveFlexibility'],
      temporal: ['circadianFactor', 'fatigueLevel', 'taskPhase']
    };

    // Find which group this feature belongs to
    let currentGroup: string | null = null;
    for (const [groupName, features] of Object.entries(interactionGroups)) {
      if (features.includes(featureName)) {
        currentGroup = groupName;
        break;
      }
    }

    if (!currentGroup) return 0;

    // Calculate interaction with other features in the same group
    const groupFeatures = interactionGroups[currentGroup];
    const presentGroupFeatures = groupFeatures.filter(name => 
      name !== featureName && allFeatures.hasOwnProperty(name)
    );

    for (const otherFeature of presentGroupFeatures) {
      const otherValue = allFeatures[otherFeature];
      const interaction = calculatePairwiseInteraction(
        featureName, featureValue,
        otherFeature, otherValue
      );
      interactionEffect += interaction;
    }

    // Cross-group interactions (e.g., fatigue affecting gaze patterns)
    if (currentGroup === 'gaze' && allFeatures.fatigueLevel) {
      const fatigueInteraction = -allFeatures.fatigueLevel * 0.1;
      interactionEffect += fatigueInteraction;
    }

    return Math.max(-0.2, Math.min(0.2, interactionEffect));
  };

  /**
   * Calculate pairwise interaction between two features
   */
  const calculatePairwiseInteraction = (
    feature1: string,
    value1: number,
    feature2: string,
    value2: number
  ): number => {
    // Define specific pairwise interactions
    const interactions: Record<string, Record<string, (v1: number, v2: number) => number>> = {
      pupilDilation: {
        heartRate: (pupil, hr) => pupil > 0.7 && hr > 0.7 ? 0.1 : 0,
        skinConductance: (pupil, sc) => pupil > 0.6 && sc > 0.6 ? 0.08 : 0
      },
      fatigueLevel: {
        circadianFactor: (fatigue, circadian) => fatigue > 0.6 && circadian < 0.4 ? -0.15 : 0,
        heartRate: (fatigue, hr) => fatigue > 0.5 && hr < 0.4 ? -0.1 : 0
      },
      workingMemoryLoad: {
        attentionFocus: (wml, af) => wml > 0.7 && af < 0.4 ? -0.12 : 0
      }
    };

    if (interactions[feature1]?.[feature2]) {
      return interactions[feature1][feature2](value1, value2);
    }

    // Symmetric check
    if (interactions[feature2]?.[feature1]) {
      return interactions[feature2][feature1](value2, value1);
    }

    return 0;
  };

  /**
   * Calculate attribution confidence based on feature reliability and context
   */
  const calculateAttributionConfidence = (
    featureName: string,
    impact: number,
    features: Features
  ): number => {
    // Base reliability
    const baseReliability = FEATURE_RELIABILITY[featureName] ?? 0.6;
    
    // Confidence decreases with extreme impact values (might be outliers)
    const impactConfidence = 1 - Math.min(0.3, Math.abs(impact) * 2);
    
    // Confidence increases if multiple correlated features support the finding
    const supportConfidence = calculateSupportingEvidence(featureName, impact, features);
    
    // Combined confidence with weighted average
    const combinedConfidence = 
      baseReliability * 0.5 + 
      impactConfidence * 0.3 + 
      supportConfidence * 0.2;
    
    return Math.max(0.1, Math.min(1.0, combinedConfidence));
  };

  /**
   * Calculate supporting evidence from correlated features
   */
  const calculateSupportingEvidence = (
    featureName: string,
    impact: number,
    features: Features
  ): number => {
    // Define correlated feature groups for cross-validation
    const correlations: Record<string, string[]> = {
      pupilDilation: ['heartRate', 'skinConductance'],
      fatigueLevel: ['blinkRate', 'circadianFactor', 'heartRate'],
      attentionFocus: ['fixationDuration', 'workingMemoryLoad']
    };

    const correlatedFeatures = correlations[featureName] ?? [];
    let supportingCount = 0;

    for (const correlatedFeature of correlatedFeatures) {
      if (features.hasOwnProperty(correlatedFeature)) {
        const correlatedImpact = calculateFeatureImpact(
          correlatedFeature,
          features[correlatedFeature],
          features,
          0 // dummy prediction value
        );
        
        // Check if impacts are in the same direction
        if (Math.sign(impact) === Math.sign(correlatedImpact)) {
          supportingCount++;
        }
      }
    }

    return correlatedFeatures.length > 0 
      ? supportingCount / correlatedFeatures.length 
      : 0.5;
  };

  /**
   * Calculate feature attributions using SHAP-like methodology
   */
  const calculateAttributions = (
    prediction: number,
    features: Features,
    baselineValue = 0.5
  ): Map<string, FeatureAttribution> => {
    const attributions = new Map<string, FeatureAttribution>();
    const featureNames = Object.keys(features);

    for (const featureName of featureNames) {
      const featureValue = features[featureName];
      
      // Calculate marginal contribution
      const impact = calculateFeatureImpact(
        featureName,
        featureValue,
        features,
        prediction
      );

      // Only include features that meet the attribution threshold
      if (Math.abs(impact) >= attributionThreshold) {
        const confidence = calculateAttributionConfidence(
          featureName,
          impact,
          features
        );

        attributions.set(featureName, {
          value: featureValue,
          attribution: impact,
          importance: Math.abs(impact),
          direction: impact > 0 ? 'increases' : 'decreases',
          confidence
        });
      }
    }

    // Sort by importance and limit to maxFeatures
    const sortedEntries = Array.from(attributions.entries())
      .sort(([, a], [, b]) => b.importance - a.importance)
      .slice(0, maxFeatures);

    return new Map(sortedEntries);
  };

  /**
   * Get most important features from attributions
   */
  const getImportantFeatures = (
    attributions: Map<string, FeatureAttribution>,
    maxCount = 5
  ): string[] => {
    return Array.from(attributions.entries())
      .sort(([, a], [, b]) => b.importance - a.importance)
      .slice(0, maxCount)
      .map(([name]) => name);
  };

  /**
   * Generate prediction explanation using feature attributions
   */
  const explainPrediction = (
    prediction: number,
    features: Features
  ): AttributionExplanation => {
    const attributions = calculateAttributions(prediction, features);
    
    // Calculate overall confidence as weighted average of individual confidences
    let totalWeight = 0;
    let weightedConfidence = 0;
    
    attributions.forEach(attr => {
      const weight = attr.importance;
      totalWeight += weight;
      weightedConfidence += attr.confidence * weight;
    });
    
    const overallConfidence = totalWeight > 0 
      ? weightedConfidence / totalWeight 
      : 0.5;

    return {
      attributions,
      confidence: Math.max(0.1, Math.min(1.0, overallConfidence)),
      methodology: enableShapley ? 'SHAP-like additive attributions' : 'Rule-based feature impact'
    };
  };

  return {
    explainPrediction,
    calculateAttributions,
    getImportantFeatures
  };
};