/**
 * @fileoverview Cognitive State Manager - Main Export Interface
 * 
 * Unified export interface for the cognitive state management system,
 * providing comprehensive state tracking, pattern detection, and validation.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// Main state manager
export { createCognitiveStateManager } from './state-manager-engine.js';

// Core components
export { createTimeSeriesStore, TimeSeriesOperations } from './time-series-store.js';
export { createPatternDetector, PatternUtils } from './pattern-detector.js';
export { createStateValidator, ValidationUtils } from './state-validator.js';

// Type definitions
export type {
  // Core interfaces
  CognitiveStateManager,
  TimeSeriesStore,
  PatternDetector,
  
  // Configuration types
  StateManagerConfig,
  StateQueryOptions,
  
  // State structure types
  CognitiveSystemState,
  HumanState,
  CognitiveState,
  EmotionalState,
  PhysiologicalState,
  SystemState,
  EnvironmentalState,
  MissionState,
  
  // Analysis result types
  Pattern,
  TrendAnalysis,
  AnomalyResult,
  CorrelationResult,
  ValidationResult,
  
  // Event types
  StateChangeEvent,
  StateManagerEvents,
  
  // Utility types
  TimeSeriesEntry,
  StateManagerMetrics,
  StatePath,
  StateManagerFactory
} from './types.js';

/**
 * Default configuration for state manager
 */
export const defaultStateManagerConfig: StateManagerConfig = {
  maxHistorySize: 10000,
  patternDetectionEnabled: true,
  anomalyThreshold: 2.5,
  correlationThreshold: 0.5,
  validationEnabled: true,
  autoSave: false,
  saveInterval: 60000,
  enablePrediction: false
};

/**
 * Create a basic state manager with default settings
 */
export const createDefaultStateManager = () => {
  return createCognitiveStateManager(defaultStateManagerConfig);
};

/**
 * Create a lightweight state manager for testing/development
 */
export const createLightweightStateManager = () => {
  return createCognitiveStateManager({
    maxHistorySize: 1000,
    patternDetectionEnabled: false,
    validationEnabled: false,
    autoSave: false
  });
};

/**
 * Create a production-ready state manager with enhanced features
 */
export const createProductionStateManager = () => {
  return createCognitiveStateManager({
    maxHistorySize: 50000,
    patternDetectionEnabled: true,
    anomalyThreshold: 2.0,
    correlationThreshold: 0.6,
    validationEnabled: true,
    autoSave: true,
    saveInterval: 30000,
    enablePrediction: true
  });
};

/**
 * State path constants for type-safe access
 */
export const StatePaths = {
  // Human cognitive state
  COGNITIVE_WORKLOAD: 'human.cognitive.workload',
  COGNITIVE_FATIGUE: 'human.cognitive.fatigue',
  COGNITIVE_STRESS: 'human.cognitive.stress',
  COGNITIVE_ATTENTION: 'human.cognitive.attention',
  COGNITIVE_PERFORMANCE: 'human.cognitive.performance',
  
  // Human emotional state
  EMOTIONAL_VALENCE: 'human.emotional.valence',
  EMOTIONAL_AROUSAL: 'human.emotional.arousal',
  EMOTION_HAPPY: 'human.emotional.emotions.happy',
  EMOTION_SAD: 'human.emotional.emotions.sad',
  EMOTION_ANGRY: 'human.emotional.emotions.angry',
  EMOTION_FEARFUL: 'human.emotional.emotions.fearful',
  EMOTION_SURPRISED: 'human.emotional.emotions.surprised',
  EMOTION_DISGUSTED: 'human.emotional.emotions.disgusted',
  EMOTION_NEUTRAL: 'human.emotional.emotions.neutral',
  
  // Human physiological state
  HEART_RATE: 'human.physiological.heartRate',
  BLOOD_PRESSURE_SYSTOLIC: 'human.physiological.bloodPressure.systolic',
  BLOOD_PRESSURE_DIASTOLIC: 'human.physiological.bloodPressure.diastolic',
  BREATHING_RATE: 'human.physiological.breathing.rate',
  BREATHING_DEPTH: 'human.physiological.breathing.depth',
  SKIN_CONDUCTANCE: 'human.physiological.skinConductance',
  PUPIL_DIAMETER: 'human.physiological.eyeTracking.pupilDiameter',
  BLINK_RATE: 'human.physiological.eyeTracking.blinkRate',
  GAZE_STABILITY: 'human.physiological.eyeTracking.gazeStability',
  
  // System state
  SYSTEM_CPU: 'system.performance.cpu',
  SYSTEM_MEMORY: 'system.performance.memory',
  SYSTEM_NETWORK: 'system.performance.network',
  SYSTEM_STORAGE: 'system.performance.storage',
  SYSTEM_HEALTH: 'system.health.overall',
  AUTOMATION_LEVEL: 'system.automation.level',
  AUTOMATION_MODE: 'system.automation.mode',
  AUTOMATION_RELIABILITY: 'system.automation.reliability',
  ALERTS_ACTIVE: 'system.alerts.active',
  ALERTS_SEVERITY: 'system.alerts.severity',
  ALERTS_UNACKNOWLEDGED: 'system.alerts.unacknowledged',
  
  // Environmental state
  WEATHER_RISK: 'environment.risk.weather',
  TRAFFIC_RISK: 'environment.risk.traffic',
  INFRASTRUCTURE_RISK: 'environment.risk.infrastructure',
  TOTAL_RISK: 'environment.risk.total',
  VISIBILITY: 'environment.conditions.visibility',
  LIGHTING: 'environment.conditions.lighting',
  NOISE: 'environment.conditions.noise',
  TEMPERATURE: 'environment.conditions.temperature',
  TIME_OF_DAY: 'environment.context.timeOfDay',
  WORKDAY: 'environment.context.workday',
  SEASON: 'environment.context.season',
  LOCATION: 'environment.context.location',
  
  // Mission state
  MISSION_PHASE: 'mission.phase',
  MISSION_PROGRESS: 'mission.progress',
  MISSION_COMPLEXITY: 'mission.complexity'
} as const;

/**
 * Validation constraint constants
 */
export const ValidationConstants = {
  PERCENTAGE_MIN: 0,
  PERCENTAGE_MAX: 1,
  HEART_RATE_MIN: 40,
  HEART_RATE_MAX: 200,
  BLOOD_PRESSURE_SYSTOLIC_MIN: 70,
  BLOOD_PRESSURE_SYSTOLIC_MAX: 250,
  BLOOD_PRESSURE_DIASTOLIC_MIN: 40,
  BLOOD_PRESSURE_DIASTOLIC_MAX: 150,
  BREATHING_RATE_MIN: 8,
  BREATHING_RATE_MAX: 40,
  PUPIL_DIAMETER_MIN: 2,
  PUPIL_DIAMETER_MAX: 8,
  BLINK_RATE_MIN: 0,
  BLINK_RATE_MAX: 60,
  TEMPERATURE_MIN: -50,
  TEMPERATURE_MAX: 60
} as const;

/**
 * Pattern detection constants
 */
export const PatternConstants = {
  MIN_DATA_POINTS: 10,
  ANOMALY_THRESHOLD_LOW: 2.0,
  ANOMALY_THRESHOLD_MEDIUM: 2.5,
  ANOMALY_THRESHOLD_HIGH: 3.0,
  CORRELATION_THRESHOLD_WEAK: 0.3,
  CORRELATION_THRESHOLD_MODERATE: 0.5,
  CORRELATION_THRESHOLD_STRONG: 0.7,
  TREND_SIGNIFICANCE_LOW: 0.4,
  TREND_SIGNIFICANCE_MEDIUM: 0.6,
  TREND_SIGNIFICANCE_HIGH: 0.8
} as const;

/**
 * Utility functions for common operations
 */
export const StateManagerUtils = {
  /**
   * Generate state change event ID
   */
  generateEventId: (): string => {
    return `state_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Calculate time difference in human-readable format
   */
  formatTimeDifference: (timestamp1: number, timestamp2: number): string => {
    const diff = Math.abs(timestamp1 - timestamp2);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  },

  /**
   * Check if a state path is valid
   */
  isValidStatePath: (path: string): boolean => {
    return Object.values(StatePaths).includes(path as any);
  },

  /**
   * Get human-readable name for state path
   */
  getStatePathName: (path: string): string => {
    const pathNames: Record<string, string> = {
      [StatePaths.COGNITIVE_WORKLOAD]: 'Cognitive Workload',
      [StatePaths.COGNITIVE_FATIGUE]: 'Cognitive Fatigue',
      [StatePaths.COGNITIVE_STRESS]: 'Stress Level',
      [StatePaths.HEART_RATE]: 'Heart Rate',
      [StatePaths.SYSTEM_CPU]: 'CPU Usage',
      [StatePaths.TOTAL_RISK]: 'Total Environmental Risk',
      [StatePaths.MISSION_PROGRESS]: 'Mission Progress'
      // Add more mappings as needed
    };
    
    return pathNames[path] || path.split('.').pop() || path;
  },

  /**
   * Calculate state health score (0-1)
   */
  calculateStateHealth: (state: Partial<CognitiveSystemState>): number => {
    let totalScore = 0;
    let componentCount = 0;

    // Human state contribution
    if (state.human) {
      if (state.human.cognitive) {
        const cognitiveScore = 1 - Math.max(
          state.human.cognitive.fatigue || 0,
          state.human.cognitive.stress || 0,
          1 - (state.human.cognitive.performance || 1)
        );
        totalScore += cognitiveScore;
        componentCount++;
      }

      if (state.human.physiological) {
        const hr = state.human.physiological.heartRate || 70;
        const hrScore = hr > 60 && hr < 100 ? 1 : Math.max(0, 1 - Math.abs(hr - 80) / 40);
        totalScore += hrScore;
        componentCount++;
      }
    }

    // System state contribution
    if (state.system?.health?.overall !== undefined) {
      totalScore += state.system.health.overall;
      componentCount++;
    }

    // Environmental state contribution
    if (state.environment?.risk?.total !== undefined) {
      totalScore += 1 - state.environment.risk.total;
      componentCount++;
    }

    return componentCount > 0 ? totalScore / componentCount : 0.5;
  },

  /**
   * Generate state summary report
   */
  generateStateSummary: (state: Partial<CognitiveSystemState>): string => {
    const health = StateManagerUtils.calculateStateHealth(state);
    const timestamp = new Date(state.metadata?.timestamp || Date.now()).toISOString();
    
    const lines: string[] = [
      `State Summary Report - ${timestamp}`,
      `Overall Health Score: ${(health * 100).toFixed(1)}%`,
      ''
    ];

    if (state.human?.cognitive) {
      const cognitive = state.human.cognitive;
      lines.push('Cognitive State:');
      lines.push(`  Workload: ${((cognitive.workload || 0) * 100).toFixed(1)}%`);
      lines.push(`  Fatigue: ${((cognitive.fatigue || 0) * 100).toFixed(1)}%`);
      lines.push(`  Stress: ${((cognitive.stress || 0) * 100).toFixed(1)}%`);
      lines.push('');
    }

    if (state.system?.health) {
      lines.push('System Health:');
      lines.push(`  Overall: ${((state.system.health.overall || 0) * 100).toFixed(1)}%`);
      lines.push('');
    }

    if (state.environment?.risk) {
      lines.push('Environmental Risk:');
      lines.push(`  Total: ${((state.environment.risk.total || 0) * 100).toFixed(1)}%`);
      lines.push('');
    }

    if (state.mission) {
      lines.push('Mission Status:');
      lines.push(`  Phase: ${state.mission.phase || 'unknown'}`);
      lines.push(`  Progress: ${((state.mission.progress || 0) * 100).toFixed(1)}%`);
      lines.push('');
    }

    return lines.join('\n')

  }
};

/**
 * State manager event type constants
 */
export const StateManagerEventTypes = {
  STATE_CHANGED: 'stateChanged',
  PATTERN_DETECTED: 'patternDetected',
  ANOMALY_DETECTED: 'anomalyDetected',
  VALIDATION_ERROR: 'validationError'
} as const;

import type { CognitiveSystemState } from './types.js';