/**
 * Composition Metrics Collection and Analysis
 * Centralized metrics tracking for all composition patterns
 */

export interface CompositionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
  patternUsage: Record<string, number>;
  errorsByPattern: Record<string, number>;
  performanceTrends: Array<{
    timestamp: number;
    pattern: string;
    executionTime: number;
    success: boolean;
  }>;
}

export interface MetricsSummary {
  overall: {
    successRate: number;
    avgExecutionTime: number;
    totalExecutions: number;
    errorRate: number;
  };
  byPattern: Record<string, {
    usage: number;
    successRate: number;
    avgExecutionTime: number;
    errorCount: number;
  }>;
  trends: {
    executionTimeMovingAvg: number[];
    successRateMovingAvg: number[];
    patternPopularity: Array<{ pattern: string; percentage: number; }>;
  };
}

/**
 * Creates composition metrics collector
 */
export const createCompositionMetrics = () => {
  const state = {
    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      patternUsage: {} as Record<string, number>,
      errorsByPattern: {} as Record<string, number>,
      performanceTrends: [] as Array<{
        timestamp: number;
        pattern: string;
        executionTime: number;
        success: boolean;
      }>
    } as CompositionMetrics,
    maxTrendHistory: 1000
  };

  // Record execution metrics
  const recordExecution = (
    pattern: string,
    executionTime: number,
    success: boolean
  ): void => {
    state.metrics.totalExecutions++;
    
    if (success) {
      state.metrics.successfulExecutions++;
    } else {
      state.metrics.failedExecutions++;
      state.metrics.errorsByPattern[pattern] = (state.metrics.errorsByPattern[pattern] || 0) + 1;
    }

    // Update pattern usage
    state.metrics.patternUsage[pattern] = (state.metrics.patternUsage[pattern] || 0) + 1;

    // Update average execution time
    const {totalExecutions} = state.metrics;
    state.metrics.avgExecutionTime = 
      (state.metrics.avgExecutionTime * (totalExecutions - 1) + executionTime) / totalExecutions;

    // Add to performance trends
    state.metrics.performanceTrends.push({
      timestamp: Date.now(),
      pattern,
      executionTime,
      success
    });

    // Trim trends if too large
    if (state.metrics.performanceTrends.length > state.maxTrendHistory) {
      state.metrics.performanceTrends.shift();
    }
  };

  // Calculate moving average
  const calculateMovingAverage = (values: number[], windowSize: number): number[] => {
    const result: number[] = [];
    
    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / windowSize;
      result.push(avg);
    }
    
    return result;
  };

  // Get comprehensive metrics summary
  const getSummary = (): MetricsSummary => {
    const byPattern: Record<string, {
      usage: number;
      successRate: number;
      avgExecutionTime: number;
      errorCount: number;
    }> = {};

    // Calculate per-pattern metrics
    const patternTrends = new Map<string, { total: number; successful: number; totalTime: number; }>();
    
    for (const trend of state.metrics.performanceTrends) {
      let patternData = patternTrends.get(trend.pattern);
      if (!patternData) {
        patternData = { total: 0, successful: 0, totalTime: 0 };
        patternTrends.set(trend.pattern, patternData);
      }
      
      patternData.total++;
      if (trend.success) {
        patternData.successful++;
      }
      patternData.totalTime += trend.executionTime;
    }

    for (const [pattern, data] of patternTrends) {
      byPattern[pattern] = {
        usage: state.metrics.patternUsage[pattern] || 0,
        successRate: data.successful / data.total,
        avgExecutionTime: data.totalTime / data.total,
        errorCount: state.metrics.errorsByPattern[pattern] || 0
      };
    }

    // Calculate trends
    const recentTrends = state.metrics.performanceTrends.slice(-100); // Last 100 executions
    const executionTimes = recentTrends.map(t => t.executionTime);
    const successRates = recentTrends.map(t => t.success ? 1 : 0);

    const executionTimeMovingAvg = calculateMovingAverage(executionTimes, Math.min(10, executionTimes.length));
    const successRateMovingAvg = calculateMovingAverage(successRates, Math.min(10, successRates.length));

    // Pattern popularity
    const totalUsage = Object.values(state.metrics.patternUsage).reduce((sum, count) => sum + count, 0);
    const patternPopularity = Object.entries(state.metrics.patternUsage)
      .map(([pattern, usage]) => ({
        pattern,
        percentage: totalUsage > 0 ? (usage / totalUsage) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return {
      overall: {
        successRate: state.metrics.totalExecutions > 0
          ? state.metrics.successfulExecutions / state.metrics.totalExecutions
          : 0,
        avgExecutionTime: state.metrics.avgExecutionTime,
        totalExecutions: state.metrics.totalExecutions,
        errorRate: state.metrics.totalExecutions > 0
          ? state.metrics.failedExecutions / state.metrics.totalExecutions
          : 0
      },
      byPattern,
      trends: {
        executionTimeMovingAvg,
        successRateMovingAvg,
        patternPopularity
      }
    };
  };

  // Get raw metrics
  const getMetrics = (): CompositionMetrics => ({ ...state.metrics });

  // Get overall metrics for external reporting
  const getOverallMetrics = () => ({
    totalExecutions: state.metrics.totalExecutions,
    successRate: state.metrics.totalExecutions > 0
      ? state.metrics.successfulExecutions / state.metrics.totalExecutions
      : 0,
    avgExecutionTime: state.metrics.avgExecutionTime,
    patternCount: Object.keys(state.metrics.patternUsage).length,
    trendDataPoints: state.metrics.performanceTrends.length
  });

  // Reset all metrics
  const reset = (): void => {
    state.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      patternUsage: {},
      errorsByPattern: {},
      performanceTrends: []
    };
  };

  // Export metrics data
  const exportData = () => ({
    timestamp: Date.now(),
    metrics: getMetrics(),
    summary: getSummary()
  });

  // Cleanup resources
  const cleanup = async (): Promise<void> => {
    reset();
  };

  return {
    recordExecution,
    getMetrics,
    getSummary,
    getOverallMetrics,
    exportData,
    reset,
    cleanup
  };
};
