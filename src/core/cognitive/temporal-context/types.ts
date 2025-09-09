/**
 * @fileoverview Type definitions for Temporal Context Engine
 * 
 * Comprehensive type definitions for advanced temporal modeling including
 * circadian rhythms, fatigue accumulation, task progression, and temporal patterns.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

export type Chronotype = 'morning' | 'evening' | 'neutral';
export type TaskPhase = 'orientation' | 'adaptation' | 'performance' | 'plateau' | 'fatigue' | 'recovery';
export type WorkloadLevel = 'low' | 'moderate' | 'high' | 'critical';
export type ContextualState = 'optimal' | 'good' | 'suboptimal' | 'concerning';

export interface SleepSchedule {
  readonly bedtime: string; // Format: "HH:MM"
  readonly wakeup: string;  // Format: "HH:MM"
}

export interface UserProfile {
  readonly chronotype?: Chronotype;
  readonly timezone?: string;
  readonly sleepSchedule?: SleepSchedule;
  readonly melatoninOffset?: number; // Hours from average
  readonly age?: number;
  readonly fitnessLevel?: number; // 0-1
  readonly caffeineConsumption?: number; // mg/day
  readonly preferences?: {
    readonly optimalWorkPeriod?: number; // milliseconds
    readonly preferredBreakFrequency?: number; // minutes
    readonly maxContinuousWork?: number; // minutes
  };
}

export interface CircadianPrediction {
  readonly timestamp: number;
  readonly alertness: number; // 0-1
  readonly confidence: number; // 0-1
}

export interface CircadianModel {
  getCircadianFactor(timestamp: number): number;
  getAttentionCapacity(timestamp: number): number;
  getPredictedPeakHours(): number[];
  getAlertnessPrediction(timestamp: number, hoursAhead?: number): CircadianPrediction[];
  getCurrentPerformancePhase(timestamp: number): 'peak' | 'good' | 'moderate' | 'low';
  calculateOptimalWorkPeriods(startTime: number, duration: number): Array<{
    start: number;
    end: number;
    expectedPerformance: number;
  }>;
}

export interface FatigueConfig {
  readonly maxWorkPeriod?: number; // milliseconds
  readonly fatigueThreshold?: number; // 0-1
  readonly recoveryRate?: number; // per hour
  readonly cognitiveLoadWeight?: number; // 0-1
  readonly physicalLoadWeight?: number; // 0-1
  readonly microrecoveryRate?: number; // per minute
}

export interface FatigueState {
  homeostaticPressure: number; // Sleep pressure (0-1)
  workFatigue: number; // Work-related fatigue (0-1)
  cognitiveLoad: number; // Current cognitive load (0-1)
  physicalLoad: number; // Current physical load (0-1)
  lastRestTime: number; // Timestamp
  continuousWorkTime: number; // milliseconds
  totalWorkToday: number; // milliseconds
  microRecoveryAccumulated: number; // accumulated micro-breaks
}

export interface FatigueMetrics {
  readonly overall: number; // 0-1 overall fatigue
  readonly cognitive: number; // 0-1 cognitive fatigue
  readonly physical: number; // 0-1 physical fatigue
  readonly timeToExhaustion: number; // milliseconds until threshold
  readonly recoveryNeeded: number; // milliseconds of rest needed
  readonly currentCapacity: number; // 0-1 current performance capacity
}

export interface FatigueModel {
  updateWorkload(cognitiveLoad: number, physicalLoad: number, timestamp: number): void;
  addRestPeriod(duration: number, timestamp: number): void;
  getCurrentFatigue(timestamp: number): FatigueMetrics;
  predictFatigueProgression(hoursAhead: number): Array<{
    timestamp: number;
    predictedFatigue: number;
    confidence: number;
  }>;
  getOptimalBreakTiming(timestamp: number): {
    recommendedBreakTime: number;
    breakDuration: number;
    urgency: 'low' | 'medium' | 'high';
  };
  resetDaily(timestamp: number): void;
  getState(): FatigueState;
  setState(state: Partial<FatigueState>): void;
}

export interface TaskProgressionConfig {
  readonly phases?: TaskPhase[];
  readonly phaseDurations?: Record<TaskPhase, number>; // milliseconds
  readonly complexityFactors?: {
    readonly learning?: number; // 0-1
    readonly adaptation?: number; // 0-1
    readonly maintenance?: number; // 0-1
  };
  readonly performanceModifiers?: {
    readonly experience?: number; // 0-1
    readonly familiarity?: number; // 0-1
    readonly toolQuality?: number; // 0-1
  };
}

export interface TaskMetrics {
  readonly currentPhase: TaskPhase;
  readonly phaseProgress: number; // 0-1 within current phase
  readonly overallProgress: number; // 0-1 overall task completion
  readonly performanceEfficiency: number; // 0-1 current efficiency
  readonly predictedCompletionTime: number; // milliseconds
  readonly optimalContinuationTime: number; // milliseconds until break needed
}

export interface TaskProgressionModel {
  startTask(taskType: string, estimatedDuration: number, complexity: number, timestamp: number): void;
  updateProgress(actualProgress: number, timestamp: number): void;
  getCurrentMetrics(timestamp: number): TaskMetrics;
  predictPerformanceDecline(hoursAhead: number): Array<{
    timestamp: number;
    predictedEfficiency: number;
    confidence: number;
  }>;
  getOptimalTaskSwitch(timestamp: number): {
    recommendedSwitchTime: number;
    newTaskType: string;
    reasoning: string;
  };
  completeTask(timestamp: number): void;
  getTaskHistory(): Array<{
    taskType: string;
    startTime: number;
    endTime: number;
    efficiency: number;
    phases: Array<{ phase: TaskPhase; duration: number; efficiency: number }>;
  }>;
}

export interface TemporalContextConfig {
  readonly userProfile?: UserProfile;
  readonly circadian?: {
    readonly enablePersonalization?: boolean;
    readonly adaptationRate?: number; // 0-1
    readonly predictionHorizon?: number; // hours
  };
  readonly fatigue?: FatigueConfig;
  readonly taskProgression?: TaskProgressionConfig;
  readonly integration?: {
    readonly enableRealTimeUpdates?: boolean;
    readonly updateInterval?: number; // milliseconds
    readonly enablePredictions?: boolean;
    readonly maxPredictionHorizon?: number; // hours
  };
  readonly optimization?: {
    readonly enableAutoRecommendations?: boolean;
    readonly adaptiveScheduling?: boolean;
    readonly personalizedBreaks?: boolean;
  };
}

export interface TemporalContext {
  readonly timestamp: number;
  readonly circadianFactor: number; // 0-1
  readonly fatigueLevel: number; // 0-1
  readonly attentionCapacity: number; // 0-1
  readonly taskPhase: TaskPhase;
  readonly overallPerformanceFactor: number; // 0-1
  readonly contextualState: ContextualState;
  readonly predictions: {
    readonly alertness: CircadianPrediction[];
    readonly fatigue: Array<{ timestamp: number; level: number; confidence: number }>;
    readonly performance: Array<{ timestamp: number; efficiency: number; confidence: number }>;
  };
  readonly recommendations: TemporalRecommendation[];
}

export interface TemporalRecommendation {
  readonly type: 'break' | 'task-switch' | 'schedule-optimization' | 'environmental-adjustment';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly timing: number; // when to implement (timestamp)
  readonly duration?: number; // how long (milliseconds)
  readonly expectedBenefit: number; // 0-1
  readonly confidence: number; // 0-1
  readonly metadata?: Record<string, unknown>;
}

export interface TemporalPattern {
  readonly patternType: 'daily' | 'weekly' | 'task-specific' | 'circadian';
  readonly strength: number; // 0-1
  readonly confidence: number; // 0-1
  readonly description: string;
  readonly peakTimes: number[]; // timestamps or hours
  readonly lowTimes: number[]; // timestamps or hours
  readonly recommendations: string[];
}

export interface TemporalAnalytics {
  readonly patterns: TemporalPattern[];
  readonly optimization: {
    readonly potentialGains: number; // 0-1
    readonly implementationEffort: number; // 0-1
    readonly recommendations: TemporalRecommendation[];
  };
  readonly insights: {
    readonly workloadTrends: string[];
    readonly performanceInsights: string[];
    readonly healthImplications: string[];
  };
}

export interface TemporalContextEngine {
  // Core functionality
  updateContext(timestamp: number): TemporalContext;
  getCurrentContext(): TemporalContext | null;
  
  // Workload management
  updateWorkload(cognitiveLoad: number, physicalLoad?: number, timestamp?: number): void;
  addRestPeriod(duration: number, timestamp?: number): void;
  
  // Task management
  startTask(taskType: string, estimatedDuration: number, complexity: number, timestamp?: number): void;
  updateTaskProgress(progress: number, timestamp?: number): void;
  completeTask(timestamp?: number): void;
  
  // Predictions and analysis
  predictPerformance(hoursAhead: number): Array<{
    timestamp: number;
    performanceFactor: number;
    confidence: number;
    context: TemporalContext;
  }>;
  
  analyzeTemporalPatterns(lookbackPeriod?: number): TemporalAnalytics;
  
  // Recommendations
  getRecommendations(timestamp?: number): TemporalRecommendation[];
  getOptimalSchedule(tasks: Array<{
    type: string;
    duration: number;
    complexity: number;
    priority: number;
  }>, timeHorizon: number): Array<{
    task: string;
    startTime: number;
    endTime: number;
    expectedEfficiency: number;
  }>;
  
  // Configuration and personalization
  updateUserProfile(profile: Partial<UserProfile>): void;
  calibrateModels(performanceData: Array<{
    timestamp: number;
    actualPerformance: number;
    context: Partial<TemporalContext>;
  }>): void;
  
  // Integration
  integrateWithCognitiveFusion(fusionEngine: any): boolean;
  
  // State management
  exportState(): Record<string, unknown>;
  importState(state: Record<string, unknown>): boolean;
  
  // Cleanup
  cleanup(): void;
}

// External system integration interfaces
export interface CognitiveFusionEngine {
  addTemporalContext?: (context: TemporalContext) => void;
  getPerformanceMetrics?: () => {
    accuracy: number;
    responseTime: number;
    confidence: number;
  };
}

// Event and monitoring interfaces
export interface TemporalEventData {
  readonly type: 'workload-change' | 'task-start' | 'task-complete' | 'break-start' | 'break-end';
  readonly timestamp: number;
  readonly data: Record<string, unknown>;
}

export interface TemporalMetrics {
  readonly averagePerformance: number;
  readonly fatigueRecoveryRate: number;
  readonly circadianAlignmentScore: number;
  readonly taskEfficiencyTrend: number;
  readonly optimalWorkPeriods: Array<{ start: number; end: number; efficiency: number }>;
  readonly suboptimalPeriods: Array<{ start: number; end: number; issues: string[] }>;
}