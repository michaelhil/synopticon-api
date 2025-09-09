/**
 * @fileoverview Causal Reasoning Engine for Cognitive State Analysis
 * 
 * Implements causal inference for understanding relationships between
 * environmental/physiological factors and cognitive performance outcomes.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  CausalReasoningEngine,
  CausalReasoningConfig,
  CausalExplanation,
  Features,
  CausalGraph,
  CausalRelationship,
  InterventionSuggestion
} from './types.js';

/**
 * Predefined causal relationships based on cognitive science research
 */
const CAUSAL_RELATIONSHIPS: CausalRelationship[] = [
  {
    cause: 'high_fatigue',
    effects: ['reduced_attention', 'increased_errors', 'slower_processing'],
    strength: 0.85,
    evidenceLevel: 'strong',
    interventions: ['rest_break', 'task_simplification', 'schedule_adjustment']
  },
  {
    cause: 'poor_circadian_timing',
    effects: ['reduced_alertness', 'slower_processing'],
    strength: 0.75,
    evidenceLevel: 'moderate',
    interventions: ['bright_light_therapy', 'schedule_optimization', 'caffeine_strategic']
  },
  {
    cause: 'cognitive_overload',
    effects: ['increased_errors', 'reduced_attention', 'stress_response'],
    strength: 0.8,
    evidenceLevel: 'strong',
    interventions: ['task_breakdown', 'reduce_information_density', 'priority_focus']
  },
  {
    cause: 'environmental_stressors',
    effects: ['reduced_attention', 'increased_stress', 'performance_decline'],
    strength: 0.7,
    evidenceLevel: 'moderate',
    interventions: ['environment_optimization', 'noise_reduction', 'lighting_adjustment']
  },
  {
    cause: 'dehydration',
    effects: ['reduced_attention', 'slower_processing', 'fatigue_increase'],
    strength: 0.6,
    evidenceLevel: 'moderate',
    interventions: ['hydration_reminder', 'water_intake_increase']
  },
  {
    cause: 'sleep_deprivation',
    effects: ['reduced_attention', 'impaired_memory', 'decreased_performance'],
    strength: 0.9,
    evidenceLevel: 'strong',
    interventions: ['sleep_scheduling', 'power_nap', 'sleep_hygiene']
  }
];

/**
 * Feature-to-cause mapping for causal inference
 */
const FEATURE_CAUSE_MAP: Record<string, string[]> = {
  fatigueLevel: ['high_fatigue', 'sleep_deprivation'],
  circadianFactor: ['poor_circadian_timing'],
  pupilDilation: ['cognitive_overload', 'stress_response'],
  heartRate: ['stress_response', 'environmental_stressors'],
  skinConductance: ['stress_response', 'environmental_stressors'],
  noiseLevel: ['environmental_stressors'],
  temperature: ['environmental_stressors'],
  lightingLevel: ['environmental_stressors'],
  workingMemoryLoad: ['cognitive_overload'],
  taskPhase: ['cognitive_overload', 'poor_circadian_timing']
};

/**
 * Create causal reasoning engine for cognitive state analysis
 */
export const createCausalReasoningEngine = (config: CausalReasoningConfig = {}): CausalReasoningEngine => {
  const {
    strengthThreshold = 0.6,
    maxCauses = 3,
    enableInterventions = true,
    confidenceThreshold = 0.7
  } = config;

  /**
   * Perform causal analysis on features
   */
  const performCausalAnalysis = (features: Features): CausalExplanation => {
    try {
      // Identify potential causes from features
      const potentialCauses = identifyPotentialCauses(features);
      
      // Calculate causal strengths
      const causalStrengths = calculateCausalStrengths(potentialCauses, features);
      
      // Filter and rank causes
      const significantCauses = causalStrengths
        .filter(cause => cause.strength >= strengthThreshold)
        .sort((a, b) => b.strength - a.strength)
        .slice(0, maxCauses);

      // Generate causal graph
      const causalGraph = generateCausalGraph(significantCauses);

      // Primary cause analysis
      const primaryCause = significantCauses[0] || null;
      
      // Generate intervention suggestions
      const interventionSuggestions = enableInterventions 
        ? generateInterventionSuggestions(significantCauses)
        : [];

      // Calculate explanation confidence
      const confidence = calculateExplanationConfidence(significantCauses, features);

      return {
        causalGraph,
        primaryCause: primaryCause ? {
          causeName: formatCauseName(primaryCause.cause),
          strength: primaryCause.strength,
          effects: primaryCause.effects.map(formatEffectName),
          evidence: generateCausalEvidence(primaryCause, features),
          interventions: primaryCause.interventions || []
        } : null,
        alternativeCauses: significantCauses.slice(1).map(cause => ({
          causeName: formatCauseName(cause.cause),
          strength: cause.strength,
          effects: cause.effects.map(formatEffectName)
        })),
        interventionSuggestions,
        confidence,
        causalChains: generateCausalChains(significantCauses),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Causal analysis failed:', error);
      return {
        causalGraph: { nodes: [], edges: [] },
        primaryCause: null,
        alternativeCauses: [],
        interventionSuggestions: [],
        confidence: 0.3,
        causalChains: [],
        timestamp: Date.now()
      };
    }
  };

  /**
   * Identify potential causes from feature values
   */
  const identifyPotentialCauses = (features: Features): CausalRelationship[] => {
    const causes = new Set<string>();
    
    // Map features to potential causes
    Object.entries(features).forEach(([featureName, value]) => {
      const potentialCauses = FEATURE_CAUSE_MAP[featureName];
      if (potentialCauses) {
        // Check if feature value suggests this cause
        if (shouldConsiderCause(featureName, value)) {
          potentialCauses.forEach(cause => causes.add(cause));
        }
      }
    });

    return CAUSAL_RELATIONSHIPS.filter(rel => causes.has(rel.cause));
  };

  /**
   * Determine if feature value suggests considering a cause
   */
  const shouldConsiderCause = (featureName: string, value: unknown): boolean => {
    if (typeof value !== 'number') return false;
    
    // Threshold-based cause consideration
    const thresholds: Record<string, number> = {
      fatigueLevel: 0.5,
      circadianFactor: 0.6, // Low circadian factor suggests poor timing
      pupilDilation: 0.7,
      heartRate: 0.6,
      skinConductance: 0.6,
      noiseLevel: 0.6,
      workingMemoryLoad: 0.7
    };

    const threshold = thresholds[featureName];
    if (!threshold) return true; // Consider if no specific threshold

    // For circadianFactor, low values suggest poor timing
    if (featureName === 'circadianFactor') {
      return value < (1 - threshold); // Invert for circadian factor
    }

    return value > threshold;
  };

  /**
   * Calculate causal strength based on feature evidence
   */
  const calculateCausalStrengths = (causes: CausalRelationship[], features: Features): CausalRelationship[] => {
    return causes.map(cause => {
      let evidenceStrength = 0;
      let featureCount = 0;

      // Calculate evidence from relevant features
      Object.entries(features).forEach(([featureName, value]) => {
        if (FEATURE_CAUSE_MAP[featureName]?.includes(cause.cause)) {
          if (typeof value === 'number') {
            evidenceStrength += calculateFeatureEvidence(featureName, value);
            featureCount++;
          }
        }
      });

      // Adjust strength based on evidence and base relationship strength
      const adjustedStrength = featureCount > 0 
        ? (cause.strength * 0.7) + (evidenceStrength / featureCount * 0.3)
        : cause.strength * 0.5; // Reduce strength if no supporting evidence

      return {
        ...cause,
        strength: Math.max(0, Math.min(1, adjustedStrength))
      };
    });
  };

  /**
   * Calculate evidence strength from a single feature
   */
  const calculateFeatureEvidence = (featureName: string, value: number): number => {
    // Feature-specific evidence calculation
    switch (featureName) {
      case 'fatigueLevel':
        return Math.min(1, Math.max(0, (value - 0.3) / 0.7));
      case 'circadianFactor':
        return Math.min(1, Math.max(0, (0.7 - value) / 0.7)); // Inverted
      case 'pupilDilation':
        return Math.min(1, Math.max(0, (value - 0.6) / 0.4));
      case 'heartRate':
        return Math.min(1, Math.max(0, (value - 0.5) / 0.5));
      case 'workingMemoryLoad':
        return Math.min(1, Math.max(0, (value - 0.6) / 0.4));
      default:
        return Math.min(1, Math.max(0, (value - 0.5) / 0.5));
    }
  };

  /**
   * Generate causal graph representation
   */
  const generateCausalGraph = (causes: CausalRelationship[]): CausalGraph => {
    const nodes = [
      ...causes.map(cause => ({
        id: cause.cause,
        type: 'cause' as const,
        label: formatCauseName(cause.cause),
        strength: cause.strength
      })),
      ...Array.from(new Set(causes.flatMap(c => c.effects))).map(effect => ({
        id: effect,
        type: 'effect' as const,
        label: formatEffectName(effect),
        strength: 0.5 // Default effect strength
      }))
    ];

    const edges = causes.flatMap(cause => 
      cause.effects.map(effect => ({
        from: cause.cause,
        to: effect,
        strength: cause.strength,
        type: 'causal' as const
      }))
    );

    return { nodes, edges };
  };

  /**
   * Generate intervention suggestions
   */
  const generateInterventionSuggestions = (causes: CausalRelationship[]): InterventionSuggestion[] => {
    const interventions = new Map<string, InterventionSuggestion>();

    causes.forEach(cause => {
      cause.interventions?.forEach(intervention => {
        if (!interventions.has(intervention)) {
          interventions.set(intervention, {
            type: intervention,
            description: getInterventionDescription(intervention),
            priority: calculateInterventionPriority(intervention, cause.strength),
            estimatedEffectiveness: cause.strength * 0.8, // Conservative estimate
            timeToEffect: getInterventionTimeframe(intervention),
            difficulty: getInterventionDifficulty(intervention)
          });
        } else {
          // Update priority if this intervention addresses a stronger cause
          const existing = interventions.get(intervention)!;
          const newPriority = calculateInterventionPriority(intervention, cause.strength);
          if (newPriority > existing.priority) {
            existing.priority = newPriority;
            existing.estimatedEffectiveness = Math.max(existing.estimatedEffectiveness, cause.strength * 0.8);
          }
        }
      });
    });

    return Array.from(interventions.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5); // Top 5 interventions
  };

  /**
   * Calculate explanation confidence
   */
  const calculateExplanationConfidence = (causes: CausalRelationship[], features: Features): number => {
    if (causes.length === 0) return 0.3;

    // Base confidence on strongest cause
    const strongestCause = causes[0];
    let confidence = strongestCause.strength * 0.6;

    // Bonus for multiple supporting causes
    const supportingCauses = causes.filter(c => c.strength > strengthThreshold).length;
    confidence += Math.min(0.3, supportingCauses * 0.1);

    // Bonus for feature coverage
    const relevantFeatures = Object.keys(features).filter(f => FEATURE_CAUSE_MAP[f]).length;
    const totalFeatures = Object.keys(features).length;
    const coverage = totalFeatures > 0 ? relevantFeatures / totalFeatures : 0;
    confidence += coverage * 0.1;

    return Math.max(0.3, Math.min(1.0, confidence));
  };

  /**
   * Generate causal chains showing cause-effect relationships
   */
  const generateCausalChains = (causes: CausalRelationship[]): Array<{
    cause: string;
    effects: string[];
    strength: number;
  }> => {
    return causes.map(cause => ({
      cause: formatCauseName(cause.cause),
      effects: cause.effects.map(formatEffectName),
      strength: cause.strength
    }));
  };

  /**
   * Generate evidence description for primary cause
   */
  const generateCausalEvidence = (cause: CausalRelationship, features: Features): string[] => {
    const evidence: string[] = [];

    // Find supporting features
    Object.entries(features).forEach(([featureName, value]) => {
      if (FEATURE_CAUSE_MAP[featureName]?.includes(cause.cause) && typeof value === 'number') {
        const featureEvidence = calculateFeatureEvidence(featureName, value);
        if (featureEvidence > 0.5) {
          evidence.push(`${formatFeatureName(featureName)}: ${(value * 100).toFixed(0)}%`);
        }
      }
    });

    return evidence.length > 0 ? evidence : ['Based on behavioral pattern analysis'];
  };

  return {
    performCausalAnalysis
  };
};

/**
 * Get intervention description
 */
const getInterventionDescription = (intervention: string): string => {
  const descriptions: Record<string, string> = {
    'rest_break': 'Take a 15-30 minute break to restore cognitive resources',
    'task_simplification': 'Reduce task complexity or break into smaller parts',
    'schedule_adjustment': 'Reschedule demanding tasks to optimal time periods',
    'bright_light_therapy': 'Use bright light to improve alertness and circadian timing',
    'schedule_optimization': 'Align work schedule with natural circadian rhythms',
    'caffeine_strategic': 'Strategic caffeine timing to enhance alertness',
    'task_breakdown': 'Break complex tasks into manageable components',
    'reduce_information_density': 'Simplify visual interface and reduce cognitive load',
    'priority_focus': 'Focus on highest priority tasks only',
    'environment_optimization': 'Improve workspace conditions for better focus',
    'noise_reduction': 'Reduce environmental noise and distractions',
    'lighting_adjustment': 'Optimize lighting levels for cognitive performance',
    'hydration_reminder': 'Maintain adequate hydration levels',
    'water_intake_increase': 'Increase water consumption',
    'sleep_scheduling': 'Improve sleep schedule consistency',
    'power_nap': 'Take a 20-minute power nap',
    'sleep_hygiene': 'Improve sleep environment and habits'
  };

  return descriptions[intervention] || intervention.replace(/_/g, ' ');
};

/**
 * Calculate intervention priority
 */
const calculateInterventionPriority = (intervention: string, causeStrength: number): number => {
  const baseEffectiveness: Record<string, number> = {
    'rest_break': 0.8,
    'sleep_scheduling': 0.9,
    'task_simplification': 0.7,
    'environment_optimization': 0.6,
    'schedule_adjustment': 0.8
  };

  const effectiveness = baseEffectiveness[intervention] || 0.6;
  return causeStrength * effectiveness;
};

/**
 * Get intervention timeframe
 */
const getInterventionTimeframe = (intervention: string): string => {
  const timeframes: Record<string, string> = {
    'rest_break': '15-30 minutes',
    'power_nap': '20 minutes',
    'hydration_reminder': '10-15 minutes',
    'task_breakdown': 'immediate',
    'environment_optimization': '5-10 minutes',
    'schedule_adjustment': '1-24 hours',
    'sleep_scheduling': '1-7 days',
    'bright_light_therapy': '30-60 minutes'
  };

  return timeframes[intervention] || 'varies';
};

/**
 * Get intervention difficulty level
 */
const getInterventionDifficulty = (intervention: string): 'low' | 'medium' | 'high' => {
  const difficulties: Record<string, 'low' | 'medium' | 'high'> = {
    'rest_break': 'low',
    'power_nap': 'low',
    'hydration_reminder': 'low',
    'task_breakdown': 'low',
    'environment_optimization': 'medium',
    'schedule_adjustment': 'medium',
    'sleep_scheduling': 'high',
    'bright_light_therapy': 'medium'
  };

  return difficulties[intervention] || 'medium';
};

/**
 * Format cause name for display
 */
const formatCauseName = (causeType: string): string => {
  const nameMap: Record<string, string> = {
    'high_fatigue': 'High fatigue',
    'poor_circadian_timing': 'Suboptimal timing',
    'cognitive_overload': 'Mental overload',
    'environmental_stressors': 'Environmental stress',
    'dehydration': 'Dehydration',
    'sleep_deprivation': 'Sleep deprivation'
  };
  
  return nameMap[causeType] || causeType.replace(/_/g, ' ');
};

/**
 * Format effect name for display
 */
const formatEffectName = (effectType: string): string => {
  const nameMap: Record<string, string> = {
    'reduced_attention': 'attention',
    'increased_errors': 'accuracy',
    'slower_processing': 'processing speed',
    'reduced_alertness': 'alertness',
    'impaired_memory': 'memory',
    'decreased_performance': 'performance',
    'stress_response': 'stress levels',
    'fatigue_increase': 'fatigue levels'
  };
  
  return nameMap[effectType] || effectType.replace(/_/g, ' ');
};

/**
 * Format feature name for display
 */
const formatFeatureName = (featureName: string): string => {
  const nameMap: Record<string, string> = {
    'fixationDuration': 'gaze stability',
    'saccadeVelocity': 'eye movement speed',
    'pupilDilation': 'pupil size',
    'blinkRate': 'blink frequency',
    'circadianFactor': 'time of day alertness',
    'fatigueLevel': 'fatigue',
    'taskPhase': 'task stage',
    'noiseLevel': 'noise',
    'temperature': 'temperature comfort',
    'heartRate': 'heart rate',
    'skinConductance': 'skin conductance',
    'workingMemoryLoad': 'working memory load'
  };
  
  return nameMap[featureName] || featureName.replace(/([A-Z])/g, ' $1').toLowerCase();
};