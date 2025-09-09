/**
 * @fileoverview Cognitive State Manager Engine
 * 
 * Main coordination engine for cognitive state management with
 * comprehensive state tracking, pattern detection, and event management.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../shared/utils/logger.js';
import { createTimeSeriesStore } from './time-series-store.js';
import { createPatternDetector, PatternUtils } from './pattern-detector.js';
import { createStateValidator } from './state-validator.js';
import type {
  CognitiveStateManager,
  StateManagerConfig,
  CognitiveSystemState,
  StateChangeEvent,
  StateManagerEvents,
  StateQueryOptions,
  TimeSeriesEntry,
  Pattern,
  TrendAnalysis,
  AnomalyResult,
  CorrelationResult,
  ValidationResult,
  StateManagerMetrics
} from './types.js';

const logger = createLogger({ level: 2 });

/**
 * Create cognitive state manager with comprehensive functionality
 */
export const createCognitiveStateManager = (config: StateManagerConfig = {}): CognitiveStateManager => {
  const {
    maxHistorySize = 10000,
    patternDetectionEnabled = true,
    anomalyThreshold = 2.5,
    correlationThreshold = 0.5,
    validationEnabled = true,
    autoSave = false,
    saveInterval = 60000,
    enablePrediction = false
  } = config;

  // Internal state
  const currentState: Partial<CognitiveSystemState> = initializeDefaultState();
  const eventEmitter = new EventEmitter();
  
  // Core components
  const timeSeriesStore = createTimeSeriesStore(maxHistorySize);
  const patternDetector = createPatternDetector();
  const validator = createStateValidator();
  
  // Metrics tracking
  const metrics: StateManagerMetrics = {
    totalUpdates: 0,
    patternsDetected: 0,
    anomaliesFound: 0,
    validationErrors: 0,
    averageUpdateTime: 0,
    memoryUsage: 0,
    historicalDataPoints: 0
  };

  // Auto-save timer
  let autoSaveTimer: NodeJS.Timeout | null = null;

  /**
   * Get current state or specific path
   */
  const getState = (path?: string): unknown => {
    if (!path) return currentState;
    return getNestedValue(currentState, path);
  };

  /**
   * Set state value at specific path
   */
  const setState = (path: string, value: unknown, source = 'unknown'): void => {
    const startTime = Date.now();
    
    try {
      const oldValue = getNestedValue(currentState, path);
      setNestedValue(currentState, path, value);
      
      // Record in time series
      timeSeriesStore.record(path, value);
      
      // Validation if enabled
      if (validationEnabled) {
        const validationResult = validator.validateState(currentState);
        if (!validationResult.valid) {
          metrics.validationErrors++;
          eventEmitter.emit('validationError', {
            errors: validationResult.errors,
            path,
            timestamp: Date.now()
          });
          logger.warn(`State validation failed for ${path}:`, validationResult.errors);
        }
      }
      
      // Pattern detection if enabled
      if (patternDetectionEnabled) {
        performPatternAnalysis(path, value);
      }
      
      // Emit state change event
      const changeEvent: StateChangeEvent = {
        path,
        oldValue,
        newValue: value,
        timestamp: Date.now(),
        source
      };
      
      eventEmitter.emit('stateChanged', changeEvent);
      
      // Update metrics
      metrics.totalUpdates++;
      const updateTime = Date.now() - startTime;
      metrics.averageUpdateTime = (metrics.averageUpdateTime * (metrics.totalUpdates - 1) + updateTime) / metrics.totalUpdates;
      
    } catch (error) {
      logger.error(`Error setting state at ${path}:`, error as Error);
      throw error;
    }
  };

  /**
   * Update multiple state values
   */
  const updateState = (updates: Partial<CognitiveSystemState>, source = 'batch-update'): void => {
    const flatUpdates = flattenObject(updates);
    
    Object.entries(flatUpdates).forEach(([path, value]) => {
      setState(path, value, source);
    });
  };

  /**
   * Get historical data for a path
   */
  const getHistory = (
    path: string, 
    duration: number, 
    options: StateQueryOptions = {}
  ): TimeSeriesEntry[] => {
    let history = timeSeriesStore.query(path, duration);
    
    // Apply time range filter
    if (options.timeRange) {
      history = history.filter(entry => 
        entry.timestamp >= options.timeRange!.start && 
        entry.timestamp <= options.timeRange!.end
      );
    }
    
    // Apply result limit
    if (options.maxResults && history.length > options.maxResults) {
      history = history.slice(-options.maxResults);
    }
    
    // Apply aggregation
    if (options.aggregation && options.aggregation !== 'none') {
      history = applyAggregation(history, options.aggregation);
    }
    
    return history;
  };

  /**
   * Get state snapshot at specific timestamp
   */
  const getStateSnapshot = (timestamp: number): CognitiveSystemState | null => {
    // This is a simplified implementation - in practice, you'd need to 
    // reconstruct state from historical data at the given timestamp
    const allPaths = timeSeriesStore.getAllPaths();
    const snapshot: any = {};
    
    for (const path of allPaths) {
      const history = timeSeriesStore.query(path, Number.MAX_SAFE_INTEGER);
      const entry = history.find(h => h.timestamp <= timestamp);
      if (entry) {
        setNestedValue(snapshot, path, entry.value);
      }
    }
    
    return snapshot.human || snapshot.system || snapshot.environment || snapshot.mission 
      ? snapshot as CognitiveSystemState
      : null;
  };

  /**
   * Analyze patterns in historical data
   */
  const analyzePattern = (path: string, duration: number): Pattern[] => {
    const history = getHistory(path, duration).filter(entry => typeof entry.value === 'number') as TimeSeriesEntry<number>[];
    
    if (history.length < 10) return [];
    
    return PatternUtils.detectAllPatterns(history);
  };

  /**
   * Detect trends in data
   */
  const detectTrends = (path: string, duration: number): TrendAnalysis => {
    const history = getHistory(path, duration).filter(entry => typeof entry.value === 'number') as TimeSeriesEntry<number>[];
    return patternDetector.detectTrend(history);
  };

  /**
   * Find anomalies in data
   */
  const findAnomalies = (path: string, duration: number): AnomalyResult[] => {
    const history = getHistory(path, duration).filter(entry => typeof entry.value === 'number') as TimeSeriesEntry<number>[];
    const anomalies: AnomalyResult[] = [];
    
    // Check recent windows for anomalies
    const windowSize = Math.min(20, Math.floor(history.length / 5));
    
    for (let i = windowSize; i < history.length; i++) {
      const window = history.slice(i - windowSize, i);
      const anomaly = patternDetector.detectAnomaly(window, anomalyThreshold);
      
      if (anomaly.isAnomaly) {
        anomalies.push(anomaly);
      }
    }
    
    return anomalies;
  };

  /**
   * Calculate correlation between two data paths
   */
  const calculateCorrelation = (path1: string, path2: string, duration: number): CorrelationResult => {
    const history1 = getHistory(path1, duration).filter(entry => typeof entry.value === 'number').map(entry => entry.value as number);
    const history2 = getHistory(path2, duration).filter(entry => typeof entry.value === 'number').map(entry => entry.value as number);
    
    const minLength = Math.min(history1.length, history2.length);
    const series1 = history1.slice(-minLength);
    const series2 = history2.slice(-minLength);
    
    return patternDetector.calculateCorrelation(series1, series2);
  };

  /**
   * Validate current state
   */
  const validateState = (state: Partial<CognitiveSystemState>): ValidationResult => {
    return validator.validateState(state);
  };

  /**
   * Reset state manager
   */
  const reset = (preserveHistory = false): void => {
    Object.keys(currentState).forEach(key => {
      delete (currentState as any)[key];
    });
    
    Object.assign(currentState, initializeDefaultState());
    
    if (!preserveHistory) {
      timeSeriesStore.clear();
    }
    
    // Reset metrics
    Object.keys(metrics).forEach(key => {
      (metrics as any)[key] = 0;
    });
    
    logger.info('State manager reset', { preserveHistory });
  };

  /**
   * Export state data
   */
  const exportData = (): string => {
    const exportData = {
      currentState,
      history: timeSeriesStore.getAllPaths().reduce((acc, path) => {
        acc[path] = timeSeriesStore.query(path, Number.MAX_SAFE_INTEGER);
        return acc;
      }, {} as Record<string, TimeSeriesEntry[]>),
      metrics,
      timestamp: Date.now()
    };
    
    return JSON.stringify(exportData, null, 2);
  };

  /**
   * Import state data
   */
  const importData = (data: string): boolean => {
    try {
      const imported = JSON.parse(data);
      
      // Restore current state
      Object.assign(currentState, imported.currentState);
      
      // Restore history
      if (imported.history) {
        timeSeriesStore.clear();
        Object.entries(imported.history).forEach(([path, history]) => {
          (history as TimeSeriesEntry[]).forEach(entry => {
            timeSeriesStore.record(path, entry.value, entry.timestamp);
          });
        });
      }
      
      // Restore metrics
      if (imported.metrics) {
        Object.assign(metrics, imported.metrics);
      }
      
      logger.info('State data imported successfully');
      return true;
      
    } catch (error) {
      logger.error('Failed to import state data:', error as Error);
      return false;
    }
  };

  /**
   * Get current metrics
   */
  const getMetrics = (): StateManagerMetrics => {
    return {
      ...metrics,
      memoryUsage: process.memoryUsage().heapUsed,
      historicalDataPoints: timeSeriesStore.getAllPaths().reduce((total, path) => {
        return total + timeSeriesStore.query(path, Number.MAX_SAFE_INTEGER).length;
      }, 0)
    };
  };

  /**
   * Event handling
   */
  const on = <K extends keyof StateManagerEvents>(event: K, listener: (data: StateManagerEvents[K]) => void) => {
    eventEmitter.on(event, listener);
  };

  const off = <K extends keyof StateManagerEvents>(event: K, listener: (data: StateManagerEvents[K]) => void) => {
    eventEmitter.off(event, listener);
  };

  const emit = <K extends keyof StateManagerEvents>(event: K, data: StateManagerEvents[K]) => {
    eventEmitter.emit(event, data);
  };

  // Initialize auto-save if enabled
  if (autoSave && saveInterval > 0) {
    autoSaveTimer = setInterval(() => {
      try {
        const data = exportData();
        // In a real implementation, you'd save to persistent storage
        logger.debug('Auto-save completed', { size: data.length });
      } catch (error) {
        logger.error('Auto-save failed:', error as Error);
      }
    }, saveInterval);
  }

  // Cleanup on process exit
  process.on('exit', () => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
    }
  });

  return {
    getState,
    setState,
    updateState,
    getHistory,
    getStateSnapshot,
    analyzePattern,
    detectTrends,
    findAnomalies,
    calculateCorrelation,
    validateState,
    reset,
    export: exportData,
    import: importData,
    getMetrics,
    on,
    off,
    emit
  };
};

/**
 * Initialize default state structure
 */
const initializeDefaultState = (): Partial<CognitiveSystemState> => ({
  human: {
    cognitive: {
      workload: 0.5,
      fatigue: 0,
      stress: 0,
      attention: 1.0,
      performance: 1.0
    },
    emotional: {
      valence: 0,
      arousal: 0,
      emotions: {
        happy: 0,
        sad: 0,
        angry: 0,
        fearful: 0,
        surprised: 0,
        disgusted: 0,
        neutral: 1.0
      }
    },
    physiological: {
      heartRate: 70,
      bloodPressure: {
        systolic: 120,
        diastolic: 80
      },
      breathing: {
        rate: 16,
        depth: 0.5
      },
      skinConductance: 10,
      eyeTracking: {
        pupilDiameter: 4,
        blinkRate: 15,
        gazeStability: 0.8
      }
    }
  },
  system: {
    performance: {
      cpu: 0.3,
      memory: 0.4,
      network: 0.1,
      storage: 0.2
    },
    health: {
      overall: 0.9,
      components: {}
    },
    automation: {
      level: 0.5,
      mode: 'semi-auto',
      reliability: 0.95
    },
    alerts: {
      active: 0,
      severity: 'low',
      unacknowledged: 0
    }
  },
  environment: {
    risk: {
      weather: 0.1,
      traffic: 0.2,
      infrastructure: 0.05,
      total: 0.35
    },
    conditions: {
      visibility: 0.9,
      lighting: 0.8,
      noise: 0.3,
      temperature: 22
    },
    context: {
      timeOfDay: 'afternoon',
      workday: true,
      season: 'spring',
      location: 'operational-zone-1'
    }
  },
  mission: {
    phase: 'execution',
    progress: 0.3,
    objectives: {
      primary: ['complete-task-1', 'monitor-systems'],
      secondary: ['optimize-performance'],
      completed: []
    },
    timeline: {
      start: Date.now() - 3600000, // 1 hour ago
      estimated: Date.now() + 7200000 // 2 hours from now
    },
    complexity: 0.6
  },
  metadata: {
    timestamp: Date.now(),
    version: '1.0.0',
    confidence: 0.8,
    source: 'state-manager-init'
  }
});

/**
 * Perform pattern analysis on new data
 */
const performPatternAnalysis = (path: string, value: unknown): void => {
  if (typeof value !== 'number') return;
  
  const history = timeSeriesStore.query(path, 300000) as TimeSeriesEntry<number>[]; // 5 minutes
  
  if (history.length < 10) return;
  
  // Detect anomalies
  const anomaly = patternDetector.detectAnomaly(history);
  if (anomaly.isAnomaly) {
    const stateManager = arguments[2] as any; // Access to parent context
    if (stateManager) {
      stateManager.metrics.anomaliesFound++;
      stateManager.eventEmitter.emit('anomalyDetected', {
        anomaly,
        path,
        timestamp: Date.now()
      });
    }
  }
  
  // Detect patterns every 50 data points
  if (history.length % 50 === 0) {
    const patterns = PatternUtils.detectAllPatterns(history);
    if (patterns.length > 0) {
      const stateManager = arguments[2] as any;
      if (stateManager) {
        stateManager.metrics.patternsDetected += patterns.length;
        patterns.forEach(pattern => {
          stateManager.eventEmitter.emit('patternDetected', {
            pattern,
            path,
            timestamp: Date.now()
          });
        });
      }
    }
  }
};

/**
 * Utility functions for nested object operations
 */
const getNestedValue = (obj: any, path: string): unknown => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

const setNestedValue = (obj: any, path: string, value: unknown): void => {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);
  
  target[lastKey] = value;
};

const flattenObject = (obj: any, prefix = ''): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  
  Object.entries(obj).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  });
  
  return result;
};

const applyAggregation = (
  history: TimeSeriesEntry[], 
  aggregation: 'avg' | 'min' | 'max' | 'sum'
): TimeSeriesEntry[] => {
  if (history.length === 0) return history;
  
  const numericValues = history
    .map(entry => entry.value)
    .filter((value): value is number => typeof value === 'number');
  
  if (numericValues.length === 0) return history;
  
  let aggregatedValue: number;
  
  switch (aggregation) {
    case 'avg':
      aggregatedValue = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
      break;
    case 'min':
      aggregatedValue = Math.min(...numericValues);
      break;
    case 'max':
      aggregatedValue = Math.max(...numericValues);
      break;
    case 'sum':
      aggregatedValue = numericValues.reduce((sum, val) => sum + val, 0);
      break;
    default:
      return history;
  }
  
  return [{
    value: aggregatedValue,
    timestamp: history[history.length - 1].timestamp
  }];
};