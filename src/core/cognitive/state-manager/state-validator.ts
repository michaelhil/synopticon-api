/**
 * @fileoverview State Validation Engine
 * 
 * Comprehensive validation system for cognitive state data with
 * constraint checking, data quality assessment, and consistency validation.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  ValidationResult,
  CognitiveSystemState,
  CognitiveState,
  EmotionalState,
  PhysiologicalState,
  SystemState,
  EnvironmentalState,
  MissionState
} from './types.js';

/**
 * Validation constraints and rules
 */
const VALIDATION_CONSTRAINTS = {
  cognitive: {
    workload: { min: 0, max: 1, type: 'number' },
    fatigue: { min: 0, max: 1, type: 'number' },
    stress: { min: 0, max: 1, type: 'number' },
    attention: { min: 0, max: 1, type: 'number' },
    performance: { min: 0, max: 1, type: 'number' }
  },
  emotional: {
    valence: { min: -1, max: 1, type: 'number' },
    arousal: { min: 0, max: 1, type: 'number' },
    emotions: {
      happy: { min: 0, max: 1, type: 'number' },
      sad: { min: 0, max: 1, type: 'number' },
      angry: { min: 0, max: 1, type: 'number' },
      fearful: { min: 0, max: 1, type: 'number' },
      surprised: { min: 0, max: 1, type: 'number' },
      disgusted: { min: 0, max: 1, type: 'number' },
      neutral: { min: 0, max: 1, type: 'number' }
    }
  },
  physiological: {
    heartRate: { min: 40, max: 200, type: 'number' },
    bloodPressure: {
      systolic: { min: 70, max: 250, type: 'number' },
      diastolic: { min: 40, max: 150, type: 'number' }
    },
    breathing: {
      rate: { min: 8, max: 40, type: 'number' },
      depth: { min: 0, max: 1, type: 'number' }
    },
    skinConductance: { min: 0, max: 100, type: 'number' },
    eyeTracking: {
      pupilDiameter: { min: 2, max: 8, type: 'number' },
      blinkRate: { min: 0, max: 60, type: 'number' },
      gazeStability: { min: 0, max: 1, type: 'number' }
    }
  },
  system: {
    performance: {
      cpu: { min: 0, max: 1, type: 'number' },
      memory: { min: 0, max: 1, type: 'number' },
      network: { min: 0, max: 1, type: 'number' },
      storage: { min: 0, max: 1, type: 'number' }
    },
    health: {
      overall: { min: 0, max: 1, type: 'number' }
    },
    automation: {
      level: { min: 0, max: 1, type: 'number' },
      mode: { values: ['manual', 'semi-auto', 'auto'], type: 'enum' },
      reliability: { min: 0, max: 1, type: 'number' }
    },
    alerts: {
      active: { min: 0, type: 'integer' },
      severity: { values: ['low', 'medium', 'high', 'critical'], type: 'enum' },
      unacknowledged: { min: 0, type: 'integer' }
    }
  },
  environment: {
    risk: {
      weather: { min: 0, max: 1, type: 'number' },
      traffic: { min: 0, max: 1, type: 'number' },
      infrastructure: { min: 0, max: 1, type: 'number' },
      total: { min: 0, max: 1, type: 'number' }
    },
    conditions: {
      visibility: { min: 0, max: 1, type: 'number' },
      lighting: { min: 0, max: 1, type: 'number' },
      noise: { min: 0, max: 1, type: 'number' },
      temperature: { min: -50, max: 60, type: 'number' }
    },
    context: {
      timeOfDay: { values: ['morning', 'afternoon', 'evening', 'night'], type: 'enum' },
      workday: { type: 'boolean' },
      season: { values: ['spring', 'summer', 'fall', 'winter'], type: 'enum' },
      location: { type: 'string' }
    }
  },
  mission: {
    phase: { values: ['planning', 'execution', 'monitoring', 'completion'], type: 'enum' },
    progress: { min: 0, max: 1, type: 'number' },
    complexity: { min: 0, max: 1, type: 'number' }
  }
} as const;

/**
 * Create state validator with comprehensive validation rules
 */
export const createStateValidator = () => {
  
  const validateState = (state: Partial<CognitiveSystemState>): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Validate each subsystem
      if (state.human) {
        validateHumanState(state.human, errors, warnings);
      }
      
      if (state.system) {
        validateSystemState(state.system, errors, warnings);
      }
      
      if (state.environment) {
        validateEnvironmentalState(state.environment, errors, warnings);
      }
      
      if (state.mission) {
        validateMissionState(state.mission, errors, warnings);
      }
      
      if (state.metadata) {
        validateMetadata(state.metadata, errors, warnings);
      }
      
      // Cross-system consistency checks
      performConsistencyChecks(state, errors, warnings);
      
    } catch (error) {
      errors.push(`Validation failed: ${(error as Error).message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  };
  
  const validateHumanState = (
    human: Partial<CognitiveSystemState['human']>,
    errors: string[],
    warnings: string[]
  ): void => {
    if (human.cognitive) {
      validateCognitiveState(human.cognitive, errors, warnings);
    }
    
    if (human.emotional) {
      validateEmotionalState(human.emotional, errors, warnings);
    }
    
    if (human.physiological) {
      validatePhysiologicalState(human.physiological, errors, warnings);
    }
    
    // Cross-domain human state consistency
    if (human.cognitive && human.physiological) {
      checkCognitivePhysiologicalConsistency(human.cognitive, human.physiological, warnings);
    }
  };
  
  const validateCognitiveState = (
    cognitive: Partial<CognitiveState>,
    errors: string[],
    warnings: string[]
  ): void => {
    const constraints = VALIDATION_CONSTRAINTS.cognitive;
    
    Object.entries(cognitive).forEach(([key, value]) => {
      const constraint = constraints[key as keyof typeof constraints];
      if (!constraint) return;
      
      if (!validateFieldConstraint(key, value, constraint)) {
        errors.push(`Invalid cognitive.${key}: ${value} (expected ${constraint.min}-${constraint.max})`);
      }
      
      // Warning thresholds for cognitive load
      if (key === 'workload' && typeof value === 'number' && value > 0.8) {
        warnings.push('High cognitive workload detected (>0.8)');
      }
      if (key === 'fatigue' && typeof value === 'number' && value > 0.7) {
        warnings.push('High fatigue level detected (>0.7)');
      }
    });
  };
  
  const validateEmotionalState = (
    emotional: Partial<EmotionalState>,
    errors: string[],
    warnings: string[]
  ): void => {
    const constraints = VALIDATION_CONSTRAINTS.emotional;
    
    // Validate basic emotional metrics
    ['valence', 'arousal'].forEach(key => {
      const value = emotional[key as keyof EmotionalState];
      if (value !== undefined) {
        const constraint = constraints[key as keyof typeof constraints];
        if (!validateFieldConstraint(key, value, constraint)) {
          errors.push(`Invalid emotional.${key}: ${value}`);
        }
      }
    });
    
    // Validate emotion distribution
    if (emotional.emotions) {
      const emotionConstraints = constraints.emotions;
      let emotionSum = 0;
      
      Object.entries(emotional.emotions).forEach(([emotion, value]) => {
        const constraint = emotionConstraints[emotion as keyof typeof emotionConstraints];
        if (constraint && !validateFieldConstraint(`emotions.${emotion}`, value, constraint)) {
          errors.push(`Invalid emotional.emotions.${emotion}: ${value}`);
        }
        
        if (typeof value === 'number') {
          emotionSum += value;
        }
      });
      
      // Check emotion distribution sum
      if (Math.abs(emotionSum - 1) > 0.1) {
        warnings.push(`Emotion distribution sum is ${emotionSum.toFixed(2)}, expected ~1.0`);
      }
    }
  };
  
  const validatePhysiologicalState = (
    physiological: Partial<PhysiologicalState>,
    errors: string[],
    warnings: string[]
  ): void => {
    const constraints = VALIDATION_CONSTRAINTS.physiological;
    
    // Validate heart rate
    if (physiological.heartRate !== undefined) {
      if (!validateFieldConstraint('heartRate', physiological.heartRate, constraints.heartRate)) {
        errors.push(`Invalid physiological.heartRate: ${physiological.heartRate}`);
      }
      
      // Heart rate warnings
      if (typeof physiological.heartRate === 'number') {
        if (physiological.heartRate < 50) {
          warnings.push('Low heart rate detected (bradycardia)');
        } else if (physiological.heartRate > 150) {
          warnings.push('High heart rate detected (tachycardia)');
        }
      }
    }
    
    // Validate blood pressure
    if (physiological.bloodPressure) {
      const { systolic, diastolic } = physiological.bloodPressure;
      
      if (systolic !== undefined) {
        if (!validateFieldConstraint('bloodPressure.systolic', systolic, constraints.bloodPressure.systolic)) {
          errors.push(`Invalid physiological.bloodPressure.systolic: ${systolic}`);
        }
      }
      
      if (diastolic !== undefined) {
        if (!validateFieldConstraint('bloodPressure.diastolic', diastolic, constraints.bloodPressure.diastolic)) {
          errors.push(`Invalid physiological.bloodPressure.diastolic: ${diastolic}`);
        }
      }
      
      // Blood pressure consistency check
      if (typeof systolic === 'number' && typeof diastolic === 'number' && systolic <= diastolic) {
        errors.push('Systolic blood pressure must be higher than diastolic');
      }
    }
    
    // Validate breathing
    if (physiological.breathing) {
      const breathingConstraints = constraints.breathing;
      Object.entries(physiological.breathing).forEach(([key, value]) => {
        const constraint = breathingConstraints[key as keyof typeof breathingConstraints];
        if (constraint && !validateFieldConstraint(`breathing.${key}`, value, constraint)) {
          errors.push(`Invalid physiological.breathing.${key}: ${value}`);
        }
      });
    }
    
    // Validate eye tracking
    if (physiological.eyeTracking) {
      const eyeConstraints = constraints.eyeTracking;
      Object.entries(physiological.eyeTracking).forEach(([key, value]) => {
        const constraint = eyeConstraints[key as keyof typeof eyeConstraints];
        if (constraint && !validateFieldConstraint(`eyeTracking.${key}`, value, constraint)) {
          errors.push(`Invalid physiological.eyeTracking.${key}: ${value}`);
        }
      });
    }
  };
  
  const validateSystemState = (
    system: Partial<SystemState>,
    errors: string[],
    warnings: string[]
  ): void => {
    const constraints = VALIDATION_CONSTRAINTS.system;
    
    // Validate performance metrics
    if (system.performance) {
      Object.entries(system.performance).forEach(([key, value]) => {
        const constraint = constraints.performance[key as keyof typeof constraints.performance];
        if (constraint && !validateFieldConstraint(`performance.${key}`, value, constraint)) {
          errors.push(`Invalid system.performance.${key}: ${value}`);
        }
      });
    }
    
    // Validate automation settings
    if (system.automation) {
      const automationConstraints = constraints.automation;
      Object.entries(system.automation).forEach(([key, value]) => {
        const constraint = automationConstraints[key as keyof typeof automationConstraints];
        if (constraint && !validateFieldConstraint(`automation.${key}`, value, constraint)) {
          errors.push(`Invalid system.automation.${key}: ${value}`);
        }
      });
    }
    
    // Validate alerts
    if (system.alerts) {
      const alertConstraints = constraints.alerts;
      Object.entries(system.alerts).forEach(([key, value]) => {
        const constraint = alertConstraints[key as keyof typeof alertConstraints];
        if (constraint && !validateFieldConstraint(`alerts.${key}`, value, constraint)) {
          errors.push(`Invalid system.alerts.${key}: ${value}`);
        }
      });
    }
  };
  
  const validateEnvironmentalState = (
    environment: Partial<EnvironmentalState>,
    errors: string[],
    warnings: string[]
  ): void => {
    const constraints = VALIDATION_CONSTRAINTS.environment;
    
    // Validate risk factors
    if (environment.risk) {
      Object.entries(environment.risk).forEach(([key, value]) => {
        const constraint = constraints.risk[key as keyof typeof constraints.risk];
        if (constraint && !validateFieldConstraint(`risk.${key}`, value, constraint)) {
          errors.push(`Invalid environment.risk.${key}: ${value}`);
        }
      });
      
      // Check total risk calculation
      const { weather, traffic, infrastructure, total } = environment.risk;
      if (typeof weather === 'number' && typeof traffic === 'number' && 
          typeof infrastructure === 'number' && typeof total === 'number') {
        const expectedTotal = Math.min(1, weather + traffic + infrastructure);
        if (Math.abs(total - expectedTotal) > 0.1) {
          warnings.push(`Risk total (${total}) doesn't match sum of components (${expectedTotal})`);
        }
      }
    }
    
    // Validate conditions
    if (environment.conditions) {
      Object.entries(environment.conditions).forEach(([key, value]) => {
        const constraint = constraints.conditions[key as keyof typeof constraints.conditions];
        if (constraint && !validateFieldConstraint(`conditions.${key}`, value, constraint)) {
          errors.push(`Invalid environment.conditions.${key}: ${value}`);
        }
      });
    }
    
    // Validate context
    if (environment.context) {
      Object.entries(environment.context).forEach(([key, value]) => {
        const constraint = constraints.context[key as keyof typeof constraints.context];
        if (constraint && !validateFieldConstraint(`context.${key}`, value, constraint)) {
          errors.push(`Invalid environment.context.${key}: ${value}`);
        }
      });
    }
  };
  
  const validateMissionState = (
    mission: Partial<MissionState>,
    errors: string[],
    warnings: string[]
  ): void => {
    const constraints = VALIDATION_CONSTRAINTS.mission;
    
    Object.entries(mission).forEach(([key, value]) => {
      if (key === 'objectives' || key === 'timeline') return; // Special handling
      
      const constraint = constraints[key as keyof typeof constraints];
      if (constraint && !validateFieldConstraint(key, value, constraint)) {
        errors.push(`Invalid mission.${key}: ${value}`);
      }
    });
    
    // Validate timeline consistency
    if (mission.timeline) {
      const { start, estimated, actual } = mission.timeline;
      
      if (typeof start === 'number' && typeof estimated === 'number' && estimated < start) {
        errors.push('Mission estimated time must be after start time');
      }
      
      if (typeof actual === 'number' && typeof start === 'number' && actual < start) {
        errors.push('Mission actual time must be after start time');
      }
    }
  };
  
  const validateMetadata = (
    metadata: Partial<CognitiveSystemState['metadata']>,
    errors: string[],
    warnings: string[]
  ): void => {
    if (metadata.timestamp !== undefined && typeof metadata.timestamp !== 'number') {
      errors.push('Invalid metadata.timestamp: must be a number');
    }
    
    if (metadata.confidence !== undefined) {
      if (typeof metadata.confidence !== 'number' || metadata.confidence < 0 || metadata.confidence > 1) {
        errors.push('Invalid metadata.confidence: must be number between 0 and 1');
      }
    }
    
    if (metadata.version !== undefined && typeof metadata.version !== 'string') {
      errors.push('Invalid metadata.version: must be a string');
    }
  };
  
  return { validateState };
};

/**
 * Validate individual field against constraints
 */
const validateFieldConstraint = (
  field: string, 
  value: unknown, 
  constraint: any
): boolean => {
  if (value === undefined || value === null) return true; // Optional fields
  
  // Type checking
  switch (constraint.type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) return false;
      if (constraint.min !== undefined && value < constraint.min) return false;
      if (constraint.max !== undefined && value > constraint.max) return false;
      break;
      
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) return false;
      if (constraint.min !== undefined && value < constraint.min) return false;
      if (constraint.max !== undefined && value > constraint.max) return false;
      break;
      
    case 'string':
      if (typeof value !== 'string') return false;
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') return false;
      break;
      
    case 'enum':
      if (!constraint.values.includes(value)) return false;
      break;
      
    default:
      return true;
  }
  
  return true;
};

/**
 * Perform cross-system consistency checks
 */
const performConsistencyChecks = (
  state: Partial<CognitiveSystemState>,
  errors: string[],
  warnings: string[]
): void => {
  // Check cognitive-physiological consistency
  if (state.human?.cognitive && state.human?.physiological) {
    checkCognitivePhysiologicalConsistency(
      state.human.cognitive, 
      state.human.physiological, 
      warnings
    );
  }
  
  // Check system-environment consistency
  if (state.system && state.environment) {
    const systemHealth = state.system.health?.overall;
    const envRisk = state.environment.risk?.total;
    
    if (typeof systemHealth === 'number' && typeof envRisk === 'number') {
      // High environmental risk should correlate with lower system health
      if (envRisk > 0.7 && systemHealth > 0.8) {
        warnings.push('High environmental risk but system health is high - may indicate inconsistency');
      }
    }
  }
  
  // Check mission-cognitive consistency
  if (state.mission && state.human?.cognitive) {
    if (state.mission.complexity && state.human.cognitive.workload) {
      const complexity = state.mission.complexity;
      const workload = state.human.cognitive.workload;
      
      // High complexity should generally correlate with higher workload
      if (complexity > 0.8 && workload < 0.3) {
        warnings.push('High mission complexity but low cognitive workload - may indicate inconsistency');
      }
    }
  }
};

/**
 * Check cognitive-physiological state consistency
 */
const checkCognitivePhysiologicalConsistency = (
  cognitive: Partial<CognitiveState>,
  physiological: Partial<PhysiologicalState>,
  warnings: string[]
): void => {
  // High stress should correlate with elevated heart rate
  if (typeof cognitive.stress === 'number' && typeof physiological.heartRate === 'number') {
    if (cognitive.stress > 0.7 && physiological.heartRate < 70) {
      warnings.push('High stress but low heart rate - may indicate measurement inconsistency');
    }
  }
  
  // High workload should correlate with larger pupil diameter
  if (typeof cognitive.workload === 'number' && physiological.eyeTracking?.pupilDiameter) {
    if (cognitive.workload > 0.8 && physiological.eyeTracking.pupilDiameter < 4) {
      warnings.push('High cognitive workload but small pupil diameter - may indicate inconsistency');
    }
  }
  
  // Fatigue should correlate with increased blink rate
  if (typeof cognitive.fatigue === 'number' && physiological.eyeTracking?.blinkRate) {
    if (cognitive.fatigue > 0.7 && physiological.eyeTracking.blinkRate < 10) {
      warnings.push('High fatigue but low blink rate - may indicate inconsistency');
    }
  }
};

/**
 * Validation utilities
 */
export const ValidationUtils = {
  /**
   * Create custom validation rule
   */
  createCustomRule: (
    path: string,
    validator: (value: unknown) => boolean,
    message: string
  ) => ({
    path,
    validator,
    message
  }),

  /**
   * Validate value range
   */
  isInRange: (value: number, min: number, max: number): boolean => {
    return typeof value === 'number' && value >= min && value <= max;
  },

  /**
   * Validate enum value
   */
  isValidEnum: (value: unknown, validValues: readonly string[]): boolean => {
    return validValues.includes(value as string);
  },

  /**
   * Check if value is a valid timestamp
   */
  isValidTimestamp: (value: unknown): boolean => {
    if (typeof value !== 'number') return false;
    const date = new Date(value);
    return !isNaN(date.getTime()) && value > 0;
  },

  /**
   * Validate percentage (0-1 range)
   */
  isValidPercentage: (value: unknown): boolean => {
    return typeof value === 'number' && value >= 0 && value <= 1;
  }
};