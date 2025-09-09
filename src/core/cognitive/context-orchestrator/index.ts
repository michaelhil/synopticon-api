/**
 * @fileoverview Context Orchestrator - Main Export Interface
 * 
 * Unified export interface for the cognitive context orchestration system,
 * providing comprehensive decision routing and component coordination.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

// Main orchestrator engine
export { createContextOrchestrator } from './orchestrator-engine.js';

// Core components
export { createDecisionRouter, createDefaultRoutingRules } from './decision-router.js';
export { createComponentRegistry } from './component-registry.js';

// Type definitions
export type {
  // Core interfaces
  ContextOrchestrator,
  DecisionRouter,
  ComponentRegistry,
  CognitiveComponent,
  
  // Configuration types
  OrchestratorConfig,
  RoutingRule,
  
  // Context and data types
  CognitiveContext,
  RoutingResult,
  DecisionResult,
  AdvisoryRequest,
  AdvisoryResponse,
  
  // Health and metrics types
  ComponentHealth,
  ComponentMetrics,
  OrchestratorMetrics,
  OrchestratorEvents,
  
  // Factory types
  ContextOrchestratorFactory,
  DecisionRouterFactory,
  ComponentRegistryFactory,
  
  // Utility types
  ContextPath,
  ContextValue,
  ContextAnalyzer
} from './types.js';

/**
 * Default orchestrator configuration
 */
export const defaultOrchestratorConfig = {
  defaultTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  enableMetrics: true,
  logLevel: 'info' as const,
  healthCheckInterval: 60000,
  alertThresholds: {
    responseTime: 5000,
    errorRate: 0.1,
    resourceUsage: 0.8
  }
};

/**
 * Route type constants for easy reference
 */
export const RouteTypes = {
  EMERGENCY_RESPONSE: 'emergency-response',
  PERFORMANCE_INTERVENTION: 'performance-intervention',
  SITUATIONAL_AWARENESS: 'situational-awareness',
  MISSION_SUPPORT: 'mission-support',
  ROUTINE_ADVISORY: 'routine-advisory',
  SYSTEM_OPTIMIZATION: 'system-optimization',
  USER_INTERACTION: 'user-interaction',
  TEMPORAL_ADAPTATION: 'temporal-adaptation',
  DEFAULT_ADVISORY: 'default-advisory'
} as const;

/**
 * Component type constants
 */
export const ComponentTypes = {
  ANALYZER: 'analyzer',
  MONITOR: 'monitor',
  ADVISOR: 'advisor',
  CONTROLLER: 'controller'
} as const;

/**
 * Priority levels
 */
export const PriorityLevels = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

/**
 * Health status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  UNAVAILABLE: 'unavailable'
} as const;