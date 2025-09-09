/**
 * @fileoverview Time Series Store Implementation
 * 
 * High-performance time series storage for historical state tracking
 * with efficient querying and memory management capabilities.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type { TimeSeriesStore, TimeSeriesEntry } from './types.js';

/**
 * Create time series store with memory management
 */
export const createTimeSeriesStore = (maxSize = 10000): TimeSeriesStore => {
  const store = new Map<string, TimeSeriesEntry[]>();
  
  const record = (path: string, value: unknown, timestamp = Date.now()): void => {
    if (!store.has(path)) {
      store.set(path, []);
    }
    
    const series = store.get(path)!;
    series.push({ value, timestamp });
    
    // Maintain size limit with efficient removal
    if (series.length > maxSize) {
      // Remove oldest 10% to avoid frequent resizing
      const removeCount = Math.floor(maxSize * 0.1);
      series.splice(0, removeCount);
    }
  };
  
  const query = (path: string, duration: number): TimeSeriesEntry[] => {
    const series = store.get(path) || [];
    const cutoff = Date.now() - duration;
    
    // Use binary search for efficient time-based filtering
    const startIndex = findTimeIndex(series, cutoff);
    return series.slice(startIndex);
  };
  
  const getLatest = (path: string): TimeSeriesEntry | null => {
    const series = store.get(path) || [];
    return series[series.length - 1] || null;
  };
  
  const clear = (path?: string): void => {
    if (path) {
      store.delete(path);
    } else {
      store.clear();
    }
  };
  
  const getAllPaths = (): string[] => {
    return Array.from(store.keys());
  };
  
  return { record, query, getLatest, clear, getAllPaths };
};

/**
 * Binary search to find the first index with timestamp >= target
 */
const findTimeIndex = (series: TimeSeriesEntry[], targetTime: number): number => {
  let left = 0;
  let right = series.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = series[mid].timestamp;
    
    if (midTime < targetTime) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return left;
};

/**
 * Advanced time series operations
 */
export const TimeSeriesOperations = {
  /**
   * Resample time series to different intervals
   */
  resample: (
    series: TimeSeriesEntry<number>[], 
    intervalMs: number,
    aggregation: 'avg' | 'min' | 'max' | 'sum' | 'first' | 'last' = 'avg'
  ): TimeSeriesEntry<number>[] => {
    if (series.length === 0) return [];
    
    const result: TimeSeriesEntry<number>[] = [];
    const startTime = series[0].timestamp;
    const endTime = series[series.length - 1].timestamp;
    
    for (let time = startTime; time <= endTime; time += intervalMs) {
      const windowEnd = time + intervalMs;
      const windowData = series
        .filter(entry => entry.timestamp >= time && entry.timestamp < windowEnd)
        .map(entry => entry.value as number);
      
      if (windowData.length > 0) {
        let value: number;
        
        switch (aggregation) {
          case 'avg':
            value = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
            break;
          case 'min':
            value = Math.min(...windowData);
            break;
          case 'max':
            value = Math.max(...windowData);
            break;
          case 'sum':
            value = windowData.reduce((sum, val) => sum + val, 0);
            break;
          case 'first':
            value = windowData[0];
            break;
          case 'last':
            value = windowData[windowData.length - 1];
            break;
        }
        
        result.push({ value, timestamp: time });
      }
    }
    
    return result;
  },

  /**
   * Calculate moving average
   */
  movingAverage: (
    series: TimeSeriesEntry<number>[], 
    windowSize: number
  ): TimeSeriesEntry<number>[] => {
    if (series.length < windowSize) return [];
    
    const result: TimeSeriesEntry<number>[] = [];
    
    for (let i = windowSize - 1; i < series.length; i++) {
      const window = series.slice(i - windowSize + 1, i + 1);
      const average = window.reduce((sum, entry) => sum + entry.value, 0) / windowSize;
      
      result.push({
        value: average,
        timestamp: series[i].timestamp
      });
    }
    
    return result;
  },

  /**
   * Calculate exponential moving average
   */
  exponentialMovingAverage: (
    series: TimeSeriesEntry<number>[], 
    alpha: number = 0.3
  ): TimeSeriesEntry<number>[] => {
    if (series.length === 0) return [];
    
    const result: TimeSeriesEntry<number>[] = [];
    let ema = series[0].value;
    
    for (const entry of series) {
      ema = alpha * entry.value + (1 - alpha) * ema;
      result.push({
        value: ema,
        timestamp: entry.timestamp
      });
    }
    
    return result;
  },

  /**
   * Detect outliers using statistical methods
   */
  detectOutliers: (
    series: TimeSeriesEntry<number>[],
    method: 'zscore' | 'iqr' | 'modified_zscore' = 'zscore',
    threshold: number = 3
  ): TimeSeriesEntry<number>[] => {
    if (series.length < 3) return [];
    
    const values = series.map(entry => entry.value);
    const outliers: TimeSeriesEntry<number>[] = [];
    
    switch (method) {
      case 'zscore': {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const std = Math.sqrt(
          values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        );
        
        series.forEach(entry => {
          const zscore = Math.abs((entry.value - mean) / std);
          if (zscore > threshold) {
            outliers.push(entry);
          }
        });
        break;
      }
      
      case 'iqr': {
        const sorted = [...values].sort((a, b) => a - b);
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const q1 = sorted[q1Index];
        const q3 = sorted[q3Index];
        const iqr = q3 - q1;
        const lowerBound = q1 - threshold * iqr;
        const upperBound = q3 + threshold * iqr;
        
        series.forEach(entry => {
          if (entry.value < lowerBound || entry.value > upperBound) {
            outliers.push(entry);
          }
        });
        break;
      }
      
      case 'modified_zscore': {
        const median = calculateMedian(values);
        const mad = calculateMAD(values, median);
        
        series.forEach(entry => {
          const modifiedZScore = Math.abs(0.6745 * (entry.value - median) / mad);
          if (modifiedZScore > threshold) {
            outliers.push(entry);
          }
        });
        break;
      }
    }
    
    return outliers;
  },

  /**
   * Fill missing data points using interpolation
   */
  fillMissing: (
    series: TimeSeriesEntry<number>[],
    intervalMs: number,
    method: 'linear' | 'forward' | 'backward' | 'mean' = 'linear'
  ): TimeSeriesEntry<number>[] => {
    if (series.length < 2) return series;
    
    const result: TimeSeriesEntry<number>[] = [];
    const sortedSeries = [...series].sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 0; i < sortedSeries.length - 1; i++) {
      const current = sortedSeries[i];
      const next = sortedSeries[i + 1];
      
      result.push(current);
      
      // Fill gaps larger than interval
      const gap = next.timestamp - current.timestamp;
      if (gap > intervalMs * 1.5) {
        const steps = Math.floor(gap / intervalMs);
        
        for (let step = 1; step < steps; step++) {
          const timestamp = current.timestamp + step * intervalMs;
          let value: number;
          
          switch (method) {
            case 'linear':
              const ratio = step / steps;
              value = current.value + ratio * (next.value - current.value);
              break;
            case 'forward':
              value = current.value;
              break;
            case 'backward':
              value = next.value;
              break;
            case 'mean':
              value = (current.value + next.value) / 2;
              break;
          }
          
          result.push({ value, timestamp });
        }
      }
    }
    
    result.push(sortedSeries[sortedSeries.length - 1]);
    return result;
  }
};

/**
 * Helper function to calculate median
 */
const calculateMedian = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * Helper function to calculate Median Absolute Deviation
 */
const calculateMAD = (values: number[], median: number): number => {
  const deviations = values.map(value => Math.abs(value - median));
  return calculateMedian(deviations);
};