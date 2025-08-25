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
} from './types';

export {
  createAnalysisResult,
  createErrorResult,
  createHealthStatus,
  createPerformanceMetrics,
  createPerformanceProfile
} from './types';

// Pipeline system
export type {
  Pipeline,
  PipelineConfig
} from './pipeline';

export {
  createPipeline,
  validatePipelineConfig,
  findCompatiblePipelines,
  scorePipeline
} from './pipeline';

// Strategy system
export type {
  Strategy,
  StrategyConfig,
  PerformanceRecord,
  StrategyName
} from './strategies';

export {
  createStrategy,
  createPerformanceFirstStrategy,
  createAccuracyFirstStrategy,
  createBatteryOptimizedStrategy,
  createHybridStrategy,
  createAdaptiveStrategy,
  createStrategyRegistry,
  STRATEGIES
} from './strategies';

// Orchestrator system
export type {
  Orchestrator,
  OrchestratorConfig,
  CircuitBreaker
} from './orchestrator';

export {
  createOrchestrator,
  createCircuitBreaker
} from './orchestrator';

// Configuration system
export type {
  SynopticonConfig,
  SystemConfig,
  CanvasConfig,
  DetectionPipelineConfig,
  PerformanceConfig,
  ValidationResult
} from './configuration';

export {
  DEFAULT_CONFIG,
  createConfiguration,
  validateConfiguration,
  createPipelineConfiguration,
  CONFIG_PROFILES,
  createConfigurationFromPreset
} from './configuration';

// Parallel initialization
export type {
  ParallelInitializerConfig,
  InitializationResult,
  FailedInitialization
} from './parallel-initializer';

export {
  createParallelInitializer
} from './parallel-initializer';
