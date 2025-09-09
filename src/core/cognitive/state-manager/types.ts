/**
 * @fileoverview Cognitive State Manager Type Definitions
 * 
 * Comprehensive type definitions for the cognitive state management system,
 * including state structures, pattern detection, and temporal analysis.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

/**
 * Time series entry structure
 */
export interface TimeSeriesEntry<T = unknown> {
  value: T;
  timestamp: number;
}

/**
 * Time series store interface
 */
export interface TimeSeriesStore {
  record: (path: string, value: unknown, timestamp?: number) => void;
  query: (path: string, duration: number) => TimeSeriesEntry[];
  getLatest: (path: string) => TimeSeriesEntry | null;
  clear: (path?: string) => void;
  getAllPaths: () => string[];
}

/**
 * Cognitive state structure
 */
export interface CognitiveState {
  workload: number;
  fatigue: number;
  stress: number;
  attention: number;
  performance: number;
}

/**
 * Emotional state structure
 */
export interface EmotionalState {
  valence: number;
  arousal: number;
  emotions: {
    happy: number;
    sad: number;
    angry: number;
    fearful: number;
    surprised: number;
    disgusted: number;
    neutral: number;
  };
}

/**
 * Physiological state structure
 */
export interface PhysiologicalState {
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  breathing: {
    rate: number;
    depth: number;
  };
  skinConductance: number;
  eyeTracking: {
    pupilDiameter: number;
    blinkRate: number;
    gazeStability: number;
  };
}

/**
 * Human state encompassing all aspects
 */
export interface HumanState {
  cognitive: CognitiveState;
  emotional: EmotionalState;
  physiological: PhysiologicalState;
}

/**
 * System state structure
 */
export interface SystemState {
  performance: {
    cpu: number;
    memory: number;
    network: number;
    storage: number;
  };
  health: {
    overall: number;
    components: Record<string, number>;
  };
  automation: {
    level: number;
    mode: 'manual' | 'semi-auto' | 'auto';
    reliability: number;
  };
  alerts: {
    active: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    unacknowledged: number;
  };
}

/**
 * Environmental state structure
 */
export interface EnvironmentalState {
  risk: {
    weather: number;
    traffic: number;
    infrastructure: number;
    total: number;
  };
  conditions: {
    visibility: number;
    lighting: number;
    noise: number;
    temperature: number;
  };
  context: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    workday: boolean;
    season: 'spring' | 'summer' | 'fall' | 'winter';
    location: string;
  };
}

/**
 * Mission state structure
 */
export interface MissionState {
  phase: 'planning' | 'execution' | 'monitoring' | 'completion';
  progress: number;
  objectives: {
    primary: string[];
    secondary: string[];
    completed: string[];
  };
  timeline: {
    start: number;
    estimated: number;
    actual?: number;
  };
  complexity: number;
}

/**
 * Complete state structure
 */
export interface CognitiveSystemState {
  human: HumanState;
  system: SystemState;
  environment: EnvironmentalState;
  mission: MissionState;
  metadata: {
    timestamp: number;
    version: string;
    confidence: number;
    source: string;
  };
}

/**
 * Pattern detection result
 */
export interface Pattern {
  type: 'trend' | 'anomaly' | 'cycle' | 'correlation';
  confidence: number;
  description: string;
  parameters: Record<string, unknown>;
  timespan: {
    start: number;
    end: number;
    duration: number;
  };
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  confidence: number;
  r_squared: number;
  significance: 'low' | 'medium' | 'high';
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  threshold: number;
  context: string;
}

/**
 * Correlation analysis result
 */
export interface CorrelationResult {
  coefficient: number;
  strength: 'none' | 'weak' | 'moderate' | 'strong' | 'very-strong';
  significance: boolean;
  pValue?: number;
}

/**
 * Pattern detector interface
 */
export interface PatternDetector {
  detectTrend: (series: TimeSeriesEntry<number>[]) => TrendAnalysis;
  detectAnomaly: (series: TimeSeriesEntry<number>[], threshold?: number) => AnomalyResult;
  findPattern: (series: TimeSeriesEntry<number>[], type?: Pattern['type']) => Pattern | null;
  calculateCorrelation: (series1: number[], series2: number[]) => CorrelationResult;
}

/**
 * State change event
 */
export interface StateChangeEvent {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  source: string;
}

/**
 * State validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * State manager configuration
 */
export interface StateManagerConfig {
  maxHistorySize?: number;
  patternDetectionEnabled?: boolean;
  anomalyThreshold?: number;
  correlationThreshold?: number;
  validationEnabled?: boolean;
  autoSave?: boolean;
  saveInterval?: number;
  enablePrediction?: boolean;
}

/**
 * State manager events
 */
export interface StateManagerEvents {
  stateChanged: StateChangeEvent;
  patternDetected: {
    pattern: Pattern;
    path: string;
    timestamp: number;
  };
  anomalyDetected: {
    anomaly: AnomalyResult;
    path: string;
    timestamp: number;
  };
  validationError: {
    errors: string[];
    path: string;
    timestamp: number;
  };
}

/**
 * State query options
 */
export interface StateQueryOptions {
  timeRange?: {
    start: number;
    end: number;
  };
  includeMetadata?: boolean;
  maxResults?: number;
  aggregation?: 'none' | 'avg' | 'min' | 'max' | 'sum';
}

/**
 * State manager interface
 */
export interface CognitiveStateManager {
  // State management
  getState: (path?: string) => unknown;
  setState: (path: string, value: unknown, source?: string) => void;
  updateState: (updates: Partial<CognitiveSystemState>, source?: string) => void;
  
  // Historical queries
  getHistory: (path: string, duration: number, options?: StateQueryOptions) => TimeSeriesEntry[];
  getStateSnapshot: (timestamp: number) => CognitiveSystemState | null;
  
  // Pattern analysis
  analyzePattern: (path: string, duration: number) => Pattern[];
  detectTrends: (path: string, duration: number) => TrendAnalysis;
  findAnomalies: (path: string, duration: number) => AnomalyResult[];
  calculateCorrelation: (path1: string, path2: string, duration: number) => CorrelationResult;
  
  // Validation
  validateState: (state: Partial<CognitiveSystemState>) => ValidationResult;
  
  // Event handling
  on: <K extends keyof StateManagerEvents>(event: K, listener: (data: StateManagerEvents[K]) => void) => void;
  off: <K extends keyof StateManagerEvents>(event: K, listener: (data: StateManagerEvents[K]) => void) => void;
  emit: <K extends keyof StateManagerEvents>(event: K, data: StateManagerEvents[K]) => void;
  
  // Utility methods
  reset: (preserveHistory?: boolean) => void;
  export: () => string;
  import: (data: string) => boolean;
  getMetrics: () => StateManagerMetrics;
}

/**
 * State manager metrics
 */
export interface StateManagerMetrics {
  totalUpdates: number;
  patternsDetected: number;
  anomaliesFound: number;
  validationErrors: number;
  averageUpdateTime: number;
  memoryUsage: number;
  historicalDataPoints: number;
}

/**
 * State path utilities
 */
export type StatePath = keyof CognitiveSystemState | string;

/**
 * Factory function type
 */
export type StateManagerFactory = (config?: StateManagerConfig) => CognitiveStateManager;