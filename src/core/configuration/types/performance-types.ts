/**
 * Performance and Health Types
 * Types for performance profiling, metrics, and health monitoring
 */

export type ModelSize = 'small' | 'medium' | 'large' | 'extra_large' | 'unknown';
export type UsageLevel = 'low' | 'medium' | 'high';
export type HealthStatusType = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface PerformanceProfile {
  readonly fps: number;
  readonly latency: string;
  readonly modelSize: ModelSize;
  readonly cpuUsage: UsageLevel;
  readonly memoryUsage: UsageLevel;
  readonly batteryImpact: UsageLevel;
}

export interface HealthStatus {
  readonly status: HealthStatusType;
  readonly lastCheck: number;
  readonly errorCount: number;
  readonly successRate: number;
  readonly averageLatency: number;
  readonly isCircuitOpen: boolean;
}

export interface PerformanceMetrics {
  readonly processedFrames: number;
  readonly averageProcessingTime: number;
  readonly currentFPS: number;
  readonly peakMemoryUsage: number;
  readonly gcPressure: number;
  readonly droppedFrames: number;
  readonly qualityScore: number;
  readonly timestamp: number;
}