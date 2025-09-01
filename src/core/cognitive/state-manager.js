/**
 * Cognitive State Manager
 * Central state management for the Cognitive Advisory System
 * Maintains coherent world model across all components
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Time-series storage for historical state tracking
 */
const createTimeSeriesStore = (maxSize = 10000) => {
  const store = new Map();
  
  const record = (path, value, timestamp = Date.now()) => {
    if (!store.has(path)) {
      store.set(path, []);
    }
    
    const series = store.get(path);
    series.push({ value, timestamp });
    
    // Maintain size limit
    if (series.length > maxSize) {
      series.shift();
    }
  };
  
  const query = (path, duration) => {
    const series = store.get(path) || [];
    const cutoff = Date.now() - duration;
    return series.filter(entry => entry.timestamp >= cutoff);
  };
  
  const getLatest = (path) => {
    const series = store.get(path) || [];
    return series[series.length - 1] || null;
  };
  
  return { record, query, getLatest };
};

/**
 * Pattern detection for temporal analysis
 */
const createPatternDetector = () => {
  const detectTrend = (series) => {
    if (series.length < 3) return 'stable';
    
    const values = series.map(s => s.value);
    const diffs = [];
    
    for (let i = 1; i < values.length; i++) {
      diffs.push(values[i] - values[i - 1]);
    }
    
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    
    if (Math.abs(avgDiff) < 0.01) return 'stable';
    if (avgDiff > 0) return 'increasing';
    return 'decreasing';
  };
  
  const detectAnomaly = (series, threshold = 2) => {
    if (series.length < 10) return false;
    
    const values = series.map(s => s.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const latest = values[values.length - 1];
    return Math.abs(latest - mean) > threshold * stdDev;
  };
  
  const findPattern = (series, windowSize = 10) => {
    if (series.length < windowSize * 2) return null;
    
    const patterns = [];
    const values = series.map(s => s.value);
    
    // Simple pattern matching - look for repeating sequences
    for (let i = 0; i <= values.length - windowSize * 2; i++) {
      const window1 = values.slice(i, i + windowSize);
      const window2 = values.slice(i + windowSize, i + windowSize * 2);
      
      const correlation = calculateCorrelation(window1, window2);
      if (correlation > 0.8) {
        patterns.push({
          start: i,
          length: windowSize,
          correlation,
          period: windowSize
        });
      }
    }
    
    return patterns.length > 0 ? patterns[0] : null;
  };
  
  const calculateCorrelation = (arr1, arr2) => {
    const mean1 = arr1.reduce((a, b) => a + b, 0) / arr1.length;
    const mean2 = arr2.reduce((a, b) => a + b, 0) / arr2.length;
    
    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;
    
    for (let i = 0; i < arr1.length; i++) {
      const diff1 = arr1[i] - mean1;
      const diff2 = arr2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }
    
    if (denom1 === 0 || denom2 === 0) return 0;
    return numerator / Math.sqrt(denom1 * denom2);
  };
  
  return { detectTrend, detectAnomaly, findPattern };
};

/**
 * Main Cognitive State Manager
 */
export const createCognitiveStateManager = (config = {}) => {
  const state = {
    // Human state tracking
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
      physical: {
        heartRate: 70,
        heartRateVariability: 50,
        eyeStrain: 0,
        posture: 'upright',
        alertness: 1.0
      },
      performance: {
        accuracy: 1.0,
        reactionTime: 200,
        errorRate: 0,
        taskCompletion: 1.0,
        learningRate: 0.5
      }
    },
    
    // System state tracking
    system: {
      vehicle: {
        position: { lat: 0, lon: 0, alt: 0 },
        dynamics: {
          speed: 0,
          heading: 0,
          verticalSpeed: 0,
          acceleration: { x: 0, y: 0, z: 0 },
          rotation: { pitch: 0, roll: 0, yaw: 0 }
        },
        systems: {
          engines: 'normal',
          hydraulics: 'normal',
          electrical: 'normal',
          fuel: 1.0,
          autopilot: false
        }
      },
      mission: {
        phase: 'planning',
        objectives: [],
        constraints: [],
        progress: 0,
        timeRemaining: null,
        status: 'nominal'
      },
      automation: {
        level: 0, // 0-5 scale
        active: [],
        available: [],
        mode: 'manual',
        confidence: 1.0
      }
    },
    
    // Environmental state
    environment: {
      weather: {
        visibility: 10000,
        windSpeed: 0,
        windDirection: 0,
        temperature: 15,
        pressure: 1013.25,
        precipitation: 'none',
        cloudCover: 0
      },
      traffic: {
        nearby: [],
        conflicts: [],
        complexity: 0,
        density: 0,
        separation: Infinity
      },
      terrain: {
        elevation: 0,
        obstacles: [],
        features: [],
        safeAreas: [],
        hazards: []
      },
      time: {
        local: new Date(),
        zulu: new Date(),
        daylight: true,
        timeOfDay: 'day'
      }
    },
    
    // Interaction state
    interaction: {
      dialogue: {
        context: [],
        currentIntent: null,
        sentiment: 'neutral',
        turn: 0,
        lastUserInput: null,
        lastSystemOutput: null
      },
      commands: {
        queue: [],
        history: [],
        executing: null,
        feedback: [],
        successRate: 1.0
      },
      alerts: {
        active: [],
        acknowledged: [],
        suppressed: [],
        priority: null,
        escalation: 0
      }
    }
  };
  
  // Event emitter for state changes
  const emitter = new EventEmitter();
  
  // Time series storage
  const history = createTimeSeriesStore(config.historySize || 10000);
  
  // Pattern detector
  const patternDetector = createPatternDetector();
  
  // Subscribers for specific paths
  const subscribers = new Map();
  
  /**
   * Get state value at path
   */
  const getState = (path) => {
    const parts = path.split('.');
    let current = state;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  };
  
  /**
   * Set state value at path
   */
  const setState = (path, value) => {
    const parts = path.split('.');
    const last = parts.pop();
    let current = state;
    
    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[last] = value;
  };
  
  /**
   * Update state with history tracking and notifications
   */
  const updateState = (path, value, metadata = {}) => {
    const oldValue = getState(path);
    
    // Skip if no change
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
      return;
    }
    
    // Update state
    setState(path, value);
    
    // Record in history
    history.record(path, value);
    
    // Emit change event
    emitter.emit('stateChange', {
      path,
      oldValue,
      newValue: value,
      timestamp: Date.now(),
      metadata
    });
    
    // Notify path-specific subscribers
    const pathSubscribers = subscribers.get(path) || [];
    pathSubscribers.forEach(callback => {
      try {
        callback(value, oldValue, path);
      } catch (error) {
        logger.error(`Subscriber error for path ${path}:`, error);
      }
    });
    
    // Calculate derived states
    calculateDerivedStates(path, value);
  };
  
  /**
   * Subscribe to state changes
   */
  const subscribe = (path, callback) => {
    if (!subscribers.has(path)) {
      subscribers.set(path, []);
    }
    subscribers.get(path).push(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = subscribers.get(path) || [];
      const index = subs.indexOf(callback);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  };
  
  /**
   * Calculate derived states based on changes
   */
  const calculateDerivedStates = (path, value) => {
    // Human performance composite score
    if (path.startsWith('human.cognitive') || path.startsWith('human.emotional')) {
      const cognitive = getState('human.cognitive');
      const emotional = getState('human.emotional');
      
      const performanceScore = (
        cognitive.attention * 0.3 +
        (1 - cognitive.fatigue) * 0.3 +
        (1 - cognitive.stress) * 0.2 +
        (emotional.valence + 1) / 2 * 0.2
      );
      
      setState('human.performance.composite', performanceScore);
    }
    
    // System health score
    if (path.startsWith('system.vehicle.systems')) {
      const systems = getState('system.vehicle.systems');
      const healthScore = Object.values(systems)
        .filter(v => typeof v === 'number')
        .reduce((sum, val) => sum + val, 0) / 
        Object.values(systems).filter(v => typeof v === 'number').length;
      
      setState('system.health', healthScore);
    }
    
    // Environmental risk assessment
    if (path.startsWith('environment')) {
      const weather = getState('environment.weather');
      const traffic = getState('environment.traffic');
      
      const riskScore = (
        (10000 - weather.visibility) / 10000 * 0.3 +
        Math.min(weather.windSpeed / 50, 1) * 0.2 +
        traffic.complexity * 0.3 +
        traffic.conflicts.length / 10 * 0.2
      );
      
      setState('environment.risk', riskScore);
    }
  };
  
  /**
   * Get temporal analysis for a state path
   */
  const getTemporalAnalysis = (path, duration = 60000) => {
    const series = history.query(path, duration);
    
    if (series.length === 0) {
      return null;
    }
    
    return {
      current: series[series.length - 1]?.value,
      trend: patternDetector.detectTrend(series),
      anomaly: patternDetector.detectAnomaly(series),
      pattern: patternDetector.findPattern(series),
      samples: series.length,
      duration,
      stats: calculateStats(series)
    };
  };
  
  /**
   * Calculate statistics for a time series
   */
  const calculateStats = (series) => {
    if (series.length === 0) return null;
    
    const values = series.map(s => s.value).filter(v => typeof v === 'number');
    if (values.length === 0) return null;
    
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return {
      mean,
      min: Math.min(...values),
      max: Math.max(...values),
      variance,
      stdDev: Math.sqrt(variance),
      latest: values[values.length - 1]
    };
  };
  
  /**
   * Get complete state snapshot
   */
  const getSnapshot = () => {
    return JSON.parse(JSON.stringify(state));
  };
  
  /**
   * Restore state from snapshot
   */
  const restoreSnapshot = (snapshot) => {
    Object.keys(snapshot).forEach(key => {
      state[key] = snapshot[key];
    });
    emitter.emit('stateRestored', { timestamp: Date.now() });
  };
  
  /**
   * Get state with predictions
   */
  const getStateWithPredictions = (path, futureSeconds = 5) => {
    const current = getState(path);
    const analysis = getTemporalAnalysis(path, 60000);
    
    if (!analysis || !analysis.trend || analysis.trend === 'stable') {
      return { current, predicted: current, confidence: 1.0 };
    }
    
    // Simple linear prediction
    const series = history.query(path, 10000);
    if (series.length < 2) {
      return { current, predicted: current, confidence: 0.5 };
    }
    
    const numericSeries = series.filter(s => typeof s.value === 'number' && !isNaN(s.value));
    if (numericSeries.length < 2) {
      return { current, predicted: current, confidence: 0.5 };
    }
    
    const values = numericSeries.map(s => s.value);
    const timestamps = numericSeries.map(s => s.timestamp);
    
    const n = values.length;
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = timestamps.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const futureTimestamp = Date.now() + futureSeconds * 1000;
    const predicted = slope * futureTimestamp + intercept;
    
    // Calculate confidence based on fit quality
    const predictions = timestamps.map(t => slope * t + intercept);
    const errors = values.map((v, i) => Math.abs(v - predictions[i]));
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const confidence = Math.max(0, 1 - avgError);
    
    return { current, predicted, confidence };
  };
  
  /**
   * Clear all state
   */
  const clear = () => {
    Object.keys(state).forEach(key => {
      state[key] = {};
    });
    subscribers.clear();
    emitter.removeAllListeners();
  };
  
  // Initialize derived states
  calculateDerivedStates('human.cognitive.workload', 0.5);
  calculateDerivedStates('system.vehicle.systems.engines', 'normal');
  calculateDerivedStates('environment.weather.visibility', 10000);
  
  logger.info('✅ Cognitive State Manager initialized');
  
  return {
    updateState,
    getState,
    setState,
    subscribe,
    getSnapshot,
    restoreSnapshot,
    getTemporalAnalysis,
    getStateWithPredictions,
    clear,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
};