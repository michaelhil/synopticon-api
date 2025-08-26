/**
 * Core Synopticon API - TypeScript Native
 * Main entry point for all core functionality
 * Strict type safety across all exports
 */

// Core types and interfaces
export type {
  AnalysisResult,
  AnalysisRequirements, 
  PerformanceProfile,
  HealthStatus,
  PerformanceMetrics,
  ErrorResult,
  CapabilityType,
  ModelSize,
  UsageLevel,
} from './configuration/types';

export {
  createAnalysisResult,
  createErrorResult,
  createHealthStatus,
  createPerformanceMetrics,
  createPerformanceProfile
} from './configuration/types';

// Pipeline system
export type {
  Pipeline,
  PipelineConfig
} from './pipeline/pipeline';

export {
  createPipeline,
  validatePipelineConfig,
  findCompatiblePipelines,
  scorePipeline
} from './pipeline/pipeline';

// Strategy system
export type {
  Strategy,
  StrategyConfig,
  PerformanceRecord,
  StrategyName
} from './orchestration/strategies';

export {
  createStrategy,
  createPerformanceFirstStrategy,
  createAccuracyFirstStrategy,
  createBatteryOptimizedStrategy,
  createHybridStrategy,
  createAdaptiveStrategy,
  createStrategyRegistry,
  STRATEGIES
} from './orchestration/strategies';

// Orchestrator system
export type {
  Orchestrator,
  OrchestratorConfig,
  CircuitBreaker
} from './orchestration/orchestrator';

export {
  createOrchestrator,
  createCircuitBreaker
} from './orchestration/orchestrator';

// Configuration system
export type {
  SynopticonConfig,
  SystemConfig,
  CanvasConfig,
  DetectionPipelineConfig,
  PerformanceConfig,
  ValidationResult
} from './configuration/configuration';

export {
  DEFAULT_CONFIG,
  createConfiguration,
  validateConfiguration,
  createPipelineConfiguration,
  CONFIG_PROFILES,
  createConfigurationFromPreset
} from './configuration/configuration';

// Parallel initialization
export type {
  ParallelInitializerConfig,
  InitializationResult,
  FailedInitialization
} from './performance/parallel-initializer';

export {
  createParallelInitializer
} from './performance/parallel-initializer';
