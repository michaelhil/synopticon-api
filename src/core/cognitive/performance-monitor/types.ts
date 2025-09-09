/**
 * @fileoverview Type definitions for Performance Monitoring System
 * 
 * Comprehensive type definitions for cognitive system performance monitoring
 * including metrics, alerts, health assessment, and system optimization.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

export const METRIC_TYPES = {
  RESPONSE_TIME: 'response-time',
  THROUGHPUT: 'throughput',
  MEMORY_USAGE: 'memory-usage',
  CPU_USAGE: 'cpu-usage',
  ERROR_RATE: 'error-rate',
  DATA_QUALITY: 'data-quality',
  FUSION_ACCURACY: 'fusion-accuracy',
  PREDICTION_ACCURACY: 'prediction-accuracy',
  COMPONENT_HEALTH: 'component-health'
} as const;

export const PERFORMANCE_THRESHOLDS = {
  TACTICAL_RESPONSE_TIME: 50,      // ms
  OPERATIONAL_RESPONSE_TIME: 500,  // ms
  STRATEGIC_RESPONSE_TIME: 5000,   // ms
  MEMORY_WARNING: 0.8,             // 80% of available memory
  CPU_WARNING: 0.7,                // 70% CPU usage
  ERROR_RATE_WARNING: 0.05,        // 5% error rate
  DATA_QUALITY_WARNING: 0.7        // 70% data quality
} as const;

export type MetricType = typeof METRIC_TYPES[keyof typeof METRIC_TYPES];
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type SystemStatus = 'healthy' | 'warning' | 'degraded' | 'critical';
export type ComponentType = 'pipeline' | 'fusion' | 'llm' | 'predictor' | 'system';

export interface PerformanceMonitorConfig {
  readonly monitoringInterval?: number;
  readonly historySize?: number;
  readonly alertThresholds?: Partial<typeof PERFORMANCE_THRESHOLDS>;
  readonly enableAutoOptimization?: boolean;
  readonly enablePredictiveMonitoring?: boolean;
  readonly enableProactiveAlerting?: boolean;
  readonly maxAlertHistory?: number;
  readonly metricsRetentionPeriod?: number;
}

export interface MetricSample {
  readonly value: number;
  readonly timestamp: number;
  readonly metadata?: Record<string, unknown>;
}

export interface MetricStats {
  readonly current: number | null;
  readonly average: number;
  readonly min: number;
  readonly max: number;
  readonly trend: number;
  readonly standardDeviation: number;
  readonly sampleCount: number;
}

export interface Metric {
  type: MetricType;
  samples: MetricSample[];
  stats: MetricStats;
  lastUpdated: number;
}

export interface Alert {
  readonly id: string;
  readonly type: string;
  readonly severity: AlertSeverity;
  readonly message: string;
  readonly timestamp: number;
  readonly source: string;
  readonly resolved: boolean;
  readonly resolvedAt?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface PerformanceSummary {
  readonly timestamp: number;
  readonly overallHealth: number;
  readonly status: SystemStatus;
  readonly metrics: Record<string, {
    readonly current: number | null;
    readonly trend: number;
    readonly status: 'good' | 'warning' | 'critical';
  }>;
  readonly alerts: {
    readonly active: number;
    readonly total: number;
    readonly bySeveityCount: Record<AlertSeverity, number>;
  };
  readonly components: Record<string, {
    readonly health: number;
    readonly status: SystemStatus;
    readonly lastUpdate: number;
  }>;
  readonly recommendations?: string[];
}

export interface ComponentMetrics {
  readonly type: ComponentType;
  readonly health: number;
  readonly responseTime?: number;
  readonly throughput?: number;
  readonly errorRate?: number;
  readonly accuracy?: number;
  readonly dataQuality?: number;
  readonly memoryUsage?: number;
  readonly cpuUsage?: number;
  readonly customMetrics?: Record<string, number>;
}

export interface SystemResourceMetrics {
  readonly memoryUsage: {
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly heapPercent: number;
    readonly external: number;
    readonly rss: number;
  };
  readonly cpuUsage: number;
  readonly eventLoopLag?: number;
  readonly gcStats?: {
    readonly collections: number;
    readonly duration: number;
  };
}

export interface OptimizationRecommendation {
  readonly type: 'performance' | 'memory' | 'cpu' | 'configuration';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly impact: number;
  readonly effort: number;
  readonly actions: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface PredictiveMetrics {
  readonly metricType: MetricType;
  readonly predictedValue: number;
  readonly confidence: number;
  readonly timeHorizon: number; // ms into future
  readonly trend: 'increasing' | 'decreasing' | 'stable';
  readonly riskLevel: 'low' | 'medium' | 'high';
}

// Cognitive System interfaces (external dependencies)
export interface CognitiveSystem {
  readonly pipelineSystem?: {
    getMetrics(): ComponentMetrics;
    getHealth(): number;
  };
  readonly fusionEngine?: {
    getDataQuality(): number;
    getAccuracy(): number;
    getMetrics(): ComponentMetrics;
  };
  readonly llmIntegration?: {
    getMetrics(): ComponentMetrics;
    getHealth(): number;
  };
  readonly predictor?: {
    getAccuracy(): number;
    getMetrics(): ComponentMetrics;
  };
  readonly getOverallHealth?: () => number;
  readonly getErrorRate?: () => number;
}

export interface EventHooks {
  readonly onMetricCollected?: (metric: Metric) => void;
  readonly onAlertTriggered?: (alert: Alert) => void;
  readonly onHealthChanged?: (health: number, status: SystemStatus) => void;
  readonly onOptimizationRecommended?: (recommendations: OptimizationRecommendation[]) => void;
}

// Core interfaces for the monitoring system
export interface MetricsCollector {
  collectSystemMetrics(timestamp: number): Promise<SystemResourceMetrics>;
  collectComponentMetrics(timestamp: number): Promise<Record<string, ComponentMetrics>>;
  recordMetric(type: MetricType, value: number, timestamp: number, metadata?: Record<string, unknown>): void;
  getMetric(type: MetricType): Metric | undefined;
  getAllMetrics(): Map<MetricType, Metric>;
  clearOldMetrics(retentionPeriod: number): void;
}

export interface AlertManager {
  checkThresholds(metrics: Map<MetricType, Metric>): Alert[];
  addAlert(alert: Omit<Alert, 'id'>): Alert;
  resolveAlert(alertId: string): boolean;
  getActiveAlerts(): Alert[];
  getAllAlerts(): Alert[];
  clearOldAlerts(retentionPeriod: number): void;
  getAlertStats(): Record<AlertSeverity, number>;
}

export interface HealthAssessor {
  calculateOverallHealth(metrics: Map<MetricType, Metric>): number;
  calculateComponentHealth(component: ComponentMetrics): number;
  determineSystemStatus(health: number, alerts: Alert[]): SystemStatus;
  generateRecommendations(
    metrics: Map<MetricType, Metric>, 
    alerts: Alert[], 
    health: number
  ): OptimizationRecommendation[];
}

export interface PredictiveAnalyzer {
  predictMetricTrends(metrics: Map<MetricType, Metric>): PredictiveMetrics[];
  detectAnomalies(metrics: Map<MetricType, Metric>): Alert[];
  forecastResourceNeeds(timeHorizon: number): Record<string, number>;
  generateProactiveRecommendations(predictions: PredictiveMetrics[]): OptimizationRecommendation[];
}

export interface PerformanceMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  getPerformanceSummary(): PerformanceSummary;
  getMetrics(): Map<MetricType, Metric>;
  getAlerts(): Alert[];
  recordMetric(type: MetricType, value: number, timestamp?: number, metadata?: Record<string, unknown>): void;
  isMonitoring(): boolean;
  
  // Event handling
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}