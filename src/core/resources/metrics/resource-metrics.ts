/**
 * Resource Metrics
 * Comprehensive metrics collection and analysis for resource management
 */

import type { ResourcePool } from '../../performance/resource-pool.js'
import type { createMemoryManager } from '../managers/memory-manager.js';
import type { createCacheManager } from '../managers/cache-manager.js';
import type { createLifecycleManager } from '../managers/lifecycle-manager.js';
import type { createResourceRegistry } from '../registry/resource-registry.js';

export interface ResourceMetricsConfig {
  enableMetrics: boolean;
  metricsInterval: number;
  enablePerformanceTracking: boolean;
  enableResourceProfiling: boolean;
}

export interface MetricsSnapshot {
  timestamp: number;
  memory: {
    used: number;
    pressure: number;
    allocations: number;
    deallocations: number;
    gcEvents: number;
  };
  cache: {
    entries: number;
    hitRate: number;
    memoryUsage: number;
    compressionRatio: number;
  };
  resourcePool: {
    canvasActive: number;
    webglActive: number;
    buffersActive: number;
    totalBufferSize: number;
  };
  lifecycle: {
    trackedResources: number;
    cleanupsPending: number;
    totalCleanups: number;
  };
  registry: {
    registeredTypes: number;
    sharedResources: number;
    sharingRatio: number;
  };
  performance: {
    allocationLatency: number;
    deallocationLatency: number;
    cleanupLatency: number;
    optimizationLatency: number;
  };
}

export interface PerformanceProfile {
  resourceType: string;
  operation: string;
  samples: number[];
  average: number;
  median: number;
  p95: number;
  p99: number;
}

export interface ResourceAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  message: string;
  timestamp: number;
  metadata: Record<string, any>;
}

/**
 * Creates resource metrics collector
 */
export const createResourceMetrics = (
  config: ResourceMetricsConfig,
  managers: {
    resourcePool: ResourcePool;
    memory: ReturnType<typeof createMemoryManager>;
    cache: ReturnType<typeof createCacheManager>;
    lifecycle: ReturnType<typeof createLifecycleManager>;
    registry: ReturnType<typeof createResourceRegistry>;
  }
) => {
  const state = {
    snapshots: [] as MetricsSnapshot[],
    performanceProfiles: new Map<string, PerformanceProfile>(),
    alerts: [] as ResourceAlert[],
    metricsTimer: null as NodeJS.Timeout | null,
    alertCounter: 0,
    
    thresholds: {
      memoryPressure: 0.8,
      cacheHitRate: 0.5,
      cleanupsPending: 50,
      allocationLatency: 100, // ms
      resourceAge: 600000 // 10 minutes
    },
    
    aggregations: {
      hourly: [] as MetricsSnapshot[],
      daily: [] as MetricsSnapshot[],
      lastHourlyAggregation: 0,
      lastDailyAggregation: 0
    }
  };

  // Take a metrics snapshot
  const takeSnapshot = (): MetricsSnapshot => {
    const memoryStats = managers.memory.getStats();
    const cacheStats = managers.cache.getStats();
    const poolMetrics = managers.resourcePool.getMetrics();
    const lifecycleStats = managers.lifecycle.getStats();
    const registryStats = managers.registry.getStats();

    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      memory: {
        used: memoryStats.used,
        pressure: memoryStats.pressure,
        allocations: memoryStats.allocations,
        deallocations: memoryStats.deallocations,
        gcEvents: memoryStats.gcPressure
      },
      cache: {
        entries: cacheStats.entries,
        hitRate: cacheStats.hitRate,
        memoryUsage: cacheStats.memoryUsage,
        compressionRatio: cacheStats.compressionRatio
      },
      resourcePool: {
        canvasActive: poolMetrics.canvas?.active || 0,
        webglActive: poolMetrics.webgl?.active || 0,
        buffersActive: poolMetrics.buffers?.active || 0,
        totalBufferSize: poolMetrics.buffers?.totalSize || 0
      },
      lifecycle: {
        trackedResources: lifecycleStats.trackedResources,
        cleanupsPending: lifecycleStats.cleanupsPending,
        totalCleanups: lifecycleStats.totalCleanups
      },
      registry: {
        registeredTypes: registryStats.registeredTypes,
        sharedResources: registryStats.sharedResources,
        sharingRatio: registryStats.sharingRatio
      },
      performance: {
        allocationLatency: getAverageLatency('allocation'),
        deallocationLatency: getAverageLatency('deallocation'),
        cleanupLatency: getAverageLatency('cleanup'),
        optimizationLatency: getAverageLatency('optimization')
      }
    };

    return snapshot;
  };

  // Record performance sample
  const recordPerformance = (resourceType: string, operation: string, latency: number): void => {
    if (!config.enablePerformanceTracking) return;

    const key = `${resourceType}:${operation}`;
    let profile = state.performanceProfiles.get(key);

    if (!profile) {
      profile = {
        resourceType,
        operation,
        samples: [],
        average: 0,
        median: 0,
        p95: 0,
        p99: 0
      };
      state.performanceProfiles.set(key, profile);
    }

    // Add sample and limit history
    profile.samples.push(latency);
    if (profile.samples.length > 1000) {
      profile.samples.shift();
    }

    // Recalculate statistics
    const sorted = [...profile.samples].sort((a, b) => a - b);
    profile.average = profile.samples.reduce((sum, val) => sum + val, 0) / profile.samples.length;
    profile.median = sorted[Math.floor(sorted.length / 2)];
    profile.p95 = sorted[Math.floor(sorted.length * 0.95)];
    profile.p99 = sorted[Math.floor(sorted.length * 0.99)];
  };

  // Get average latency for operation type
  const getAverageLatency = (operation: string): number => {
    let total = 0;
    let count = 0;

    for (const [key, profile] of state.performanceProfiles) {
      if (profile.operation === operation) {
        total += profile.average;
        count++;
      }
    }

    return count > 0 ? total / count : 0;
  };

  // Generate alert
  const generateAlert = (
    level: ResourceAlert['level'],
    type: string,
    message: string,
    metadata: Record<string, any> = {}
  ): void => {
    const alert: ResourceAlert = {
      id: `alert_${++state.alertCounter}_${Date.now()}`,
      level,
      type,
      message,
      timestamp: Date.now(),
      metadata
    };

    state.alerts.push(alert);

    // Limit alert history
    if (state.alerts.length > 1000) {
      state.alerts.shift();
    }

    // Log critical alerts
    if (level === 'critical' || level === 'error') {
      console.error(`Resource Alert [${level.toUpperCase()}]:`, message, metadata);
    } else if (level === 'warning') {
      console.warn(`Resource Alert [${level.toUpperCase()}]:`, message, metadata);
    }
  };

  // Analyze snapshot for alerts
  const analyzeSnapshot = (snapshot: MetricsSnapshot): void => {
    // Memory pressure alerts
    if (snapshot.memory.pressure > state.thresholds.memoryPressure) {
      const level = snapshot.memory.pressure > 0.95 ? 'critical' : 'warning';
      generateAlert(level, 'memory_pressure', 
        `High memory pressure: ${(snapshot.memory.pressure * 100).toFixed(1)}%`, {
          pressure: snapshot.memory.pressure,
          used: snapshot.memory.used
        });
    }

    // Cache performance alerts
    if (snapshot.cache.hitRate < state.thresholds.cacheHitRate) {
      generateAlert('warning', 'cache_performance',
        `Low cache hit rate: ${(snapshot.cache.hitRate * 100).toFixed(1)}%`, {
          hitRate: snapshot.cache.hitRate,
          entries: snapshot.cache.entries
        });
    }

    // Cleanup backlog alerts
    if (snapshot.lifecycle.cleanupsPending > state.thresholds.cleanupsPending) {
      const level = snapshot.lifecycle.cleanupsPending > 100 ? 'error' : 'warning';
      generateAlert(level, 'cleanup_backlog',
        `High cleanup backlog: ${snapshot.lifecycle.cleanupsPending} pending`, {
          pending: snapshot.lifecycle.cleanupsPending,
          tracked: snapshot.lifecycle.trackedResources
        });
    }

    // Performance alerts
    if (snapshot.performance.allocationLatency > state.thresholds.allocationLatency) {
      generateAlert('warning', 'allocation_performance',
        `Slow resource allocation: ${snapshot.performance.allocationLatency.toFixed(2)}ms average`, {
          latency: snapshot.performance.allocationLatency
        });
    }
  };

  // Aggregate metrics for different time periods
  const aggregateMetrics = (): void => {
    const now = Date.now();
    const hourMs = 3600000; // 1 hour
    const dayMs = 86400000; // 1 day

    // Hourly aggregation
    if (now - state.aggregations.lastHourlyAggregation > hourMs) {
      const hourlySnapshots = state.snapshots.filter(s => 
        s.timestamp > now - hourMs
      );

      if (hourlySnapshots.length > 0) {
        const aggregated = aggregateSnapshots(hourlySnapshots);
        state.aggregations.hourly.push(aggregated);
        
        // Keep last 24 hours
        if (state.aggregations.hourly.length > 24) {
          state.aggregations.hourly.shift();
        }
      }

      state.aggregations.lastHourlyAggregation = now;
    }

    // Daily aggregation
    if (now - state.aggregations.lastDailyAggregation > dayMs) {
      const dailySnapshots = state.snapshots.filter(s => 
        s.timestamp > now - dayMs
      );

      if (dailySnapshots.length > 0) {
        const aggregated = aggregateSnapshots(dailySnapshots);
        state.aggregations.daily.push(aggregated);
        
        // Keep last 30 days
        if (state.aggregations.daily.length > 30) {
          state.aggregations.daily.shift();
        }
      }

      state.aggregations.lastDailyAggregation = now;
    }
  };

  // Aggregate multiple snapshots
  const aggregateSnapshots = (snapshots: MetricsSnapshot[]): MetricsSnapshot => {
    if (snapshots.length === 0) {
      throw new Error('Cannot aggregate empty snapshots array');
    }

    const aggregate: MetricsSnapshot = {
      timestamp: snapshots[snapshots.length - 1].timestamp,
      memory: {
        used: average(snapshots.map(s => s.memory.used)),
        pressure: average(snapshots.map(s => s.memory.pressure)),
        allocations: sum(snapshots.map(s => s.memory.allocations)),
        deallocations: sum(snapshots.map(s => s.memory.deallocations)),
        gcEvents: sum(snapshots.map(s => s.memory.gcEvents))
      },
      cache: {
        entries: average(snapshots.map(s => s.cache.entries)),
        hitRate: average(snapshots.map(s => s.cache.hitRate)),
        memoryUsage: average(snapshots.map(s => s.cache.memoryUsage)),
        compressionRatio: average(snapshots.map(s => s.cache.compressionRatio))
      },
      resourcePool: {
        canvasActive: average(snapshots.map(s => s.resourcePool.canvasActive)),
        webglActive: average(snapshots.map(s => s.resourcePool.webglActive)),
        buffersActive: average(snapshots.map(s => s.resourcePool.buffersActive)),
        totalBufferSize: average(snapshots.map(s => s.resourcePool.totalBufferSize))
      },
      lifecycle: {
        trackedResources: average(snapshots.map(s => s.lifecycle.trackedResources)),
        cleanupsPending: average(snapshots.map(s => s.lifecycle.cleanupsPending)),
        totalCleanups: sum(snapshots.map(s => s.lifecycle.totalCleanups))
      },
      registry: {
        registeredTypes: average(snapshots.map(s => s.registry.registeredTypes)),
        sharedResources: average(snapshots.map(s => s.registry.sharedResources)),
        sharingRatio: average(snapshots.map(s => s.registry.sharingRatio))
      },
      performance: {
        allocationLatency: average(snapshots.map(s => s.performance.allocationLatency)),
        deallocationLatency: average(snapshots.map(s => s.performance.deallocationLatency)),
        cleanupLatency: average(snapshots.map(s => s.performance.cleanupLatency)),
        optimizationLatency: average(snapshots.map(s => s.performance.optimizationLatency))
      }
    };

    return aggregate;
  };

  // Utility functions
  const average = (values: number[]): number => 
    values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;

  const sum = (values: number[]): number => 
    values.reduce((sum, val) => sum + val, 0);

  // Metrics collection loop
  const collectMetrics = (): void => {
    if (!config.enableMetrics) return;

    try {
      const snapshot = takeSnapshot();
      state.snapshots.push(snapshot);

      // Limit snapshot history (keep last 1 hour at 5s intervals)
      const maxSnapshots = Math.floor(3600 / (config.metricsInterval / 1000));
      if (state.snapshots.length > maxSnapshots) {
        state.snapshots.shift();
      }

      // Analyze for alerts
      analyzeSnapshot(snapshot);

      // Perform aggregation
      aggregateMetrics();

    } catch (error) {
      console.error('Metrics collection error:', error);
    }
  };

  // Start metrics collection
  const startMetricsCollection = (): void => {
    if (!config.enableMetrics || state.metricsTimer) {
      return;
    }

    // Take initial snapshot
    collectMetrics();

    // Start periodic collection
    state.metricsTimer = setInterval(collectMetrics, config.metricsInterval);
  };

  // Stop metrics collection
  const stopMetricsCollection = (): void => {
    if (state.metricsTimer) {
      clearInterval(state.metricsTimer);
      state.metricsTimer = null;
    }
  };

  // Get recent metrics
  const getRecentMetrics = (count: number = 10): MetricsSnapshot[] => {
    return state.snapshots.slice(-count);
  };

  // Get performance profiles
  const getPerformanceProfiles = (): PerformanceProfile[] => {
    return Array.from(state.performanceProfiles.values());
  };

  // Get recent alerts
  const getRecentAlerts = (count: number = 50): ResourceAlert[] => {
    return state.alerts.slice(-count);
  };

  // Get comprehensive metrics
  const getComprehensiveMetrics = () => ({
    current: takeSnapshot(),
    recent: getRecentMetrics(20),
    hourly: state.aggregations.hourly,
    daily: state.aggregations.daily,
    performance: getPerformanceProfiles(),
    alerts: getRecentAlerts()
  });

  // Record specific events
  const recordOptimization = async (): Promise<void> => {
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1)); // Minimal delay
    const latency = Date.now() - startTime;
    recordPerformance('system', 'optimization', latency);
  };

  const recordStateImport = (state: any): void => {
    generateAlert('info', 'state_import', 'Resource state imported', {
      timestamp: state.timestamp,
      hasMetrics: Boolean(state.metrics)
    });
  };

  return {
    takeSnapshot,
    recordPerformance,
    startMetricsCollection,
    stopMetricsCollection,
    getRecentMetrics,
    getPerformanceProfiles,
    getRecentAlerts,
    getComprehensiveMetrics,
    recordOptimization,
    recordStateImport
  };
};
