/**
 * @fileoverview Context Orchestrator Type Definitions
 * 
 * Comprehensive type definitions for the cognitive context orchestration system,
 * including decision routing, component coordination, and advisory interfaces.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { EventEmitter } from 'events';

/**
 * Context information for decision making
 */
export interface CognitiveContext {
  alerts?: {
    level: 'low' | 'medium' | 'high' | 'critical';
    active: number;
    unacknowledged: number;
  };
  emergency?: boolean;
  performance?: {
    degraded: boolean;
    level: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  human?: {
    overload: boolean;
    fatigue: number;
    stress: number;
    cognitive: {
      workload: number;
      attention: number;
      performance: number;
    };
  };
  situational?: {
    awarenessLevel: 'low' | 'medium' | 'high';
    riskFactors: string[];
    environmentalRisk: number;
  };
  mission?: {
    phase: 'planning' | 'execution' | 'monitoring' | 'completion';
    progress: number;
    complexity: number;
    criticalPath: boolean;
  };
  system?: {
    health: number;
    automation: {
      level: number;
      mode: 'manual' | 'semi-auto' | 'auto';
      reliability: number;
    };
  };
  temporal?: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    sessionDuration: number;
    workload: 'low' | 'medium' | 'high';
  };
  user?: {
    preferences: Record<string, unknown>;
    history: unknown[];
    currentQuery?: string;
  };
  metadata?: {
    timestamp: number;
    confidence: number;
    source: string;
    version: string;
  };
}

/**
 * Routing rule for decision making
 */
export interface RoutingRule {
  id?: string;
  condition: (context: CognitiveContext) => boolean;
  route: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Decision routing result
 */
export interface RoutingResult {
  route: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  confidence: number;
  reasoning: string[];
  matchedRules: string[];
  alternatives: string[];
  metadata: {
    timestamp: number;
    processingTime: number;
    ruleCount: number;
  };
}

/**
 * Component interface for orchestrated systems
 */
export interface CognitiveComponent {
  id: string;
  name: string;
  type: 'analyzer' | 'monitor' | 'advisor' | 'controller';
  status: 'active' | 'inactive' | 'error' | 'initializing';
  capabilities: string[];
  
  // Lifecycle methods
  initialize: (config: Record<string, unknown>) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
  
  // Processing methods
  process?: (context: CognitiveContext) => Promise<unknown>;
  analyze?: (data: unknown) => Promise<unknown>;
  advise?: (context: CognitiveContext) => Promise<unknown>;
  
  // Event handling
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off: (event: string, listener: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
  
  // Health and metrics
  getHealth: () => ComponentHealth;
  getMetrics: () => ComponentMetrics;
}

/**
 * Component health status
 */
export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unavailable';
  uptime: number;
  lastError?: string;
  errorCount: number;
  performanceScore: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
  };
}

/**
 * Component metrics
 */
export interface ComponentMetrics {
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}

/**
 * Decision execution result
 */
export interface DecisionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  route: string;
  component: string;
  metadata: {
    timestamp: number;
    retryCount: number;
    timeoutOccurred: boolean;
  };
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  components?: CognitiveComponent[];
  routingRules?: RoutingRule[];
  defaultTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableMetrics?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  healthCheckInterval?: number;
  alertThresholds?: {
    responseTime: number;
    errorRate: number;
    resourceUsage: number;
  };
}

/**
 * Orchestrator events
 */
export interface OrchestratorEvents {
  contextReceived: {
    context: CognitiveContext;
    timestamp: number;
  };
  routingDecisionMade: {
    context: CognitiveContext;
    result: RoutingResult;
    timestamp: number;
  };
  decisionExecuted: {
    result: DecisionResult;
    context: CognitiveContext;
    timestamp: number;
  };
  componentRegistered: {
    component: CognitiveComponent;
    timestamp: number;
  };
  componentStatusChanged: {
    componentId: string;
    oldStatus: string;
    newStatus: string;
    timestamp: number;
  };
  errorOccurred: {
    error: string;
    context?: CognitiveContext;
    component?: string;
    timestamp: number;
  };
  metricsUpdated: {
    metrics: OrchestratorMetrics;
    timestamp: number;
  };
}

/**
 * Orchestrator metrics
 */
export interface OrchestratorMetrics {
  totalRequests: number;
  successfulDecisions: number;
  failedDecisions: number;
  averageDecisionTime: number;
  componentHealth: Record<string, ComponentHealth>;
  routingStats: Record<string, {
    count: number;
    successRate: number;
    averageTime: number;
  }>;
  systemHealth: {
    overall: number;
    components: number;
    responseTime: number;
    errorRate: number;
  };
}

/**
 * Advisory request structure
 */
export interface AdvisoryRequest {
  context: CognitiveContext;
  query?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requester: string;
  options?: {
    timeout?: number;
    includeAlternatives?: boolean;
    detailedReasoning?: boolean;
  };
}

/**
 * Advisory response structure
 */
export interface AdvisoryResponse {
  recommendation: string;
  confidence: number;
  reasoning: string[];
  alternatives: string[];
  actionItems: string[];
  timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    timestamp: number;
    processingTime: number;
    componentsConsulted: string[];
    source: string;
  };
}

/**
 * Context orchestrator interface
 */
export interface ContextOrchestrator {
  // Component management
  registerComponent: (component: CognitiveComponent) => Promise<void>;
  unregisterComponent: (componentId: string) => Promise<void>;
  getComponent: (componentId: string) => CognitiveComponent | null;
  getAllComponents: () => CognitiveComponent[];
  
  // Routing management
  addRoutingRule: (rule: RoutingRule) => void;
  removeRoutingRule: (ruleId: string) => void;
  updateRoutingRule: (ruleId: string, updates: Partial<RoutingRule>) => void;
  getRoutingRules: () => RoutingRule[];
  
  // Decision processing
  processContext: (context: CognitiveContext) => Promise<DecisionResult>;
  routeDecision: (context: CognitiveContext) => RoutingResult;
  executeDecision: (context: CognitiveContext, route: RoutingResult) => Promise<DecisionResult>;
  
  // Advisory interface
  requestAdvice: (request: AdvisoryRequest) => Promise<AdvisoryResponse>;
  
  // System control
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
  
  // Health and monitoring
  getHealth: () => ComponentHealth;
  getMetrics: () => OrchestratorMetrics;
  performHealthCheck: () => Promise<Record<string, ComponentHealth>>;
  
  // Event handling
  on: <K extends keyof OrchestratorEvents>(event: K, listener: (data: OrchestratorEvents[K]) => void) => void;
  off: <K extends keyof OrchestratorEvents>(event: K, listener: (data: OrchestratorEvents[K]) => void) => void;
  emit: <K extends keyof OrchestratorEvents>(event: K, data: OrchestratorEvents[K]) => void;
}

/**
 * Decision router interface
 */
export interface DecisionRouter {
  addRule: (rule: RoutingRule) => void;
  removeRule: (ruleId: string) => void;
  updateRule: (ruleId: string, updates: Partial<RoutingRule>) => void;
  route: (context: CognitiveContext) => RoutingResult;
  getRules: () => RoutingRule[];
  validateRule: (rule: RoutingRule) => boolean;
}

/**
 * Component registry interface
 */
export interface ComponentRegistry {
  register: (component: CognitiveComponent) => Promise<void>;
  unregister: (componentId: string) => Promise<void>;
  get: (componentId: string) => CognitiveComponent | null;
  getAll: () => CognitiveComponent[];
  getByType: (type: CognitiveComponent['type']) => CognitiveComponent[];
  getByCapability: (capability: string) => CognitiveComponent[];
  getHealthStatus: () => Record<string, ComponentHealth>;
}

/**
 * Factory function types
 */
export type ContextOrchestratorFactory = (config?: OrchestratorConfig) => ContextOrchestrator;
export type DecisionRouterFactory = (rules?: RoutingRule[]) => DecisionRouter;
export type ComponentRegistryFactory = () => ComponentRegistry;

/**
 * Utility types for context analysis
 */
export type ContextPath = keyof CognitiveContext | string;
export type ContextValue = unknown;
export type ContextAnalyzer = (context: CognitiveContext) => Record<string, unknown>;