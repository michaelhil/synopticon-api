/**
 * @fileoverview Fusion Algorithms for Multi-Modal Data Integration
 * 
 * Advanced algorithms for combining human state, environmental conditions,
 * and system telemetry into coherent situational awareness with confidence scoring.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type {
  FusionAlgorithms,
  FusionAlgorithmsFactory,
  PhysiologicalData,
  BehavioralData,
  PerformanceData,
  SelfReportData,
  HumanStateFusion,
  WeatherData,
  TrafficData,
  TerrainData,
  CommunicationsData,
  EnvironmentalFusion,
  RiskFactor,
  SystemState,
  SituationalAwarenessFusion
} from './types.js';

/**
 * Create fusion algorithms with configurable weighting strategies
 */
export const createFusionAlgorithms: FusionAlgorithmsFactory = () => ({
  
  /**
   * Combine human state indicators from multiple modalities
   * Uses weighted fusion with cross-validation between modalities
   */
  'human-state-fusion': (
    physiological?: PhysiologicalData,
    behavioral?: BehavioralData,
    performance?: PerformanceData,
    selfReport?: SelfReportData
  ): HumanStateFusion => {
    // Adaptive weights based on data availability and confidence
    const weights = calculateAdaptiveWeights({
      physiological: physiological?.confidence || 0,
      behavioral: behavioral?.confidence || 0,
      performance: performance?.confidence || 0,
      selfReport: selfReport?.confidence || 0
    });
    
    // Cognitive load assessment
    const cognitiveLoad = fuseCognitiveLoad({
      physiological,
      behavioral,
      performance,
      selfReport,
      weights
    });
    
    // Fatigue level assessment
    const fatigue = fuseFatigueLevel({
      physiological,
      behavioral,
      performance,
      selfReport,
      weights
    });
    
    // Stress level assessment
    const stress = fuseStressLevel({
      physiological,
      behavioral,
      performance,
      selfReport,
      weights
    });
    
    // Overall state calculation with cross-correlation
    const overallState = calculateOverallHumanState(cognitiveLoad, fatigue, stress);
    
    // Confidence calculation with uncertainty propagation
    const confidence = calculateHumanStateConfidence({
      physiological,
      behavioral,
      performance,
      selfReport,
      weights,
      convergence: calculateModalityConvergence(cognitiveLoad, fatigue, stress)
    });
    
    // Source tracking
    const sources = [
      physiological ? 'physiological' : null,
      behavioral ? 'behavioral' : null, 
      performance ? 'performance' : null,
      selfReport ? 'selfReport' : null
    ].filter(Boolean) as string[];

    return {
      cognitiveLoad,
      fatigue,
      stress,
      overallState,
      confidence,
      sources
    };
  },
  
  /**
   * Combine environmental data into risk assessment
   * Multi-factor risk analysis with contextual weighting
   */
  'environmental-fusion': (
    weather?: WeatherData,
    traffic?: TrafficData,
    terrain?: TerrainData,
    communications?: CommunicationsData
  ): EnvironmentalFusion => {
    const riskFactors: RiskFactor[] = [];
    let totalRisk = 0;
    let totalWeight = 0;
    
    // Weather risk assessment
    if (weather) {
      const weatherRisk = calculateWeatherRisk(weather);
      const weight = 0.4;
      totalRisk += weatherRisk.risk * weight;
      totalWeight += weight;
      riskFactors.push({
        type: 'weather',
        risk: weatherRisk.risk,
        factors: weatherRisk.factors,
        confidence: 0.85
      });
    }
    
    // Traffic risk assessment
    if (traffic) {
      const trafficRisk = calculateTrafficRisk(traffic);
      const weight = 0.3;
      totalRisk += trafficRisk.risk * weight;
      totalWeight += weight;
      riskFactors.push({
        type: 'traffic',
        risk: trafficRisk.risk,
        factors: trafficRisk.factors,
        confidence: 0.9
      });
    }
    
    // Terrain risk assessment
    if (terrain) {
      const terrainRisk = calculateTerrainRisk(terrain);
      const weight = 0.2;
      totalRisk += terrainRisk.risk * weight;
      totalWeight += weight;
      riskFactors.push({
        type: 'terrain',
        risk: terrainRisk.risk,
        factors: terrainRisk.factors,
        confidence: 0.8
      });
    }
    
    // Communications risk assessment
    if (communications) {
      const commRisk = calculateCommunicationsRisk(communications);
      const weight = 0.1;
      totalRisk += commRisk.risk * weight;
      totalWeight += weight;
      riskFactors.push({
        type: 'communications',
        risk: commRisk.risk,
        factors: commRisk.factors,
        confidence: 0.75
      });
    }

    // Normalize total risk
    const normalizedRisk = totalWeight > 0 ? totalRisk / totalWeight : 0;
    
    // Generate contextual recommendations
    const recommendation = generateEnvironmentalRecommendation(normalizedRisk, riskFactors);
    
    // Calculate overall confidence
    const confidence = riskFactors.length > 0 
      ? riskFactors.reduce((sum, f) => sum + (f.confidence || 0.8), 0) / riskFactors.length
      : 0.5;
    
    return {
      totalRisk: normalizedRisk,
      riskFactors,
      recommendation,
      confidence
    };
  },
  
  /**
   * Fuse human-system-environment for situational awareness
   * Demand-capability analysis with predictive modeling
   */
  'situational-awareness-fusion': (
    humanState: HumanStateFusion,
    systemState: SystemState,
    environmentState: EnvironmentalFusion
  ): SituationalAwarenessFusion => {
    // Human capability assessment (inverse of degradation)
    const humanCapability = calculateHumanCapability(humanState);
    
    // System reliability assessment
    const systemReliability = systemState.health || 0.9;
    
    // Environmental challenge level
    const environmentalChallenge = environmentState.totalRisk;
    
    // Task complexity factor
    const taskComplexity = systemState.complexity || 0.3;
    
    // Calculate total demand using multi-factor model
    const totalDemand = calculateTotalDemand({
      environmentalChallenge,
      systemReliability,
      taskComplexity
    });
    
    // Calculate total capability using synergistic model
    const totalCapability = calculateTotalCapability({
      humanCapability,
      systemReliability
    });
    
    // Demand-capability ratio with safety margins
    const demandCapabilityRatio = totalCapability > 0 ? totalDemand / totalCapability : 1.5;
    
    // Situational awareness level with exponential scaling
    const level = Math.max(0, Math.min(1, Math.exp(-demandCapabilityRatio + 1) * 0.8 + 0.2));
    
    // Status classification with hysteresis
    const status = classifySituationalStatus(demandCapabilityRatio, level);
    
    // Generate intelligent recommendations
    const recommendations = generateSituationalRecommendations({
      ratio: demandCapabilityRatio,
      humanState,
      systemState,
      environmentState,
      level
    });
    
    return {
      level,
      demand: totalDemand,
      capability: totalCapability,
      ratio: demandCapabilityRatio,
      status,
      recommendations
    };
  }
});

/**
 * Calculate adaptive weights based on data confidence levels
 */
const calculateAdaptiveWeights = (confidences: Record<string, number>) => {
  const baseWeights = {
    physiological: 0.35,
    behavioral: 0.30,
    performance: 0.25,
    selfReport: 0.10
  };

  const totalConfidence = Object.values(confidences).reduce((sum, c) => sum + Math.max(c, 0.1), 0);
  
  // Adjust weights based on relative confidence levels
  const adaptiveWeights: Record<string, number> = {};
  Object.entries(baseWeights).forEach(([key, baseWeight]) => {
    const confidence = confidences[key] || 0;
    const confidenceRatio = confidence / (totalConfidence / 4); // Normalize to average
    adaptiveWeights[key] = baseWeight * Math.max(0.5, Math.min(2.0, confidenceRatio));
  });

  // Normalize weights to sum to 1
  const totalWeight = Object.values(adaptiveWeights).reduce((sum, w) => sum + w, 0);
  Object.keys(adaptiveWeights).forEach(key => {
    adaptiveWeights[key] /= totalWeight;
  });

  return adaptiveWeights;
};

/**
 * Fuse cognitive load indicators with cross-validation
 */
const fuseCognitiveLoad = (data: {
  physiological?: PhysiologicalData;
  behavioral?: BehavioralData;
  performance?: PerformanceData;
  selfReport?: SelfReportData;
  weights: Record<string, number>;
}): number => {
  const { physiological, behavioral, performance, selfReport, weights } = data;

  let cognitiveLoad = 0;
  let totalWeight = 0;

  // Physiological indicators
  if (physiological?.heartRateVariability !== undefined) {
    const hrvLoad = Math.max(0, 1 - (physiological.heartRateVariability / 50)); // Normalized HRV
    cognitiveLoad += hrvLoad * weights.physiological;
    totalWeight += weights.physiological;
  }

  // Behavioral indicators
  if (behavioral?.taskSwitchingRate !== undefined) {
    const switchingLoad = Math.min(1, behavioral.taskSwitchingRate / 10); // Normalize switching rate
    cognitiveLoad += switchingLoad * weights.behavioral;
    totalWeight += weights.behavioral;
  }

  // Performance indicators (inverse relationship)
  if (performance?.accuracy !== undefined) {
    const performanceLoad = Math.max(0, 1 - performance.accuracy);
    cognitiveLoad += performanceLoad * weights.performance;
    totalWeight += weights.performance;
  }

  // Self-report
  if (selfReport?.workload !== undefined) {
    cognitiveLoad += selfReport.workload * weights.selfReport;
    totalWeight += weights.selfReport;
  }

  return totalWeight > 0 ? Math.min(1, cognitiveLoad / totalWeight) : 0.5;
};

/**
 * Fuse fatigue indicators with temporal weighting
 */
const fuseFatigueLevel = (data: {
  physiological?: PhysiologicalData;
  behavioral?: BehavioralData;
  performance?: PerformanceData;
  selfReport?: SelfReportData;
  weights: Record<string, number>;
}): number => {
  const { physiological, behavioral, performance, selfReport, weights } = data;

  let fatigue = 0;
  let totalWeight = 0;

  // Physiological fatigue indicators
  if (physiological?.eyeBlinkRate !== undefined) {
    const blinkFatigue = Math.min(1, physiological.eyeBlinkRate / 30); // Normalized blink rate
    fatigue += blinkFatigue * weights.physiological;
    totalWeight += weights.physiological;
  }

  // Behavioral fatigue indicators
  if (behavioral?.reactionTimeIncrease !== undefined) {
    const rtFatigue = Math.min(1, behavioral.reactionTimeIncrease / 500); // ms increase
    fatigue += rtFatigue * weights.behavioral;
    totalWeight += weights.behavioral;
  }

  // Performance degradation
  if (performance?.errorRate !== undefined) {
    const errorFatigue = Math.min(1, performance.errorRate * 5); // Scale error rate
    fatigue += errorFatigue * weights.performance;
    totalWeight += weights.performance;
  }

  // Self-reported fatigue
  if (selfReport?.fatigue !== undefined) {
    fatigue += selfReport.fatigue * weights.selfReport;
    totalWeight += weights.selfReport;
  }

  return totalWeight > 0 ? Math.min(1, fatigue / totalWeight) : 0.3;
};

/**
 * Fuse stress indicators with physiological emphasis
 */
const fuseStressLevel = (data: {
  physiological?: PhysiologicalData;
  behavioral?: BehavioralData;
  performance?: PerformanceData;
  selfReport?: SelfReportData;
  weights: Record<string, number>;
}): number => {
  const { physiological, behavioral, performance, selfReport, weights } = data;

  let stress = 0;
  let totalWeight = 0;

  // Physiological stress markers
  if (physiological?.cortisol !== undefined) {
    const cortisolStress = Math.min(1, physiological.cortisol / 25); // µg/dL normalized
    stress += cortisolStress * weights.physiological;
    totalWeight += weights.physiological;
  }

  // Behavioral stress indicators
  if (behavioral?.errorRecoveryTime !== undefined) {
    const recoveryStress = Math.min(1, behavioral.errorRecoveryTime / 2000); // ms normalized
    stress += recoveryStress * weights.behavioral;
    totalWeight += weights.behavioral;
  }

  // Performance variability under stress
  if (performance?.variability !== undefined) {
    const variabilityStress = Math.min(1, performance.variability * 2);
    stress += variabilityStress * weights.performance;
    totalWeight += weights.performance;
  }

  // Self-reported stress
  if (selfReport?.stress !== undefined) {
    stress += selfReport.stress * weights.selfReport;
    totalWeight += weights.selfReport;
  }

  return totalWeight > 0 ? Math.min(1, stress / totalWeight) : 0.3;
};

/**
 * Calculate overall human state with interaction effects
 */
const calculateOverallHumanState = (cognitiveLoad: number, fatigue: number, stress: number): number => {
  // Non-linear interaction model
  const linearCombination = (cognitiveLoad + fatigue + stress) / 3;
  
  // Multiplicative effects (stress amplifies cognitive load and fatigue)
  const stressAmplification = 1 + (stress * 0.3);
  const amplifiedLoad = Math.min(1, cognitiveLoad * stressAmplification);
  const amplifiedFatigue = Math.min(1, fatigue * stressAmplification);
  
  // Weighted combination
  return (linearCombination * 0.6) + ((amplifiedLoad + amplifiedFatigue) / 2 * 0.4);
};

/**
 * Calculate modality convergence (agreement between indicators)
 */
const calculateModalityConvergence = (cognitiveLoad: number, fatigue: number, stress: number): number => {
  const values = [cognitiveLoad, fatigue, stress];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  
  // High convergence = low variance
  return Math.max(0, 1 - (variance * 4));
};

/**
 * Calculate human state confidence with uncertainty propagation
 */
const calculateHumanStateConfidence = (params: {
  physiological?: PhysiologicalData;
  behavioral?: BehavioralData;
  performance?: PerformanceData;
  selfReport?: SelfReportData;
  weights: Record<string, number>;
  convergence: number;
}): number => {
  const { physiological, behavioral, performance, selfReport, weights, convergence } = params;

  // Base confidence from individual modalities
  const modalityConfidences = [
    physiological?.confidence || 0.8,
    behavioral?.confidence || 0.8,
    performance?.confidence || 0.9,
    selfReport?.confidence || 0.6
  ];

  const weightedConfidence = modalityConfidences.reduce((sum, conf, index) => {
    const modalityNames = ['physiological', 'behavioral', 'performance', 'selfReport'];
    const weight = weights[modalityNames[index]] || 0;
    return sum + (conf * weight);
  }, 0);

  // Adjust for convergence (agreement boosts confidence)
  const convergenceBonus = convergence * 0.2;
  
  // Final confidence with bounds
  return Math.max(0.3, Math.min(0.98, weightedConfidence + convergenceBonus));
};

/**
 * Weather risk calculation
 */
const calculateWeatherRisk = (weather: WeatherData) => {
  const factors: string[] = [];
  let risk = 0;

  // Visibility risk
  if (weather.visibility !== undefined) {
    const visibilityRisk = Math.max(0, 1 - (weather.visibility / 10000)); // 10km = 0 risk
    risk += visibilityRisk * 0.4;
    if (visibilityRisk > 0.3) factors.push('low-visibility');
  }

  // Wind risk
  if (weather.windSpeed !== undefined) {
    const windRisk = Math.min(1, weather.windSpeed / 50); // 50 km/h = max risk
    risk += windRisk * 0.3;
    if (windRisk > 0.4) factors.push('high-winds');
  }

  // Precipitation risk
  if (weather.precipitationIntensity !== undefined) {
    risk += weather.precipitationIntensity * 0.3;
    if (weather.precipitationIntensity > 0.5) factors.push('heavy-precipitation');
  }

  return { risk: Math.min(1, risk), factors };
};

/**
 * Traffic risk calculation
 */
const calculateTrafficRisk = (traffic: TrafficData) => {
  const factors: string[] = [];
  let risk = 0;

  // Traffic density risk
  if (traffic.density !== undefined) {
    const densityRisk = Math.min(1, traffic.density / 100);
    risk += densityRisk * 0.4;
    if (densityRisk > 0.7) factors.push('high-density');
  }

  // Conflict risk
  if (traffic.conflicts) {
    const conflictRisk = Math.min(1, traffic.conflicts.length / 10);
    risk += conflictRisk * 0.6;
    if (traffic.conflicts.length > 3) factors.push('multiple-conflicts');
  }

  return { risk: Math.min(1, risk), factors };
};

/**
 * Terrain risk calculation
 */
const calculateTerrainRisk = (terrain: TerrainData) => {
  const factors: string[] = [];
  const hazardCount = terrain.hazards.length;
  const risk = Math.min(1, hazardCount / 20);
  
  if (hazardCount > 5) factors.push('multiple-hazards');
  if (hazardCount > 15) factors.push('hazardous-terrain');

  return { risk, factors };
};

/**
 * Communications risk calculation
 */
const calculateCommunicationsRisk = (communications: CommunicationsData) => {
  const factors: string[] = [];
  const signalStrength = communications.signalStrength || 1;
  const risk = 1 - signalStrength;
  
  if (signalStrength < 0.3) factors.push('poor-signal');
  if (signalStrength < 0.1) factors.push('signal-loss');

  return { risk, factors };
};

/**
 * Generate environmental recommendation based on risk profile
 */
const generateEnvironmentalRecommendation = (
  totalRisk: number, 
  riskFactors: RiskFactor[]
): 'high-caution' | 'moderate-caution' | 'proceed-normal' => {
  if (totalRisk > 0.7) return 'high-caution';
  
  // Check for specific high-risk factors
  const hasHighRiskFactor = riskFactors.some(factor => factor.risk > 0.8);
  if (hasHighRiskFactor) return 'high-caution';
  
  if (totalRisk > 0.4) return 'moderate-caution';
  
  return 'proceed-normal';
};

/**
 * Calculate human capability from state assessment
 */
const calculateHumanCapability = (humanState: HumanStateFusion): number => {
  // Non-linear capability degradation model
  const degradation = humanState.overallState;
  const capability = Math.pow(1 - degradation, 1.5); // Exponential degradation
  
  // Confidence-weighted adjustment
  return capability * humanState.confidence + (1 - humanState.confidence) * 0.5;
};

/**
 * Calculate total demand using multi-factor model
 */
const calculateTotalDemand = (params: {
  environmentalChallenge: number;
  systemReliability: number;
  taskComplexity: number;
}): number => {
  const { environmentalChallenge, systemReliability, taskComplexity } = params;
  
  // Environmental contribution with exponential scaling
  const envDemand = Math.pow(environmentalChallenge, 1.2) * 0.5;
  
  // System unreliability increases demand
  const systemDemand = (1 - systemReliability) * 0.3;
  
  // Task complexity base demand
  const taskDemand = taskComplexity * 0.2;
  
  return Math.min(1, envDemand + systemDemand + taskDemand);
};

/**
 * Calculate total capability using synergistic model
 */
const calculateTotalCapability = (params: {
  humanCapability: number;
  systemReliability: number;
}): number => {
  const { humanCapability, systemReliability } = params;
  
  // Synergistic effect: human-system team capability
  const baseCapability = humanCapability * 0.6 + systemReliability * 0.4;
  
  // Synergy bonus when both are high
  const synergyBonus = humanCapability * systemReliability * 0.2;
  
  return Math.min(1, baseCapability + synergyBonus);
};

/**
 * Classify situational status with hysteresis
 */
const classifySituationalStatus = (ratio: number, level: number): SituationalAwarenessFusion['status'] => {
  // Use both ratio and level for robust classification
  if (ratio > 1.2 || level < 0.3) return 'overload';
  if (ratio > 0.8 || level < 0.5) return 'high-load';
  if (ratio > 0.5 || level < 0.7) return 'moderate-load';
  return 'low-load';
};

/**
 * Generate intelligent situational recommendations
 */
const generateSituationalRecommendations = (params: {
  ratio: number;
  humanState: HumanStateFusion;
  systemState: SystemState;
  environmentState: EnvironmentalFusion;
  level: number;
}): string[] => {
  const { ratio, humanState, systemState, environmentState, level } = params;
  const recommendations: string[] = [];
  
  // High demand-capability ratio interventions
  if (ratio > 1.0) {
    recommendations.push('Consider increasing automation level');
    
    if (humanState.fatigue > 0.7) {
      recommendations.push('Schedule immediate rest break');
    }
    
    if (environmentState.totalRisk > 0.6) {
      recommendations.push('Consider route change or delay');
    }
    
    if (systemState.health && systemState.health < 0.8) {
      recommendations.push('Address system reliability issues');
    }
  }
  
  // Low demand situations (opportunity for optimization)
  if (ratio < 0.3) {
    recommendations.push('Opportunity to reduce automation dependency');
    if (level > 0.8) {
      recommendations.push('Consider more complex tasks for skill maintenance');
    }
  }
  
  // Specific human state interventions
  if (humanState.stress > 0.7) {
    recommendations.push('Implement stress reduction techniques');
  }
  
  if (humanState.cognitiveLoad > 0.8) {
    recommendations.push('Simplify task interfaces and reduce information density');
  }
  
  return recommendations.slice(0, 4); // Limit to top 4 recommendations
};