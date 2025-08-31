/**
 * Sensor-Telemetry Correlation Engine
 * Fuses sensor data with telemetry data for enhanced insights
 */

import type { FrameData, TelemetryFrame, CorrelatedFrame, DerivedMetrics, CrossModalEvent } from '../../common/types';

export interface CorrelationConfig {
  timeWindow: number; // milliseconds
  confidenceThreshold: number;
  enableStressAnalysis: boolean;
  enablePerformanceAnalysis: boolean;
}

export interface CorrelationMetrics {
  totalCorrelations: number;
  successfulCorrelations: number;
  averageConfidence: number;
  processingLatency: number;
}

// Time-based correlation helper
const findTemporalMatches = (
  sensorData: FrameData[],
  telemetryData: TelemetryFrame[],
  timeWindow: number
): Array<{ sensor: FrameData; telemetry: TelemetryFrame; timeDelta: number }> => {
  const matches: Array<{ sensor: FrameData; telemetry: TelemetryFrame; timeDelta: number }> = [];
  
  sensorData.forEach(sensor => {
    const sensorTime = Number(sensor.timestamp);
    
    telemetryData.forEach(telemetry => {
      const telemetryTime = Number(telemetry.timestamp);
      const timeDelta = Math.abs(sensorTime - telemetryTime);
      
      if (timeDelta <= timeWindow * 1000) { // Convert ms to microseconds
        matches.push({ sensor, telemetry, timeDelta });
      }
    });
  });
  
  // Sort by time delta (closest matches first)
  return matches.sort((a, b) => a.timeDelta - b.timeDelta);
};

// Derive stress level from sensor and telemetry data
const calculateStressLevel = (sensorData: FrameData[], telemetryData: TelemetryFrame[]): number => {
  // Simplified stress calculation based on vehicle dynamics and sensor patterns
  let stressFactors = 0;
  let factorCount = 0;
  
  // Analyze telemetry for stress indicators
  telemetryData.forEach(frame => {
    // High acceleration/deceleration
    if (frame.vehicle.acceleration) {
      const accelMagnitude = Math.sqrt(
        frame.vehicle.acceleration[0]**2 + 
        frame.vehicle.acceleration[1]**2 + 
        frame.vehicle.acceleration[2]**2
      );
      if (accelMagnitude > 5) { // High G-force threshold
        stressFactors += 0.3;
        factorCount++;
      }
    }
    
    // Aggressive control inputs
    if (frame.controls) {
      const controlVariation = Math.abs(frame.controls.throttle - 0.5) + Math.abs(frame.controls.steering);
      if (controlVariation > 0.7) {
        stressFactors += 0.2;
        factorCount++;
      }
    }
  });
  
  return factorCount > 0 ? Math.min(1.0, stressFactors / factorCount) : 0.0;
};

// Calculate performance score based on multi-modal data
const calculatePerformanceScore = (telemetryData: TelemetryFrame[]): number => {
  if (telemetryData.length === 0) return 0;
  
  let performanceSum = 0;
  
  telemetryData.forEach(frame => {
    let frameScore = 0.5; // Baseline score
    
    // Smooth control inputs indicate good performance
    if (frame.controls) {
      const smoothness = 1.0 - (Math.abs(frame.controls.throttle - 0.7) + Math.abs(frame.controls.steering));
      frameScore += smoothness * 0.3;
    }
    
    // Consistent speed indicates control
    if (frame.performance) {
      const speedConsistency = frame.performance.speed > 0 ? Math.min(1.0, frame.performance.speed / 100) : 0;
      frameScore += speedConsistency * 0.2;
    }
    
    performanceSum += Math.max(0, Math.min(1, frameScore));
  });
  
  return performanceSum / telemetryData.length;
};

// Generate cross-modal events from derived metrics
const generateCrossModalEvents = (
  derived: DerivedMetrics,
  sensorFrames: FrameData[],
  telemetryFrames: TelemetryFrame[]
): CrossModalEvent[] => {
  const events: CrossModalEvent[] = [];
  
  if (derived.stressLevel && derived.stressLevel > 0.7) {
    events.push({
      type: 'high-stress-detected',
      timestamp: BigInt(Date.now() * 1000),
      sources: [...sensorFrames.map(f => f.sourceId), ...telemetryFrames.map(f => f.sourceId)],
      confidence: derived.stressLevel,
      data: { stressLevel: derived.stressLevel }
    });
  }
  
  if (derived.performanceScore && derived.performanceScore > 0.8) {
    events.push({
      type: 'high-performance-detected',
      timestamp: BigInt(Date.now() * 1000),
      sources: telemetryFrames.map(f => f.sourceId),
      confidence: derived.performanceScore,
      data: { performanceScore: derived.performanceScore }
    });
  }
  
  return events;
};

// Calculate derived metrics from sensor and telemetry data
const calculateDerivedMetrics = (
  sensorFrames: FrameData[],
  telemetryFrames: TelemetryFrame[],
  matches: any[],
  config: CorrelationConfig
): DerivedMetrics => ({
  stressLevel: config.enableStressAnalysis ? calculateStressLevel(sensorFrames, telemetryFrames) : undefined,
  performanceScore: config.enablePerformanceAnalysis ? calculatePerformanceScore(telemetryFrames) : undefined,
  workloadIndex: matches.length > 5 ? 0.8 : 0.4,
  reactionTime: matches.length > 0 ? matches[0].timeDelta / 1000 : undefined
});

// Factory function for correlation engine
export const createCorrelationEngine = (config: CorrelationConfig) => {
  let metrics: CorrelationMetrics = {
    totalCorrelations: 0,
    successfulCorrelations: 0,
    averageConfidence: 0,
    processingLatency: 0
  };

  const correlate = async (
    sensorFrames: FrameData[],
    telemetryFrames: TelemetryFrame[]
  ): Promise<CorrelatedFrame | null> => {
    const startTime = performance.now();
    metrics.totalCorrelations++;
    
    if (sensorFrames.length === 0 && telemetryFrames.length === 0) return null;
    
    const matches = findTemporalMatches(sensorFrames, telemetryFrames, config.timeWindow);
    if (matches.length === 0) return null;
    
    const derived = calculateDerivedMetrics(sensorFrames, telemetryFrames, matches, config);
    const events = generateCrossModalEvents(derived, sensorFrames, telemetryFrames);
    const confidence = Math.min(1.0, matches.length / 10 * (derived.stressLevel || 0.5));
    
    if (confidence >= config.confidenceThreshold) {
      metrics.successfulCorrelations++;
    }
    
    const processingTime = performance.now() - startTime;
    metrics.processingLatency = (metrics.processingLatency * 0.9) + (processingTime * 0.1);
    metrics.averageConfidence = (metrics.averageConfidence * 0.9) + (confidence * 0.1);
    
    return {
      timestamp: BigInt(Date.now() * 1000),
      sequenceNumber: metrics.totalCorrelations,
      sensors: sensorFrames,
      telemetry: telemetryFrames,
      derived,
      events,
      confidence
    };
  };
  
  const getMetrics = (): CorrelationMetrics => ({ ...metrics });
  
  const reset = (): void => {
    metrics = { totalCorrelations: 0, successfulCorrelations: 0, averageConfidence: 0, processingLatency: 0 };
  };
  
  return { correlate, getMetrics, reset };
};