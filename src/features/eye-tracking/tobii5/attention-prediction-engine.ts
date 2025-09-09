/**
 * @fileoverview Advanced Tobii 5 Attention Prediction Engine
 * 
 * Implements sophisticated attention prediction algorithms specifically for Tobii 5 devices,
 * including spatial attention prediction, saccade modeling, and cognitive load estimation
 * based on gaze patterns.
 * 
 * Features:
 * - Real-time attention prediction with 2-second horizon
 * - ROI-based attention modeling with dynamic zones
 * - Saccade prediction using velocity and acceleration patterns
 * - Cognitive load estimation from gaze metrics
 * - Integration with existing temporal context and explainable AI
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type { 
  GazeDataPoint, 
  AttentionPrediction, 
  ROIDefinition, 
  SaccadePattern,
  CognitiveLoadMetrics 
} from '@/core/sensors/eye-tracking/index.js';
import type { TemporalContextEngine } from '@/core/cognitive/temporal-context-engine.js';

/**
 * Configuration for attention prediction engine
 */
export interface AttentionPredictionConfig {
  predictionHorizon: number; // milliseconds
  samplingRate: number; // Hz
  smoothingWindowSize: number;
  roiUpdateInterval: number;
  saccadeVelocityThreshold: number; // degrees/second
  fixationDurationThreshold: number; // milliseconds
  cognitiveLoadWindow: number; // milliseconds
  adaptiveLearning: boolean;
  confidenceThreshold: number;
}

/**
 * Spatial attention prediction result
 */
export interface SpatialAttentionPrediction {
  predictedLocation: { x: number; y: number };
  confidence: number;
  timeToTarget: number;
  alternativeLocations: Array<{ x: number; y: number; probability: number }>;
  movementType: 'fixation' | 'saccade' | 'pursuit' | 'drift';
  roiProbabilities: Map<string, number>;
}

/**
 * Saccade prediction data
 */
export interface SaccadePrediction {
  onset: number; // predicted start time
  amplitude: number; // degrees
  direction: number; // radians
  velocity: number; // degrees/second
  duration: number; // milliseconds
  confidence: number;
  targetROI?: string;
}

/**
 * Advanced cognitive load metrics from gaze
 */
export interface GazeCognitiveMetrics {
  pupilDilationRate: number;
  fixationStability: number;
  saccadeEfficiency: number;
  visualSearchPatterns: number;
  attentionSwitchingRate: number;
  cognitiveLoadIndex: number;
  mentalEffortLevel: number;
}

/**
 * Creates an advanced attention prediction engine for Tobii 5 devices
 */
export const createTobii5AttentionPredictionEngine = (config: Partial<AttentionPredictionConfig> = {}) => {
  // Default configuration
  const {
    predictionHorizon = 2000, // 2 seconds
    samplingRate = 90, // 90Hz Tobii 5 typical rate
    smoothingWindowSize = 5,
    roiUpdateInterval = 1000,
    saccadeVelocityThreshold = 30.0,
    fixationDurationThreshold = 100,
    cognitiveLoadWindow = 10000, // 10 seconds
    adaptiveLearning = true,
    confidenceThreshold = 0.7
  } = config;

  // State management
  const state = {
    gazeHistory: new Array(1000).fill(null) as (GazeDataPoint | null)[],
    roiDefinitions: new Map<string, ROIDefinition>(),
    saccadeHistory: new Array(100).fill(null) as (SaccadePattern | null)[],
    attentionModel: {
      spatialWeights: new Map<string, number>(),
      temporalWeights: new Float32Array(20),
      velocityModel: { a: 0.1, b: 0.05, c: 0.8 },
      adaptationRate: 0.01
    },
    cognitiveMetrics: {
      recentPupilData: new Array(100).fill(null) as (number | null)[],
      fixationStability: 0.8,
      lastMetricsUpdate: 0
    },
    predictions: new Map<string, AttentionPrediction>(),
    lastUpdate: 0
  };

  // Integration with external systems
  let temporalContextEngine: TemporalContextEngine | null = null;

  /**
   * ROI (Region of Interest) management utilities
   */
  const roiUtils = {
    /**
     * Define a new region of interest
     */
    defineROI: (id: string, definition: ROIDefinition): void => {
      state.roiDefinitions.set(id, {
        ...definition,
        priority: definition.priority || 0.5,
        lastVisited: 0,
        visitCount: 0,
        averageDwellTime: 0
      });
    },

    /**
     * Update ROI priorities based on recent gaze patterns
     */
    updateROIPriorities: (): void => {
      const recentGaze = state.gazeHistory
        .filter(point => point && point.timestamp > Date.now() - roiUpdateInterval)
        .filter(Boolean) as GazeDataPoint[];

      for (const [roiId, roi] of state.roiDefinitions) {
        const gazeInROI = recentGaze.filter(point => 
          roiUtils.isGazeInROI(point, roi)
        );

        if (gazeInROI.length > 0) {
          const avgDwellTime = gazeInROI.reduce((sum, point, index, array) => {
            if (index === 0) return 0;
            return sum + (point.timestamp - array[index - 1].timestamp);
          }, 0) / Math.max(gazeInROI.length - 1, 1);

          // Update ROI statistics
          roi.visitCount = (roi.visitCount || 0) + 1;
          roi.averageDwellTime = avgDwellTime;
          roi.lastVisited = gazeInROI[gazeInROI.length - 1].timestamp;

          // Adaptive priority adjustment
          const recencyFactor = Math.exp(-(Date.now() - roi.lastVisited) / 5000);
          const dwellFactor = Math.tanh(avgDwellTime / 1000);
          roi.priority = 0.3 + 0.7 * (recencyFactor * 0.6 + dwellFactor * 0.4);
        }
      }
    },

    /**
     * Check if gaze point is within ROI
     */
    isGazeInROI: (gaze: GazeDataPoint, roi: ROIDefinition): boolean => {
      if (roi.shape === 'rectangle') {
        return gaze.x >= roi.bounds.x && 
               gaze.x <= roi.bounds.x + roi.bounds.width &&
               gaze.y >= roi.bounds.y && 
               gaze.y <= roi.bounds.y + roi.bounds.height;
      } else if (roi.shape === 'circle') {
        const dx = gaze.x - roi.center!.x;
        const dy = gaze.y - roi.center!.y;
        return Math.sqrt(dx * dx + dy * dy) <= roi.radius!;
      }
      return false;
    },

    /**
     * Get ROI probabilities for current gaze context
     */
    getROIProbabilities: (currentGaze: GazeDataPoint): Map<string, number> => {
      const probabilities = new Map<string, number>();
      const totalPriority = Array.from(state.roiDefinitions.values())
        .reduce((sum, roi) => sum + (roi.priority || 0.5), 0);

      for (const [roiId, roi] of state.roiDefinitions) {
        const distance = roiUtils.distanceToROI(currentGaze, roi);
        const proximityFactor = Math.exp(-distance / 200); // 200px falloff
        const priorityFactor = (roi.priority || 0.5) / totalPriority;
        
        probabilities.set(roiId, proximityFactor * priorityFactor);
      }

      return probabilities;
    },

    /**
     * Calculate distance from gaze point to ROI center
     */
    distanceToROI: (gaze: GazeDataPoint, roi: ROIDefinition): number => {
      let centerX: number, centerY: number;

      if (roi.shape === 'rectangle') {
        centerX = roi.bounds.x + roi.bounds.width / 2;
        centerY = roi.bounds.y + roi.bounds.height / 2;
      } else if (roi.shape === 'circle') {
        centerX = roi.center!.x;
        centerY = roi.center!.y;
      } else {
        return Infinity;
      }

      const dx = gaze.x - centerX;
      const dy = gaze.y - centerY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  };

  /**
   * Saccade detection and prediction utilities
   */
  const saccadeUtils = {
    /**
     * Detect saccades in recent gaze data
     */
    detectSaccades: (gazeData: GazeDataPoint[]): SaccadePattern[] => {
      const saccades: SaccadePattern[] = [];
      
      for (let i = 1; i < gazeData.length - 1; i++) {
        const prev = gazeData[i - 1];
        const curr = gazeData[i];
        const next = gazeData[i + 1];

        if (!prev || !curr || !next) continue;

        // Calculate velocity
        const dt1 = (curr.timestamp - prev.timestamp) / 1000;
        const dt2 = (next.timestamp - curr.timestamp) / 1000;
        
        if (dt1 <= 0 || dt2 <= 0) continue;

        const vx1 = (curr.x - prev.x) / dt1;
        const vy1 = (curr.y - prev.y) / dt1;
        const velocity1 = Math.sqrt(vx1 * vx1 + vy1 * vy1);

        const vx2 = (next.x - curr.x) / dt2;
        const vy2 = (next.y - curr.y) / dt2;
        const velocity2 = Math.sqrt(vx2 * vx2 + vy2 * vy2);

        // Saccade detection threshold
        if (velocity1 > saccadeVelocityThreshold || velocity2 > saccadeVelocityThreshold) {
          saccades.push({
            startTime: prev.timestamp,
            endTime: next.timestamp,
            startPosition: { x: prev.x, y: prev.y },
            endPosition: { x: next.x, y: next.y },
            peakVelocity: Math.max(velocity1, velocity2),
            amplitude: Math.sqrt(
              Math.pow(next.x - prev.x, 2) + Math.pow(next.y - prev.y, 2)
            ),
            direction: Math.atan2(next.y - prev.y, next.x - prev.x)
          });
        }
      }

      return saccades;
    },

    /**
     * Predict next saccade based on patterns
     */
    predictNextSaccade: (recentGaze: GazeDataPoint[]): SaccadePrediction | null => {
      if (recentGaze.length < 3) return null;

      const recentSaccades = saccadeUtils.detectSaccades(recentGaze);
      if (recentSaccades.length < 2) return null;

      const lastSaccade = recentSaccades[recentSaccades.length - 1];
      const avgAmplitude = recentSaccades.reduce((sum, s) => sum + s.amplitude, 0) / recentSaccades.length;
      const avgInterval = recentSaccades.reduce((sum, s, i) => {
        if (i === 0) return 0;
        return sum + (s.startTime - recentSaccades[i - 1].endTime);
      }, 0) / Math.max(recentSaccades.length - 1, 1);

      // Predict next saccade timing
      const timeSinceLastSaccade = Date.now() - lastSaccade.endTime;
      const saccadeProbability = Math.min(timeSinceLastSaccade / avgInterval, 1);

      if (saccadeProbability > 0.6) {
        return {
          onset: Date.now() + Math.max(50, avgInterval - timeSinceLastSaccade),
          amplitude: avgAmplitude * (0.8 + Math.random() * 0.4),
          direction: lastSaccade.direction + (Math.random() - 0.5) * Math.PI / 4,
          velocity: lastSaccade.peakVelocity * (0.9 + Math.random() * 0.2),
          duration: avgAmplitude / lastSaccade.peakVelocity * 1000,
          confidence: saccadeProbability * 0.8
        };
      }

      return null;
    }
  };

  /**
   * Cognitive load analysis from gaze patterns
   */
  const cognitiveAnalysis = {
    /**
     * Calculate cognitive load metrics from recent gaze data
     */
    calculateCognitiveMetrics: (gazeData: GazeDataPoint[]): GazeCognitiveMetrics => {
      if (gazeData.length < 10) {
        return {
          pupilDilationRate: 0.5,
          fixationStability: 0.8,
          saccadeEfficiency: 0.7,
          visualSearchPatterns: 0.5,
          attentionSwitchingRate: 0.3,
          cognitiveLoadIndex: 0.4,
          mentalEffortLevel: 0.4
        };
      }

      // Pupil dilation analysis
      const pupilData = gazeData
        .map(point => point.pupilDiameter)
        .filter((diameter): diameter is number => diameter != null);
      
      const pupilDilationRate = pupilData.length > 1 ? 
        cognitiveAnalysis.calculateTrendSlope(pupilData) : 0;

      // Fixation stability
      const fixations = gazeData.filter(point => 
        !saccadeUtils.detectSaccades([point]).length
      );
      const fixationVariability = fixations.length > 1 ?
        cognitiveAnalysis.calculateVariability(fixations.map(f => ({ x: f.x, y: f.y }))) : 0;
      const fixationStability = Math.max(0, 1 - fixationVariability / 100);

      // Saccade efficiency
      const saccades = saccadeUtils.detectSaccades(gazeData);
      const saccadeEfficiency = saccades.length > 0 ?
        saccades.reduce((sum, s) => sum + s.amplitude / (s.endTime - s.startTime), 0) / saccades.length / 1000 : 0.7;

      // Visual search patterns
      const roiTransitions = cognitiveAnalysis.calculateROITransitions(gazeData);
      const visualSearchPatterns = Math.min(roiTransitions / gazeData.length * 10, 1);

      // Attention switching rate
      const attentionSwitches = cognitiveAnalysis.countAttentionSwitches(gazeData);
      const attentionSwitchingRate = attentionSwitches / (gazeData.length / samplingRate);

      // Combined cognitive load index
      const cognitiveLoadIndex = (
        pupilDilationRate * 0.3 +
        (1 - fixationStability) * 0.2 +
        (1 - Math.min(saccadeEfficiency, 1)) * 0.2 +
        visualSearchPatterns * 0.15 +
        Math.min(attentionSwitchingRate, 1) * 0.15
      );

      // Mental effort level
      const mentalEffortLevel = Math.min(
        cognitiveLoadIndex * 1.2 + Math.random() * 0.1, 
        1
      );

      return {
        pupilDilationRate,
        fixationStability,
        saccadeEfficiency,
        visualSearchPatterns,
        attentionSwitchingRate,
        cognitiveLoadIndex,
        mentalEffortLevel
      };
    },

    /**
     * Calculate trend slope for time series data
     */
    calculateTrendSlope: (data: number[]): number => {
      if (data.length < 2) return 0;
      
      const n = data.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = data.reduce((sum, val) => sum + val, 0);
      const sumXY = data.reduce((sum, val, i) => sum + i * val, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

      return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    },

    /**
     * Calculate spatial variability
     */
    calculateVariability: (points: Array<{ x: number; y: number }>): number => {
      if (points.length < 2) return 0;

      const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

      const variance = points.reduce((sum, p) => {
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        return sum + (dx * dx + dy * dy);
      }, 0) / points.length;

      return Math.sqrt(variance);
    },

    /**
     * Calculate ROI transitions
     */
    calculateROITransitions: (gazeData: GazeDataPoint[]): number => {
      let transitions = 0;
      let currentROI: string | null = null;

      for (const point of gazeData) {
        let pointROI: string | null = null;

        for (const [roiId, roi] of state.roiDefinitions) {
          if (roiUtils.isGazeInROI(point, roi)) {
            pointROI = roiId;
            break;
          }
        }

        if (pointROI !== currentROI) {
          transitions++;
          currentROI = pointROI;
        }
      }

      return transitions;
    },

    /**
     * Count attention switches
     */
    countAttentionSwitches: (gazeData: GazeDataPoint[]): number => {
      // Simplified attention switch detection based on velocity changes
      let switches = 0;
      let prevVelocity = 0;

      for (let i = 1; i < gazeData.length; i++) {
        const curr = gazeData[i];
        const prev = gazeData[i - 1];
        
        if (!curr || !prev) continue;

        const dt = (curr.timestamp - prev.timestamp) / 1000;
        if (dt <= 0) continue;

        const velocity = Math.sqrt(
          Math.pow((curr.x - prev.x) / dt, 2) + 
          Math.pow((curr.y - prev.y) / dt, 2)
        );

        if (Math.abs(velocity - prevVelocity) > saccadeVelocityThreshold / 2) {
          switches++;
        }

        prevVelocity = velocity;
      }

      return switches;
    }
  };

  /**
   * Spatial attention prediction algorithms
   */
  const spatialPrediction = {
    /**
     * Predict next attention location
     */
    predictSpatialAttention: (currentGaze: GazeDataPoint, recentGaze: GazeDataPoint[]): SpatialAttentionPrediction => {
      const roiProbabilities = roiUtils.getROIProbabilities(currentGaze);
      const saccadePrediction = saccadeUtils.predictNextSaccade(recentGaze);
      
      // Determine movement type
      const recentVelocity = spatialPrediction.calculateCurrentVelocity(recentGaze);
      const movementType = spatialPrediction.classifyMovementType(recentVelocity, recentGaze);

      let predictedLocation: { x: number; y: number };
      let confidence: number;
      let timeToTarget: number;

      if (saccadePrediction && saccadePrediction.confidence > confidenceThreshold) {
        // Use saccade prediction
        predictedLocation = {
          x: currentGaze.x + Math.cos(saccadePrediction.direction) * saccadePrediction.amplitude,
          y: currentGaze.y + Math.sin(saccadePrediction.direction) * saccadePrediction.amplitude
        };
        confidence = saccadePrediction.confidence;
        timeToTarget = saccadePrediction.duration;
      } else {
        // Use ROI-based prediction
        let bestROI: string | null = null;
        let maxProbability = 0;

        for (const [roiId, probability] of roiProbabilities) {
          if (probability > maxProbability) {
            maxProbability = probability;
            bestROI = roiId;
          }
        }

        if (bestROI) {
          const roi = state.roiDefinitions.get(bestROI)!;
          if (roi.shape === 'rectangle') {
            predictedLocation = {
              x: roi.bounds.x + roi.bounds.width / 2,
              y: roi.bounds.y + roi.bounds.height / 2
            };
          } else {
            predictedLocation = { x: roi.center!.x, y: roi.center!.y };
          }
          confidence = maxProbability * 0.8;
          timeToTarget = spatialPrediction.estimateTimeToTarget(currentGaze, predictedLocation);
        } else {
          // Fallback: predict continuation of current trend
          const trend = spatialPrediction.calculateMovementTrend(recentGaze);
          predictedLocation = {
            x: currentGaze.x + trend.dx * (predictionHorizon / 1000),
            y: currentGaze.y + trend.dy * (predictionHorizon / 1000)
          };
          confidence = 0.4;
          timeToTarget = predictionHorizon;
        }
      }

      // Generate alternative locations
      const alternativeLocations = spatialPrediction.generateAlternativeLocations(
        currentGaze, 
        roiProbabilities, 
        3
      );

      return {
        predictedLocation,
        confidence,
        timeToTarget,
        alternativeLocations,
        movementType,
        roiProbabilities
      };
    },

    /**
     * Calculate current gaze velocity
     */
    calculateCurrentVelocity: (gazeData: GazeDataPoint[]): number => {
      if (gazeData.length < 2) return 0;

      const recent = gazeData.slice(-5);
      let totalVelocity = 0;
      let count = 0;

      for (let i = 1; i < recent.length; i++) {
        const curr = recent[i];
        const prev = recent[i - 1];
        
        if (!curr || !prev) continue;

        const dt = (curr.timestamp - prev.timestamp) / 1000;
        if (dt <= 0) continue;

        const velocity = Math.sqrt(
          Math.pow((curr.x - prev.x) / dt, 2) + 
          Math.pow((curr.y - prev.y) / dt, 2)
        );

        totalVelocity += velocity;
        count++;
      }

      return count > 0 ? totalVelocity / count : 0;
    },

    /**
     * Classify movement type
     */
    classifyMovementType: (velocity: number, gazeData: GazeDataPoint[]): SpatialAttentionPrediction['movementType'] => {
      if (velocity > saccadeVelocityThreshold) {
        return 'saccade';
      } else if (velocity > 5) {
        // Check for pursuit pattern
        const trend = spatialPrediction.calculateMovementTrend(gazeData);
        const consistency = Math.abs(trend.consistency);
        return consistency > 0.7 ? 'pursuit' : 'drift';
      } else {
        return 'fixation';
      }
    },

    /**
     * Calculate movement trend
     */
    calculateMovementTrend: (gazeData: GazeDataPoint[]): { dx: number; dy: number; consistency: number } => {
      if (gazeData.length < 3) {
        return { dx: 0, dy: 0, consistency: 0 };
      }

      const movements = [];
      for (let i = 1; i < gazeData.length; i++) {
        const curr = gazeData[i];
        const prev = gazeData[i - 1];
        
        if (!curr || !prev) continue;

        const dt = (curr.timestamp - prev.timestamp) / 1000;
        if (dt <= 0) continue;

        movements.push({
          dx: (curr.x - prev.x) / dt,
          dy: (curr.y - prev.y) / dt
        });
      }

      if (movements.length === 0) {
        return { dx: 0, dy: 0, consistency: 0 };
      }

      const avgDx = movements.reduce((sum, m) => sum + m.dx, 0) / movements.length;
      const avgDy = movements.reduce((sum, m) => sum + m.dy, 0) / movements.length;

      // Calculate consistency (how similar all movements are to the average)
      const variance = movements.reduce((sum, m) => {
        const diffDx = m.dx - avgDx;
        const diffDy = m.dy - avgDy;
        return sum + (diffDx * diffDx + diffDy * diffDy);
      }, 0) / movements.length;

      const consistency = Math.exp(-variance / 1000); // Normalize to 0-1

      return { dx: avgDx, dy: avgDy, consistency };
    },

    /**
     * Estimate time to reach target
     */
    estimateTimeToTarget: (current: GazeDataPoint, target: { x: number; y: number }): number => {
      const distance = Math.sqrt(
        Math.pow(target.x - current.x, 2) + 
        Math.pow(target.y - current.y, 2)
      );

      // Fitts' law approximation for saccade time
      const difficulty = Math.log2(distance / 10 + 1); // 10px minimum target size
      return Math.max(50, difficulty * 40); // 40ms per bit of difficulty, minimum 50ms
    },

    /**
     * Generate alternative likely locations
     */
    generateAlternativeLocations: (
      current: GazeDataPoint,
      roiProbabilities: Map<string, number>,
      count: number
    ): Array<{ x: number; y: number; probability: number }> => {
      const alternatives = [];

      // Sort ROIs by probability
      const sortedROIs = Array.from(roiProbabilities.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, count);

      for (const [roiId, probability] of sortedROIs) {
        const roi = state.roiDefinitions.get(roiId);
        if (!roi) continue;

        let location: { x: number; y: number };
        if (roi.shape === 'rectangle') {
          location = {
            x: roi.bounds.x + roi.bounds.width / 2,
            y: roi.bounds.y + roi.bounds.height / 2
          };
        } else {
          location = { x: roi.center!.x, y: roi.center!.y };
        }

        alternatives.push({ ...location, probability });
      }

      return alternatives;
    }
  };

  // Public API
  return {
    /**
     * Process new gaze data point
     */
    processGazeData: (gazeData: GazeDataPoint): AttentionPrediction => {
      // Add to history
      state.gazeHistory.shift();
      state.gazeHistory.push(gazeData);

      // Update ROI priorities periodically
      if (Date.now() - state.lastUpdate > roiUpdateInterval) {
        roiUtils.updateROIPriorities();
        state.lastUpdate = Date.now();
      }

      // Get recent valid gaze data
      const recentGaze = state.gazeHistory
        .filter(point => point && point.timestamp > Date.now() - predictionHorizon)
        .filter(Boolean) as GazeDataPoint[];

      // Generate spatial prediction
      const spatialPrediction_result = spatialPrediction.predictSpatialAttention(gazeData, recentGaze);

      // Calculate cognitive metrics
      const cognitiveMetrics = cognitiveAnalysis.calculateCognitiveMetrics(recentGaze);

      // Predict saccade
      const saccadePrediction = saccadeUtils.predictNextSaccade(recentGaze);

      // Integrate with temporal context if available
      let temporalContext = null;
      if (temporalContextEngine) {
        temporalContext = temporalContextEngine.analyzeTemporalContext({
          cognitiveLoad: cognitiveMetrics.cognitiveLoadIndex,
          fatigue: 1 - cognitiveMetrics.fixationStability,
          stress: cognitiveMetrics.mentalEffortLevel,
          timestamp: gazeData.timestamp
        });
      }

      const prediction: AttentionPrediction = {
        timestamp: gazeData.timestamp,
        spatialAttention: spatialPrediction_result,
        saccadePrediction,
        cognitiveMetrics,
        temporalContext,
        confidence: spatialPrediction_result.confidence,
        predictionHorizon,
        metadata: {
          samplingRate,
          roiCount: state.roiDefinitions.size,
          gazeHistoryLength: recentGaze.length
        }
      };

      // Store prediction
      state.predictions.set(`pred_${gazeData.timestamp}`, prediction);

      // Cleanup old predictions
      const cutoff = Date.now() - predictionHorizon * 5;
      for (const [key, pred] of state.predictions) {
        if (pred.timestamp < cutoff) {
          state.predictions.delete(key);
        }
      }

      return prediction;
    },

    /**
     * Define regions of interest
     */
    defineROI: roiUtils.defineROI,

    /**
     * Get current attention prediction
     */
    getCurrentPrediction: (): AttentionPrediction | null => {
      const predictions = Array.from(state.predictions.values());
      return predictions.length > 0 ? 
        predictions.reduce((latest, pred) => pred.timestamp > latest.timestamp ? pred : latest) :
        null;
    },

    /**
     * Get prediction history
     */
    getPredictionHistory: (duration: number = predictionHorizon): AttentionPrediction[] => {
      const cutoff = Date.now() - duration;
      return Array.from(state.predictions.values())
        .filter(pred => pred.timestamp >= cutoff)
        .sort((a, b) => a.timestamp - b.timestamp);
    },

    /**
     * Integrate with temporal context engine
     */
    integrateTemporalContext: (engine: TemporalContextEngine): void => {
      temporalContextEngine = engine;
    },

    /**
     * Get current cognitive load metrics
     */
    getCognitiveMetrics: (): GazeCognitiveMetrics => {
      const recentGaze = state.gazeHistory
        .filter(point => point && point.timestamp > Date.now() - cognitiveLoadWindow)
        .filter(Boolean) as GazeDataPoint[];

      return cognitiveAnalysis.calculateCognitiveMetrics(recentGaze);
    },

    /**
     * Update configuration
     */
    updateConfig: (newConfig: Partial<AttentionPredictionConfig>): void => {
      Object.assign(config, newConfig);
    },

    /**
     * Reset and clear state
     */
    reset: (): void => {
      state.gazeHistory.fill(null);
      state.predictions.clear();
      state.saccadeHistory.fill(null);
      state.lastUpdate = 0;
    },

    /**
     * Get engine statistics
     */
    getStats: () => ({
      gazePointsProcessed: state.gazeHistory.filter(Boolean).length,
      predictionsGenerated: state.predictions.size,
      roiDefined: state.roiDefinitions.size,
      lastUpdate: state.lastUpdate,
      averageConfidence: Array.from(state.predictions.values())
        .reduce((sum, pred) => sum + pred.confidence, 0) / state.predictions.size || 0
    })
  };
};
