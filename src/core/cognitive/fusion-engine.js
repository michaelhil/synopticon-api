/**
 * Information Fusion Engine
 * Combines multi-modal data (human state, simulator telemetry, environment) 
 * into coherent situational awareness with confidence scoring
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../shared/utils/logger.js';

const logger = createLogger({ level: 2 });

/**
 * Data source definitions with reliability weighting
 */
const DATA_SOURCES = {
  human: {
    physiological: { weight: 0.9, latency: 100, reliability: 0.95 },
    behavioral: { weight: 0.8, latency: 200, reliability: 0.85 },
    self_report: { weight: 0.6, latency: 1000, reliability: 0.7 },
    performance: { weight: 0.85, latency: 150, reliability: 0.9 }
  },
  simulator: {
    telemetry: { weight: 0.95, latency: 16, reliability: 0.98 },
    systems: { weight: 0.9, latency: 50, reliability: 0.95 },
    dynamics: { weight: 0.92, latency: 20, reliability: 0.97 },
    environment: { weight: 0.8, latency: 100, reliability: 0.85 }
  },
  external: {
    weather: { weight: 0.75, latency: 5000, reliability: 0.8 },
    traffic: { weight: 0.85, latency: 1000, reliability: 0.9 },
    navigation: { weight: 0.9, latency: 500, reliability: 0.92 },
    communications: { weight: 0.7, latency: 200, reliability: 0.85 }
  }
};

/**
 * Data quality assessment
 */
const assessDataQuality = (data, source, type) => {
  const sourceConfig = DATA_SOURCES[source]?.[type];
  if (!sourceConfig) {
    return { quality: 0, confidence: 0, issues: ['Unknown source/type'] };
  }
  
  const now = Date.now();
  const age = data.timestamp ? now - data.timestamp : 0;
  const staleness = Math.max(0, 1 - age / (sourceConfig.latency * 10));
  
  const completeness = calculateCompleteness(data);
  const consistency = checkConsistency(data, source, type);
  const plausibility = checkPlausibility(data, source, type);
  
  const quality = (
    staleness * 0.3 +
    completeness * 0.3 +
    consistency * 0.2 +
    plausibility * 0.2
  );
  
  const confidence = quality * sourceConfig.reliability;
  
  const issues = [];
  if (staleness < 0.5) issues.push('Stale data');
  if (completeness < 0.7) issues.push('Incomplete data');
  if (consistency < 0.5) issues.push('Inconsistent data');
  if (plausibility < 0.5) issues.push('Implausible values');
  
  return { quality, confidence, issues, staleness, completeness, consistency, plausibility };
};

const calculateCompleteness = (data) => {
  if (!data || typeof data !== 'object') return 0;
  
  const requiredFields = getRequiredFields(data);
  const presentFields = Object.keys(data).filter(key => data[key] != null);
  
  return requiredFields.length > 0 ? presentFields.length / requiredFields.length : 1;
};

const getRequiredFields = (data) => {
  // Determine required fields based on data structure
  if (data.type === 'human-physiological') return ['heartRate', 'timestamp'];
  if (data.type === 'simulator-telemetry') return ['position', 'velocity', 'timestamp'];
  if (data.type === 'environment-weather') return ['visibility', 'windSpeed', 'timestamp'];
  return Object.keys(data);
};

const checkConsistency = (data, source, type) => {
  // Check internal consistency of data values
  if (source === 'human' && type === 'physiological') {
    if (data.heartRate && (data.heartRate < 30 || data.heartRate > 220)) return 0.2;
    if (data.temperature && (data.temperature < 35 || data.temperature > 42)) return 0.2;
  }
  
  if (source === 'simulator' && type === 'telemetry') {
    if (data.altitude && data.altitude < -500) return 0.3;
    if (data.speed && data.speed < 0) return 0.1;
  }
  
  return 0.9;
};

const checkPlausibility = (data, source, type) => {
  // Check if values are plausible given context
  const now = Date.now();
  if (data.timestamp && Math.abs(now - data.timestamp) > 60000) return 0.4;
  
  return 0.85;
};

/**
 * Fusion algorithms for different data combinations
 */
const createFusionAlgorithms = () => ({
  
  // Combine human state indicators
  'human-state-fusion': (physiological, behavioral, performance, selfReport) => {
    const weights = {
      physiological: 0.35,
      behavioral: 0.30,
      performance: 0.25,
      selfReport: 0.10
    };
    
    const cognitiveLoad = (
      (physiological?.heartRateVariability || 0.5) * weights.physiological +
      (behavioral?.taskSwitchingRate || 0.5) * weights.behavioral +
      (1 - (performance?.accuracy || 0.8)) * weights.performance +
      (selfReport?.workload || 0.5) * weights.selfReport
    );
    
    const fatigue = (
      (physiological?.eyeBlinkRate || 0.3) * weights.physiological +
      (behavioral?.reactionTimeIncrease || 0.3) * weights.behavioral +
      (performance?.errorRate || 0.2) * weights.performance +
      (selfReport?.fatigue || 0.3) * weights.selfReport
    );
    
    const stress = (
      (physiological?.cortisol || 0.3) * weights.physiological +
      (behavioral?.errorRecoveryTime || 0.3) * weights.behavioral +
      (performance?.variability || 0.3) * weights.performance +
      (selfReport?.stress || 0.3) * weights.selfReport
    );
    
    const confidence = Math.min(
      physiological?.confidence || 0.8,
      behavioral?.confidence || 0.8,
      performance?.confidence || 0.9,
      selfReport?.confidence || 0.6
    );
    
    return {
      cognitiveLoad,
      fatigue,
      stress,
      overallState: (cognitiveLoad + fatigue + stress) / 3,
      confidence,
      sources: [
        physiological ? 'physiological' : null,
        behavioral ? 'behavioral' : null, 
        performance ? 'performance' : null,
        selfReport ? 'selfReport' : null
      ].filter(Boolean)
    };
  },
  
  // Combine environmental data
  'environmental-fusion': (weather, traffic, terrain, communications) => {
    const riskFactors = [];
    let totalRisk = 0;
    
    if (weather) {
      const weatherRisk = (
        (1 - Math.min(weather.visibility / 10000, 1)) * 0.3 +
        Math.min(weather.windSpeed / 50, 1) * 0.3 +
        weather.precipitationIntensity * 0.4
      );
      totalRisk += weatherRisk * 0.4;
      riskFactors.push({ type: 'weather', risk: weatherRisk, factors: ['visibility', 'wind', 'precipitation'] });
    }
    
    if (traffic) {
      const trafficRisk = (
        Math.min(traffic.density / 100, 1) * 0.4 +
        traffic.conflicts.length / 10 * 0.6
      );
      totalRisk += trafficRisk * 0.3;
      riskFactors.push({ type: 'traffic', risk: trafficRisk, factors: ['density', 'conflicts'] });
    }
    
    if (terrain) {
      const terrainRisk = terrain.hazards.length / 20;
      totalRisk += terrainRisk * 0.2;
      riskFactors.push({ type: 'terrain', risk: terrainRisk, factors: ['hazards'] });
    }
    
    if (communications) {
      const commRisk = 1 - (communications.signalStrength || 1);
      totalRisk += commRisk * 0.1;
      riskFactors.push({ type: 'communications', risk: commRisk, factors: ['signal'] });
    }
    
    return {
      totalRisk,
      riskFactors,
      recommendation: totalRisk > 0.7 ? 'high-caution' : 
                     totalRisk > 0.4 ? 'moderate-caution' : 'proceed-normal',
      confidence: Math.min(...riskFactors.map(f => f.confidence || 0.8))
    };
  },
  
  // Fuse human-system-environment for situational awareness
  'situational-awareness-fusion': (humanState, systemState, environmentState) => {
    const humanCapability = 1 - humanState.overallState;
    const systemReliability = systemState.health || 0.9;
    const environmentalChallenge = environmentState.totalRisk;
    
    // Calculate demand vs capability
    const totalDemand = (
      environmentalChallenge * 0.5 +
      (1 - systemReliability) * 0.3 +
      (systemState.complexity || 0.3) * 0.2
    );
    
    const totalCapability = (
      humanCapability * 0.6 +
      systemReliability * 0.4
    );
    
    const demandCapabilityRatio = totalDemand / totalCapability;
    
    const situationalAwareness = {
      level: Math.max(0, 1 - demandCapabilityRatio),
      demand: totalDemand,
      capability: totalCapability,
      ratio: demandCapabilityRatio,
      status: demandCapabilityRatio > 1.2 ? 'overload' :
              demandCapabilityRatio > 0.8 ? 'high-load' :
              demandCapabilityRatio > 0.5 ? 'moderate-load' : 'low-load',
      recommendations: generateSituationalRecommendations(demandCapabilityRatio, humanState, systemState, environmentState)
    };
    
    return situationalAwareness;
  }
});

const generateSituationalRecommendations = (ratio, human, system, environment) => {
  const recommendations = [];
  
  if (ratio > 1.0) {
    recommendations.push('Consider increasing automation level');
    if (human.fatigue > 0.7) recommendations.push('Schedule immediate break');
    if (environment.totalRisk > 0.6) recommendations.push('Consider route change');
  }
  
  if (ratio < 0.3) {
    recommendations.push('Opportunity to reduce automation');
    recommendations.push('Consider more complex tasks');
  }
  
  return recommendations;
};

/**
 * Temporal fusion for trend analysis
 */
const createTemporalFusion = () => {
  const history = new Map();
  const maxHistory = 1000;
  
  const addDataPoint = (key, data) => {
    if (!history.has(key)) {
      history.set(key, []);
    }
    
    const series = history.get(key);
    series.push({ ...data, timestamp: Date.now() });
    
    if (series.length > maxHistory) {
      series.shift();
    }
  };
  
  const getTrend = (key, duration = 60000) => {
    const series = history.get(key) || [];
    const cutoff = Date.now() - duration;
    const recent = series.filter(p => p.timestamp >= cutoff);
    
    if (recent.length < 3) {
      return { trend: 'insufficient-data', confidence: 0 };
    }
    
    // Simple linear trend
    const values = recent.map(p => p.value || 0);
    const n = values.length;
    const sumX = recent.reduce((sum, p, i) => sum + i, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = recent.reduce((sum, p, i) => sum + i * (p.value || 0), 0);
    const sumX2 = recent.reduce((sum, p, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return {
      trend: Math.abs(slope) < 0.01 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing',
      slope,
      confidence: Math.min(1, recent.length / 10),
      samples: recent.length
    };
  };
  
  return { addDataPoint, getTrend };
};

/**
 * Main Information Fusion Engine
 */
export const createInformationFusionEngine = (config = {}) => {
  const algorithms = createFusionAlgorithms();
  const temporal = createTemporalFusion();
  const emitter = new EventEmitter();
  
  // Data storage with quality assessment
  const dataStore = new Map();
  const fusionResults = new Map();
  
  const ingestData = (source, type, data) => {
    const quality = assessDataQuality(data, source, type);
    const enrichedData = {
      ...data,
      source,
      type,
      quality,
      ingested: Date.now()
    };
    
    const key = `${source}-${type}`;
    dataStore.set(key, enrichedData);
    temporal.addDataPoint(key, { value: data.value || 0, quality: quality.quality });
    
    emitter.emit('dataIngested', { source, type, data: enrichedData });
    
    // Trigger fusion if we have sufficient data
    checkAndTriggerFusion();
    
    return quality;
  };
  
  const checkAndTriggerFusion = () => {
    // Check if we have data for human state fusion
    if (hasDataForFusion(['human-physiological', 'human-behavioral', 'human-performance'])) {
      performFusion('human-state');
    }
    
    // Check if we have data for environmental fusion
    if (hasDataForFusion(['external-weather', 'external-traffic'])) {
      performFusion('environmental');
    }
    
    // Check if we have data for situational awareness
    if (fusionResults.has('human-state') && fusionResults.has('environmental') && 
        dataStore.has('simulator-telemetry')) {
      performFusion('situational-awareness');
    }
  };
  
  const hasDataForFusion = (requiredKeys) => {
    return requiredKeys.some(key => dataStore.has(key));
  };
  
  const performFusion = (fusionType) => {
    let result;
    const timestamp = Date.now();
    
    switch (fusionType) {
      case 'human-state':
        result = algorithms['human-state-fusion'](
          dataStore.get('human-physiological'),
          dataStore.get('human-behavioral'),
          dataStore.get('human-performance'),
          dataStore.get('human-self_report')
        );
        break;
        
      case 'environmental':
        result = algorithms['environmental-fusion'](
          dataStore.get('external-weather'),
          dataStore.get('external-traffic'),
          dataStore.get('external-terrain'),
          dataStore.get('external-communications')
        );
        break;
        
      case 'situational-awareness':
        result = algorithms['situational-awareness-fusion'](
          fusionResults.get('human-state'),
          dataStore.get('simulator-telemetry'),
          fusionResults.get('environmental')
        );
        break;
    }
    
    if (result) {
      result.timestamp = timestamp;
      result.fusionType = fusionType;
      fusionResults.set(fusionType, result);
      
      emitter.emit('fusionCompleted', { type: fusionType, result });
      logger.debug(`Fusion completed: ${fusionType}`, result);
    }
  };
  
  const getFusionResult = (type) => {
    return fusionResults.get(type);
  };
  
  const getAllFusionResults = () => {
    return Object.fromEntries(fusionResults);
  };
  
  const getDataQuality = () => {
    const qualities = Array.from(dataStore.values()).map(d => d.quality);
    
    return {
      sources: dataStore.size,
      averageQuality: qualities.reduce((sum, q) => sum + q.quality, 0) / qualities.length,
      averageConfidence: qualities.reduce((sum, q) => sum + q.confidence, 0) / qualities.length,
      issues: qualities.flatMap(q => q.issues),
      bySource: Array.from(dataStore.entries()).reduce((acc, [key, data]) => {
        acc[key] = data.quality;
        return acc;
      }, {})
    };
  };
  
  const getTrends = (duration) => {
    const trends = {};
    for (const [key] of dataStore) {
      trends[key] = temporal.getTrend(key, duration);
    }
    return trends;
  };
  
  logger.info('✅ Information Fusion Engine initialized');
  
  return {
    ingestData,
    getFusionResult,
    getAllFusionResults,
    getDataQuality,
    getTrends,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
};