/**
 * @fileoverview Information Fusion Engine Type Definitions
 * 
 * Comprehensive type definitions for multi-modal data fusion, quality assessment,
 * and cognitive component integration with situational awareness capabilities.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { EventEmitter } from 'events';

/**
 * Data source configurations with reliability weighting
 */
export interface DataSourceConfig {
  weight: number;
  latency: number;
  reliability: number;
}

export interface DataSources {
  human: {
    physiological: DataSourceConfig;
    behavioral: DataSourceConfig;
    self_report: DataSourceConfig;
    performance: DataSourceConfig;
  };
  simulator: {
    telemetry: DataSourceConfig;
    systems: DataSourceConfig;
    dynamics: DataSourceConfig;
    environment: DataSourceConfig;
  };
  external: {
    weather: DataSourceConfig;
    traffic: DataSourceConfig;
    navigation: DataSourceConfig;
    communications: DataSourceConfig;
  };
}

/**
 * Data quality assessment result
 */
export interface DataQualityAssessment {
  quality: number;
  confidence: number;
  issues: string[];
  staleness: number;
  completeness: number;
  consistency: number;
  plausibility: number;
}

/**
 * Basic data structure for fusion input
 */
export interface FusionData {
  timestamp?: number;
  type?: string;
  value?: unknown;
  [key: string]: unknown;
}

/**
 * Enriched data with quality assessment
 */
export interface EnrichedData extends FusionData {
  source: string;
  type: string;
  quality: DataQualityAssessment;
  ingested: number;
}

/**
 * Human physiological data
 */
export interface PhysiologicalData extends FusionData {
  heartRate?: number;
  heartRateVariability?: number;
  temperature?: number;
  eyeBlinkRate?: number;
  cortisol?: number;
  confidence?: number;
}

/**
 * Human behavioral data
 */
export interface BehavioralData extends FusionData {
  taskSwitchingRate?: number;
  reactionTimeIncrease?: number;
  errorRecoveryTime?: number;
  confidence?: number;
}

/**
 * Human performance data
 */
export interface PerformanceData extends FusionData {
  accuracy?: number;
  errorRate?: number;
  variability?: number;
  confidence?: number;
}

/**
 * Human self-report data
 */
export interface SelfReportData extends FusionData {
  workload?: number;
  fatigue?: number;
  stress?: number;
  confidence?: number;
}

/**
 * Human state fusion result
 */
export interface HumanStateFusion {
  cognitiveLoad: number;
  fatigue: number;
  stress: number;
  overallState: number;
  confidence: number;
  sources: string[];
}

/**
 * Weather data
 */
export interface WeatherData extends FusionData {
  visibility: number;
  windSpeed: number;
  precipitationIntensity: number;
}

/**
 * Traffic data
 */
export interface TrafficData extends FusionData {
  density: number;
  conflicts: unknown[];
}

/**
 * Terrain data
 */
export interface TerrainData extends FusionData {
  hazards: unknown[];
}

/**
 * Communications data
 */
export interface CommunicationsData extends FusionData {
  signalStrength?: number;
}

/**
 * Risk factor assessment
 */
export interface RiskFactor {
  type: string;
  risk: number;
  factors: string[];
  confidence?: number;
}

/**
 * Environmental fusion result
 */
export interface EnvironmentalFusion {
  totalRisk: number;
  riskFactors: RiskFactor[];
  recommendation: 'high-caution' | 'moderate-caution' | 'proceed-normal';
  confidence: number;
}

/**
 * System state data
 */
export interface SystemState extends FusionData {
  health?: number;
  complexity?: number;
}

/**
 * Situational awareness fusion result
 */
export interface SituationalAwarenessFusion {
  level: number;
  demand: number;
  capability: number;
  ratio: number;
  status: 'overload' | 'high-load' | 'moderate-load' | 'low-load';
  recommendations: string[];
}

/**
 * Temporal trend analysis
 */
export interface TemporalTrend {
  trend: 'insufficient-data' | 'stable' | 'increasing' | 'decreasing';
  slope?: number;
  confidence: number;
  samples: number;
}

/**
 * Temporal data point
 */
export interface TemporalDataPoint {
  value: number;
  quality: number;
  timestamp: number;
}

/**
 * Fusion algorithms interface
 */
export interface FusionAlgorithms {
  'human-state-fusion': (
    physiological?: PhysiologicalData,
    behavioral?: BehavioralData,
    performance?: PerformanceData,
    selfReport?: SelfReportData
  ) => HumanStateFusion;
  
  'environmental-fusion': (
    weather?: WeatherData,
    traffic?: TrafficData,
    terrain?: TerrainData,
    communications?: CommunicationsData
  ) => EnvironmentalFusion;
  
  'situational-awareness-fusion': (
    humanState: HumanStateFusion,
    systemState: SystemState,
    environmentState: EnvironmentalFusion
  ) => SituationalAwarenessFusion;
}

/**
 * Temporal fusion interface
 */
export interface TemporalFusion {
  addDataPoint: (key: string, data: TemporalDataPoint) => void;
  getTrend: (key: string, duration?: number) => TemporalTrend;
}

/**
 * External cognitive engine interfaces
 */
export interface TemporalContextEngine {
  analyzeTemporalContext: (data: {
    currentState: unknown;
    timestamp: number;
    fusionType: string;
  }) => {
    predictions?: unknown;
    trend?: number;
  };
}

export interface ExplainableAIEngine {
  explainPrediction: (data: {
    prediction: unknown;
    features: Record<string, unknown>;
    context: { fusionType: string; timestamp: number };
  }) => {
    confidence: number;
    uncertainty?: { upper: number; lower: number };
  };
  integrateTemporalContext?: (engine: TemporalContextEngine) => void;
}

export interface PredictionConfidenceVisualization {
  updateConfidence: (data: {
    timestamp: number;
    overallConfidence: number;
    featureConfidences: Map<string, number>;
    uncertaintyBounds: { upper: number; lower: number };
    predictionType: string;
    explanation: unknown;
    temporalTrend: number;
  }) => void;
  integrateWithCognitiveFusion?: (fusion: { on: Function; emit: Function }) => void;
  integrateWithExplainableAI?: (ai: ExplainableAIEngine) => void;
  integrateWithTemporalContext?: (temporal: TemporalContextEngine) => void;
}

/**
 * Advanced cognitive components bundle
 */
export interface AdvancedCognitiveComponents {
  temporalContext?: TemporalContextEngine;
  explainableAI?: ExplainableAIEngine;
  confidenceVisualization?: PredictionConfidenceVisualization;
}

/**
 * Fusion result with enhancements
 */
export interface EnhancedFusionResult {
  timestamp: number;
  fusionType: string;
  confidence?: number;
  temporalContext?: {
    predictions?: unknown;
    trend?: number;
  };
  temporalPredictions?: unknown;
  explanation?: {
    confidence: number;
    uncertainty?: { upper: number; lower: number };
  };
  [key: string]: unknown;
}

/**
 * Data quality summary
 */
export interface DataQualitySummary {
  sources: number;
  averageQuality: number;
  averageConfidence: number;
  issues: string[];
  bySource: Record<string, DataQualityAssessment>;
}

/**
 * Fusion events
 */
export interface FusionEvents {
  dataIngested: { source: string; type: string; data: EnrichedData };
  fusionCompleted: { type: string; result: EnhancedFusionResult };
  predictionUpdate: EnhancedFusionResult;
}

/**
 * Information fusion engine configuration
 */
export interface InformationFusionConfig {
  dataSources?: Partial<DataSources>;
  maxHistory?: number;
  fusionThresholds?: {
    human?: number;
    environmental?: number;
    situational?: number;
  };
  enableTemporalAnalysis?: boolean;
  enableQualityAssessment?: boolean;
}

/**
 * Information fusion engine interface
 */
export interface InformationFusionEngine {
  // Core data ingestion
  ingestData: (source: string, type: string, data: FusionData) => DataQualityAssessment;
  
  // Fusion results
  getFusionResult: (type: string) => EnhancedFusionResult | undefined;
  getAllFusionResults: () => Record<string, EnhancedFusionResult>;
  
  // Quality and trends
  getDataQuality: () => DataQualitySummary;
  getTrends: (duration?: number) => Record<string, TemporalTrend>;
  
  // Event handling
  on: <K extends keyof FusionEvents>(event: K, listener: (data: FusionEvents[K]) => void) => void;
  off: <K extends keyof FusionEvents>(event: K, listener: (data: FusionEvents[K]) => void) => void;
  emit: <K extends keyof FusionEvents>(event: K, data: FusionEvents[K]) => void;
  
  // Component integrations
  integrateTemporalContextEngine: (engine: TemporalContextEngine) => void;
  integrateExplainableAI: (engine: ExplainableAIEngine) => void;
  integratePredictionConfidenceVisualization: (visualization: PredictionConfidenceVisualization) => void;
  integrateAdvancedCognitiveComponents: (components: AdvancedCognitiveComponents) => void;
}

/**
 * Quality assessment function types
 */
export type DataQualityAssessor = (data: FusionData, source: string, type: string) => DataQualityAssessment;
export type CompletenessCalculator = (data: FusionData) => number;
export type ConsistencyChecker = (data: FusionData, source: string, type: string) => number;
export type PlausibilityChecker = (data: FusionData, source: string, type: string) => number;

/**
 * Feature extraction function types
 */
export type FeatureExtractor = (result: EnhancedFusionResult) => Record<string, unknown>;
export type ConfidenceExtractor = (result: EnhancedFusionResult) => Map<string, number>;

/**
 * Factory function types
 */
export type FusionAlgorithmsFactory = () => FusionAlgorithms;
export type TemporalFusionFactory = () => TemporalFusion;
export type InformationFusionEngineFactory = (config?: InformationFusionConfig) => InformationFusionEngine;

/**
 * Fusion trigger condition
 */
export interface FusionTriggerCondition {
  requiredKeys: string[];
  optional?: boolean;
  minimumQuality?: number;
  maximumAge?: number;
}

/**
 * Fusion pipeline configuration
 */
export interface FusionPipelineConfig {
  triggers: Record<string, FusionTriggerCondition>;
  algorithms: Partial<FusionAlgorithms>;
  qualityThresholds: Record<string, number>;
}

/**
 * Statistics for monitoring
 */
export interface FusionStatistics {
  totalIngestions: number;
  totalFusions: number;
  fusionsByType: Record<string, number>;
  averageProcessingTime: number;
  qualityDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  integrationStatus: {
    temporalContext: boolean;
    explainableAI: boolean;
    confidenceVisualization: boolean;
  };
}

/**
 * Fusion performance metrics
 */
export interface FusionPerformanceMetrics {
  latency: {
    ingestion: number;
    fusion: number;
    total: number;
  };
  throughput: {
    dataPoints: number;
    fusionsPerSecond: number;
  };
  accuracy: {
    predictiveAccuracy: number;
    confidenceCalibration: number;
  };
  reliability: {
    systemUptime: number;
    errorRate: number;
    recoveryTime: number;
  };
}