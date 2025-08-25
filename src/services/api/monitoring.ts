/**
 * Enhanced Monitoring and Observability Module
 * Provides comprehensive system monitoring, metrics, and logging capabilities
 */

// Monitoring Configuration
export interface MonitoringConfig {
  readonly enableMetrics: boolean;
  readonly enableLogging: boolean;
  readonly metricsRetentionDays: number;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly exportInterval: number;
}

// Metrics Types
export interface MetricsSnapshot {
  readonly timestamp: number;
  readonly requests: {
    readonly total: number;
    readonly success: number;
    readonly errors: number;
    readonly avgResponseTime: number;
    readonly requestsPerSecond: number;
  };
  readonly system: {
    readonly memory: {
      readonly used: number;
      readonly total: number;
      readonly percentage: number;
      readonly gc?: {
        readonly collections: number;
        readonly timeSpent: number;
      };
    };
    readonly cpu: {
      readonly usage: number;
    };
    readonly uptime: number;
  };
  readonly distribution: {
    readonly activeStreams: number;
    readonly totalBytesTransferred: number;
    readonly packetsPerSecond: number;
  };
  readonly errors: Array<{
    readonly timestamp: number;
    readonly error: string;
    readonly endpoint: string;
    readonly count: number;
  }>;
}

// Enhanced Monitoring Manager
export const createMonitoringManager = (config: Partial<MonitoringConfig> = {}) => {
  const settings: MonitoringConfig = {
    enableMetrics: true,
    enableLogging: true,
    metricsRetentionDays: 7,
    logLevel: 'info',
    exportInterval: 60000, // 1 minute
    ...config
  };

  // Metrics storage
  const metrics = {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      responseTimes: [] as number[],
      startTime: Date.now()
    },
    system: {
      startTime: Date.now(),
      gcStats: {
        collections: 0,
        timeSpent: 0
      }
    },
    distribution: {
      bytesTransferred: 0,
      packetsTransferred: 0,
      lastPacketTime: Date.now()
    },
    errors: new Map<string, { count: number, lastSeen: number }>(),
    snapshots: [] as MetricsSnapshot[]
  };

  // Logging utilities
  const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLogLevel = logLevels[settings.logLevel];

  const log = (level: keyof typeof logLevels, message: string, metadata?: any) => {
    if (!settings.enableLogging || logLevels[level] < currentLogLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(metadata && { metadata })
    };

    console.log(`[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}`, 
                metadata ? JSON.stringify(metadata, null, 2) : '');
  };

  // Request tracking
  const trackRequest = (method: string, path: string, startTime: number, success: boolean, error?: string) => {
    if (!settings.enableMetrics) return;

    const responseTime = Date.now() - startTime;
    metrics.requests.total++;
    metrics.requests.responseTimes.push(responseTime);

    // Keep only last 1000 response times for memory efficiency
    if (metrics.requests.responseTimes.length > 1000) {
      metrics.requests.responseTimes = metrics.requests.responseTimes.slice(-500);
    }

    if (success) {
      metrics.requests.success++;
      log('debug', `Request completed: ${method} ${path}`, { responseTime, success: true });
    } else {
      metrics.requests.errors++;
      
      if (error) {
        const errorKey = `${path}:${error}`;
        const existing = metrics.errors.get(errorKey);
        if (existing) {
          existing.count++;
          existing.lastSeen = Date.now();
        } else {
          metrics.errors.set(errorKey, { count: 1, lastSeen: Date.now() });
        }
      }
      
      log('warn', `Request failed: ${method} ${path}`, { responseTime, error });
    }
  };

  // System metrics collection
  const collectSystemMetrics = (): MetricsSnapshot => {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const uptime = now - metrics.system.startTime;
    
    // Calculate request rate
    const timeWindow = Math.min(uptime, 60000); // Last minute or since start
    const requestsInWindow = metrics.requests.total;
    const requestsPerSecond = timeWindow > 0 ? (requestsInWindow / timeWindow) * 1000 : 0;
    
    // Calculate average response time
    const avgResponseTime = metrics.requests.responseTimes.length > 0
      ? metrics.requests.responseTimes.reduce((a, b) => a + b, 0) / metrics.requests.responseTimes.length
      : 0;

    // CPU usage (simplified - would need more complex calculation for real CPU usage)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    // Distribution metrics
    const distributionTimeWindow = Math.min(now - metrics.distribution.lastPacketTime, 60000);
    const packetsPerSecond = distributionTimeWindow > 0 
      ? (metrics.distribution.packetsTransferred / distributionTimeWindow) * 1000 
      : 0;

    // Error summary
    const errorSummary = Array.from(metrics.errors.entries())
      .filter(([_, data]) => now - data.lastSeen < 3600000) // Last hour
      .map(([key, data]) => {
        const [endpoint, error] = key.split(':', 2);
        return {
          timestamp: data.lastSeen,
          error,
          endpoint,
          count: data.count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 errors

    return {
      timestamp: now,
      requests: {
        total: metrics.requests.total,
        success: metrics.requests.success,
        errors: metrics.requests.errors,
        avgResponseTime,
        requestsPerSecond
      },
      system: {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
          gc: {
            collections: metrics.system.gcStats.collections,
            timeSpent: metrics.system.gcStats.timeSpent
          }
        },
        cpu: {
          usage: Math.min(cpuPercent, 100) // Cap at 100%
        },
        uptime
      },
      distribution: {
        activeStreams: 0, // Would be updated by distribution system
        totalBytesTransferred: metrics.distribution.bytesTransferred,
        packetsPerSecond
      },
      errors: errorSummary
    };
  };

  // Periodic metrics collection
  let metricsInterval: Timer | null = null;
  
  const startMetricsCollection = () => {
    if (metricsInterval || !settings.enableMetrics) return;
    
    metricsInterval = setInterval(() => {
      try {
        const snapshot = collectSystemMetrics();
        metrics.snapshots.push(snapshot);
        
        // Cleanup old snapshots (retain for configured days)
        const retentionTime = settings.metricsRetentionDays * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - retentionTime;
        metrics.snapshots = metrics.snapshots.filter(s => s.timestamp > cutoff);
        
        log('debug', 'Metrics snapshot collected', {
          requests: snapshot.requests.total,
          memory: `${snapshot.system.memory.percentage}%`,
          errors: snapshot.errors.length
        });
        
      } catch (error) {
        log('error', 'Failed to collect metrics', { error: error instanceof Error ? error.message : String(error) });
      }
    }, settings.exportInterval);
    
    log('info', 'Metrics collection started', {
      interval: settings.exportInterval,
      retention: settings.metricsRetentionDays
    });
  };

  const stopMetricsCollection = () => {
    if (metricsInterval) {
      clearInterval(metricsInterval);
      metricsInterval = null;
      log('info', 'Metrics collection stopped');
    }
  };

  // Health check with detailed system status
  const getDetailedHealth = () => {
    const snapshot = collectSystemMetrics();
    const now = Date.now();
    
    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const issues: string[] = [];
    
    if (snapshot.system.memory.percentage > 90) {
      status = 'critical';
      issues.push('High memory usage');
    } else if (snapshot.system.memory.percentage > 75) {
      status = 'degraded';
      issues.push('Elevated memory usage');
    }
    
    if (snapshot.requests.errors / snapshot.requests.total > 0.1) {
      status = 'degraded';
      issues.push('High error rate');
    }
    
    if (snapshot.requests.avgResponseTime > 5000) {
      status = status === 'critical' ? 'critical' : 'degraded';
      issues.push('Slow response times');
    }
    
    return {
      status,
      timestamp: now,
      issues,
      metrics: snapshot,
      diagnostics: {
        requestRate: snapshot.requests.requestsPerSecond,
        errorRate: snapshot.requests.total > 0 
          ? Math.round((snapshot.requests.errors / snapshot.requests.total) * 100) 
          : 0,
        memoryTrend: 'stable', // Would calculate based on historical data
        uptimeHours: Math.round(snapshot.system.uptime / (1000 * 60 * 60))
      }
    };
  };

  // Prometheus-style metrics export
  const exportPrometheusMetrics = (): string => {
    const snapshot = collectSystemMetrics();
    
    return [
      `# HELP synopticon_requests_total Total number of requests`,
      `# TYPE synopticon_requests_total counter`,
      `synopticon_requests_total ${snapshot.requests.total}`,
      
      `# HELP synopticon_requests_success Total number of successful requests`,
      `# TYPE synopticon_requests_success counter`, 
      `synopticon_requests_success ${snapshot.requests.success}`,
      
      `# HELP synopticon_requests_errors Total number of failed requests`,
      `# TYPE synopticon_requests_errors counter`,
      `synopticon_requests_errors ${snapshot.requests.errors}`,
      
      `# HELP synopticon_response_time_avg Average response time in milliseconds`,
      `# TYPE synopticon_response_time_avg gauge`,
      `synopticon_response_time_avg ${snapshot.requests.avgResponseTime}`,
      
      `# HELP synopticon_memory_used_bytes Memory usage in bytes`,
      `# TYPE synopticon_memory_used_bytes gauge`,
      `synopticon_memory_used_bytes ${snapshot.system.memory.used}`,
      
      `# HELP synopticon_memory_total_bytes Total available memory in bytes`,
      `# TYPE synopticon_memory_total_bytes gauge`, 
      `synopticon_memory_total_bytes ${snapshot.system.memory.total}`,
      
      `# HELP synopticon_uptime_seconds System uptime in seconds`,
      `# TYPE synopticon_uptime_seconds gauge`,
      `synopticon_uptime_seconds ${Math.round(snapshot.system.uptime / 1000)}`,
      
      `# HELP synopticon_distribution_bytes_transferred Total bytes transferred`,
      `# TYPE synopticon_distribution_bytes_transferred counter`,
      `synopticon_distribution_bytes_transferred ${snapshot.distribution.totalBytesTransferred}`
    ].join('\n');
  };

  return {
    // Core functions
    trackRequest,
    collectSystemMetrics,
    getDetailedHealth,
    
    // Logging
    log: {
      debug: (msg: string, meta?: any) => log('debug', msg, meta),
      info: (msg: string, meta?: any) => log('info', msg, meta),
      warn: (msg: string, meta?: any) => log('warn', msg, meta),
      error: (msg: string, meta?: any) => log('error', msg, meta)
    },
    
    // Metrics management
    startMetricsCollection,
    stopMetricsCollection,
    getMetricsHistory: () => [...metrics.snapshots],
    exportPrometheusMetrics,
    
    // System stats
    getStats: () => ({
      requests: { ...metrics.requests },
      errors: Object.fromEntries(metrics.errors),
      uptime: Date.now() - metrics.system.startTime
    }),
    
    // Distribution tracking
    updateDistributionMetrics: (bytesTransferred: number, packetsTransferred: number) => {
      metrics.distribution.bytesTransferred += bytesTransferred;
      metrics.distribution.packetsTransferred += packetsTransferred;
      metrics.distribution.lastPacketTime = Date.now();
    }
  };
};

// Default monitoring instance
export const defaultMonitoring = createMonitoringManager();