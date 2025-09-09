/**
 * @fileoverview Rule-Based Explanation Engine
 * 
 * Domain-specific rule engine for cognitive state explanations using
 * expert knowledge and heuristic reasoning with evidence strength calculation.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  RuleBasedExplainer,
  RuleBasedConfig,
  RuleExplanation,
  Rule,
  Features
} from './types.js';

/**
 * Cognitive state rules based on domain expertise and research literature
 */
const COGNITIVE_STATE_RULES: Rule[] = [
  {
    id: 'fatigue-high',
    condition: 'features.fatigueLevel > 0.7',
    conclusion: 'High cognitive fatigue detected',
    confidence: 0.9,
    support: 0.85,
    priority: 1
  },
  {
    id: 'circadian-low',
    condition: 'features.circadianFactor < 0.4',
    conclusion: 'Suboptimal circadian timing',
    confidence: 0.85,
    support: 0.8,
    priority: 2
  },
  {
    id: 'attention-scattered',
    condition: 'features.saccadeVelocity > 500 && features.fixationDuration < 150',
    conclusion: 'Scattered attention pattern',
    confidence: 0.8,
    support: 0.75,
    priority: 1
  },
  {
    id: 'cognitive-overload',
    condition: 'features.pupilDilation > 0.8 && features.blinkRate < 5',
    conclusion: 'Cognitive overload detected',
    confidence: 0.85,
    support: 0.8,
    priority: 1
  },
  {
    id: 'optimal-state',
    condition: 'features.circadianFactor > 0.7 && features.fatigueLevel < 0.3 && features.fixationDuration > 200',
    conclusion: 'Optimal cognitive state',
    confidence: 0.9,
    support: 0.85,
    priority: 3
  },
  {
    id: 'stress-indicators',
    condition: 'features.heartRate > 0.8 && features.skinConductance > 0.7',
    conclusion: 'Physiological stress detected',
    confidence: 0.8,
    support: 0.75,
    priority: 1
  },
  {
    id: 'flow-state',
    condition: 'features.fixationDuration > 300 && features.pupilDilation > 0.6 && features.pupilDilation < 0.8',
    conclusion: 'Flow state indicators present',
    confidence: 0.75,
    support: 0.7,
    priority: 3
  },
  {
    id: 'environmental-distraction',
    condition: 'features.noiseLevel > 0.7 || features.lightingLevel < 0.3 || features.lightingLevel > 0.9',
    conclusion: 'Environmental factors affecting performance',
    confidence: 0.7,
    support: 0.65,
    priority: 2
  },
  {
    id: 'task-difficulty-mismatch',
    condition: 'features.taskPhase === "fatigue" && features.workingMemoryLoad > 0.8',
    conclusion: 'Task difficulty exceeds current capacity',
    confidence: 0.85,
    support: 0.8,
    priority: 1
  },
  {
    id: 'recovery-needed',
    condition: 'features.continuousWorkTime > 7200000 && features.fatigueLevel > 0.6', // 2 hours
    conclusion: 'Extended work period requires recovery',
    confidence: 0.9,
    support: 0.9,
    priority: 1
  }
];

/**
 * Rule explanations and recommendations mapping
 */
const RULE_EXPLANATIONS: Record<string, {
  explanation: string;
  recommendations: string[];
  severity: 'info' | 'warning' | 'critical';
}> = {
  'fatigue-high': {
    explanation: 'Fatigue level indicates reduced cognitive capacity and increased error risk',
    recommendations: ['Take a 15-30 minute break', 'Reduce task complexity', 'Consider ending work session'],
    severity: 'critical'
  },
  'circadian-low': {
    explanation: 'Current time is outside your peak performance window based on circadian rhythms',
    recommendations: ['Schedule complex tasks for peak hours', 'Consider task timing optimization', 'Use bright light if needed'],
    severity: 'warning'
  },
  'attention-scattered': {
    explanation: 'Rapid eye movements with short fixations indicate difficulty maintaining focus',
    recommendations: ['Remove visual distractions', 'Practice attention training', 'Simplify visual interface'],
    severity: 'warning'
  },
  'cognitive-overload': {
    explanation: 'High pupil dilation and reduced blinking suggest mental strain and resource depletion',
    recommendations: ['Simplify current task', 'Take processing breaks', 'Reduce information density'],
    severity: 'critical'
  },
  'optimal-state': {
    explanation: 'Good circadian timing, low fatigue, and stable attention patterns indicate peak performance',
    recommendations: ['Ideal time for complex tasks', 'Maintain current conditions', 'Consider challenging work'],
    severity: 'info'
  },
  'stress-indicators': {
    explanation: 'Elevated heart rate and skin conductance suggest physiological stress response',
    recommendations: ['Practice relaxation techniques', 'Identify stress sources', 'Consider workload reduction'],
    severity: 'warning'
  },
  'flow-state': {
    explanation: 'Stable attention with moderate arousal suggests optimal engagement (flow state)',
    recommendations: ['Maintain current task', 'Minimize interruptions', 'Continue for optimal productivity'],
    severity: 'info'
  },
  'environmental-distraction': {
    explanation: 'Suboptimal environmental conditions may be impacting cognitive performance',
    recommendations: ['Adjust lighting levels', 'Reduce noise distractions', 'Optimize workspace ergonomics'],
    severity: 'warning'
  },
  'task-difficulty-mismatch': {
    explanation: 'Task complexity exceeds current cognitive capacity, leading to performance decline',
    recommendations: ['Break task into smaller parts', 'Seek assistance or resources', 'Consider task postponement'],
    severity: 'warning'
  },
  'recovery-needed': {
    explanation: 'Extended work period without adequate breaks leads to cumulative fatigue',
    recommendations: ['Take extended break (20-30 minutes)', 'Consider physical activity', 'Plan recovery time'],
    severity: 'critical'
  }
};

/**
 * Create rule-based explanation engine
 */
export const createRuleBasedExplainer = (config: RuleBasedConfig = {}): RuleBasedExplainer => {
  const {
    maxRules = 5,
    confidenceThreshold = 0.7,
    enableConditionalLogic = true
  } = config;

  // Custom rules added at runtime
  const customRules: Rule[] = [];
  const allRules = [...COGNITIVE_STATE_RULES];

  /**
   * Evaluate rule condition against features
   */
  const evaluateCondition = (condition: string, features: Features): boolean => {
    try {
      // Create a safe evaluation context
      const evalContext = {
        features,
        // Math functions for complex conditions
        Math,
        // Helper functions
        and: (a: boolean, b: boolean) => a && b,
        or: (a: boolean, b: boolean) => a || b,
        not: (a: boolean) => !a,
        between: (value: number, min: number, max: number) => value >= min && value <= max,
        // Threshold helpers
        isHigh: (value: number, threshold = 0.7) => value > threshold,
        isLow: (value: number, threshold = 0.3) => value < threshold,
        isNormal: (value: number, min = 0.3, max = 0.7) => value >= min && value <= max
      };

      // Use Function constructor for safer evaluation than eval()
      const conditionFunc = new Function('ctx', `
        with(ctx) {
          return ${condition};
        }
      `);

      return Boolean(conditionFunc(evalContext));
    } catch (error) {
      console.warn(`Failed to evaluate rule condition: ${condition}`, error);
      return false;
    }
  };

  /**
   * Apply rules to features and return matching rules
   */
  const applyRules = (features: Features): Array<Rule & { evidenceStrength: number }> => {
    const applicableRules = allRules
      .filter(rule => {
        try {
          return evaluateCondition(rule.condition, features) && 
                 rule.confidence >= confidenceThreshold;
        } catch (error) {
          console.warn(`Rule evaluation failed for ${rule.id}:`, error);
          return false;
        }
      })
      .map(rule => ({
        ...rule,
        evidenceStrength: calculateEvidenceStrength(rule, features)
      }))
      .sort((a, b) => {
        // Sort by priority first, then confidence, then evidence strength
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return b.evidenceStrength - a.evidenceStrength;
      })
      .slice(0, maxRules);

    return applicableRules;
  };

  /**
   * Calculate evidence strength for a rule
   */
  const calculateEvidenceStrength = (rule: Rule, features: Features): number => {
    try {
      // Extract relevant features from condition
      const relevantFeatures = extractRelevantFeatures(rule.condition, features);
      const featureCount = Object.keys(relevantFeatures).length;
      
      // Base strength from rule confidence and support
      const baseStrength = (rule.confidence + rule.support) / 2;
      
      // Bonus for multiple supporting features
      const featureBonus = Math.min(0.2, featureCount * 0.05);
      
      // Consistency bonus (if multiple features point in same direction)
      const consistencyBonus = calculateConsistencyBonus(relevantFeatures, rule);
      
      return Math.min(1.0, baseStrength + featureBonus + consistencyBonus);
    } catch (error) {
      console.warn(`Evidence strength calculation failed for ${rule.id}:`, error);
      return rule.confidence;
    }
  };

  /**
   * Extract features referenced in rule condition
   */
  const extractRelevantFeatures = (condition: string, features: Features): Features => {
    const relevantFeatures: Features = {};
    
    // Find feature names in condition string
    const featureRegex = /features\.(\w+)/g;
    let match;
    
    while ((match = featureRegex.exec(condition)) !== null) {
      const featureName = match[1];
      if (features.hasOwnProperty(featureName)) {
        relevantFeatures[featureName] = features[featureName];
      }
    }
    
    return relevantFeatures;
  };

  /**
   * Calculate consistency bonus for multiple features
   */
  const calculateConsistencyBonus = (relevantFeatures: Features, rule: Rule): number => {
    const featureValues = Object.values(relevantFeatures);
    if (featureValues.length < 2) return 0;
    
    // Simple consistency measure - all features should be in similar range
    // for the rule to be strongly supported
    const mean = featureValues.reduce((sum, val) => sum + val, 0) / featureValues.length;
    const variance = featureValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / featureValues.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency = higher bonus
    return Math.max(0, 0.1 - (standardDeviation * 0.1));
  };

  /**
   * Generate rule-based explanation
   */
  const explainWithRules = (features: Features): RuleExplanation => {
    try {
      const applicableRules = applyRules(features);
      const rulesWithDetails = applicableRules.map(rule => {
        const details = RULE_EXPLANATIONS[rule.id] || {
          explanation: rule.conclusion,
          recommendations: ['Monitor situation', 'Consider adjustments'],
          severity: 'info' as const
        };
        
        return {
          ...rule,
          ...details
        };
      });

      // Generate primary explanation
      const primaryRule = rulesWithDetails[0];
      const primaryExplanation = primaryRule 
        ? `${primaryRule.conclusion}. ${primaryRule.explanation}`
        : 'No clear cognitive patterns detected in current data';

      // Collect supporting facts
      const supportingFacts = rulesWithDetails.map(rule => 
        `${rule.conclusion} (confidence: ${(rule.confidence * 100).toFixed(0)}%)`
      );

      // Aggregate recommendations (top 3, avoiding duplicates)
      const allRecommendations = rulesWithDetails.flatMap(rule => rule.recommendations || []);
      const uniqueRecommendations = [...new Set(allRecommendations)].slice(0, 3);

      return {
        rules: rulesWithDetails,
        primaryExplanation,
        confidence: applicableRules.length > 0 ? applicableRules[0].confidence : 0.5,
        supportingFacts
      };
    } catch (error) {
      console.error('Rule-based explanation failed:', error);
      return {
        rules: [],
        primaryExplanation: 'Unable to generate rule-based explanation',
        confidence: 0.3,
        supportingFacts: ['Rule evaluation encountered an error']
      };
    }
  };

  /**
   * Add custom rule to the engine
   */
  const addCustomRule = (rule: Rule): boolean => {
    try {
      // Validate rule structure
      if (!rule.id || !rule.condition || !rule.conclusion) {
        console.warn('Invalid rule structure:', rule);
        return false;
      }

      // Test rule condition syntax
      const testFeatures: Features = {
        fatigueLevel: 0.5,
        circadianFactor: 0.5,
        saccadeVelocity: 250,
        fixationDuration: 200,
        pupilDilation: 0.5,
        blinkRate: 15
      };

      try {
        evaluateCondition(rule.condition, testFeatures);
      } catch (error) {
        console.warn('Invalid rule condition syntax:', rule.condition, error);
        return false;
      }

      // Add rule
      customRules.push(rule);
      allRules.push(rule);

      console.log(`Custom rule added: ${rule.id}`);
      return true;
    } catch (error) {
      console.error('Failed to add custom rule:', error);
      return false;
    }
  };

  /**
   * Evaluate specific rule against features
   */
  const evaluateRule = (rule: Rule, features: Features): boolean => {
    return evaluateCondition(rule.condition, features);
  };

  /**
   * Get all applicable rules for features
   */
  const getApplicableRules = (features: Features): Rule[] => {
    return allRules.filter(rule => evaluateCondition(rule.condition, features));
  };

  /**
   * Get rule statistics and performance metrics
   */
  const getRuleStatistics = () => {
    return {
      totalRules: allRules.length,
      builtInRules: COGNITIVE_STATE_RULES.length,
      customRules: customRules.length,
      ruleCategories: {
        fatigue: allRules.filter(r => r.id.includes('fatigue')).length,
        attention: allRules.filter(r => r.id.includes('attention')).length,
        circadian: allRules.filter(r => r.id.includes('circadian')).length,
        stress: allRules.filter(r => r.id.includes('stress')).length,
        optimal: allRules.filter(r => r.id.includes('optimal') || r.id.includes('flow')).length
      },
      averageConfidence: allRules.reduce((sum, r) => sum + r.confidence, 0) / allRules.length
    };
  };

  return {
    explainWithRules,
    addCustomRule,
    evaluateRule,
    getApplicableRules,
    getRuleStatistics
  };
};