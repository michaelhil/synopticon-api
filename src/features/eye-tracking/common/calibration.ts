/**
 * @fileoverview Advanced Calibration Management and Quality Assessment
 * 
 * Comprehensive calibration state management with quality metrics,
 * real-time quality monitoring, and advanced calibration algorithms.
 * Following functional programming patterns with factory functions.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { createCalibrationResult } from '../../../core/configuration/types.js';

/**
 * Calibration point data structure
 */
export interface CalibrationPoint {
  id: string;
  targetX: number;
  targetY: number;
  duration: number;
  samples: CalibrationSample[];
}

/**
 * Calibration sample collected at a point
 */
export interface CalibrationSample {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
  targetX: number;
  targetY: number;
}

/**
 * Validation point for accuracy calculation
 */
export interface ValidationPoint {
  targetX: number;
  targetY: number;
  gazeX: number;
  gazeY: number;
  confidence: number;
}

/**
 * Accuracy assessment result
 */
export interface AccuracyAssessment {
  accuracy: number;
  confidence: number;
  meanError: number;
  stdError: number;
  errorDegrees: number;
  accuracyGrade: 'excellent' | 'good' | 'acceptable' | 'poor' | 'very_poor';
  sampleCount: number;
  details: {
    distances: number[];
    distribution: ErrorDistribution;
  };
}

/**
 * Error distribution statistics
 */
export interface ErrorDistribution {
  min: number;
  max: number;
  median: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
}

/**
 * Data quality assessment result
 */
export interface DataQualityAssessment {
  quality: number;
  qualityGrade: 'excellent' | 'good' | 'acceptable' | 'poor' | 'very_poor';
  completeness: number;
  avgConfidence: number;
  intervalStability: number;
  spatialCoverage: {
    xRange: number;
    yRange: number;
  };
  issues: string[];
  recommendations: string[];
  sampleCount: number;
  validSampleCount: number;
}

/**
 * Calibration recommendation
 */
export interface CalibrationRecommendation {
  type: 'quality' | 'accuracy' | 'environment';
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  description: string;
}

/**
 * Calibration session state
 */
export interface CalibrationSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  status: 'collecting' | 'validating' | 'completed' | 'needs_recalibration';
  calibrationPoints: CalibrationPoint[];
  collectedData: CalibrationSample[];
  validationData: ValidationPoint[];
  currentPointIndex: number;
  quality: DataQualityAssessment | null;
  accuracy: AccuracyAssessment | null;
  recommendations: CalibrationRecommendation[];
  realtimeQuality?: DataQualityAssessment;
}

/**
 * Calibration metrics calculator interface
 */
export interface CalibrationMetrics {
  calculateAccuracy: (calibrationPoints: CalibrationSample[], validationPoints: ValidationPoint[]) => AccuracyAssessment;
  calculateErrorDistribution: (distances: number[]) => ErrorDistribution;
  assessDataQuality: (gazeData: CalibrationSample[]) => DataQualityAssessment;
}

/**
 * Advanced calibration manager interface
 */
export interface AdvancedCalibrationManager {
  // Session management
  startCalibrationSession: (sessionId: string, calibrationPoints?: CalibrationPoint[]) => CalibrationSession;
  addCalibrationData: (sessionId: string, gazeData: any) => CalibrationSession;
  performValidation: (sessionId: string) => Promise<any>;
  monitorRealTimeQuality: (sessionId: string, recentGazeData: any[]) => DataQualityAssessment | null;
  
  // Session access
  getSession: (sessionId: string) => CalibrationSession | null;
  getAllSessions: () => CalibrationSession[];
  cleanupSession: (sessionId: string) => boolean;
  
  // Event handlers
  onQualityUpdate: (callback: (event: { sessionId: string; quality: DataQualityAssessment; timestamp: number }) => void) => () => void;
  onCalibrationComplete: (callback: (result: any) => void) => () => void;
  onRecommendation: (callback: (event: { sessionId: string; recommendations: CalibrationRecommendation[]; quality: DataQualityAssessment; accuracy: AccuracyAssessment }) => void) => () => void;
  
  // Configuration
  setQualityThreshold: (threshold: number) => void;
  setAccuracyThreshold: (threshold: number) => void;
  
  // Utilities
  getMetrics: () => CalibrationMetrics;
}

/**
 * Configuration for calibration manager
 */
export interface CalibrationManagerConfig {
  validationStrategy?: 'cross_validation' | 'holdout' | 'bootstrap';
  qualityThreshold?: number;
  accuracyThreshold?: number; // degrees
}

/**
 * Internal state for calibration manager
 */
interface CalibrationManagerState {
  sessions: Map<string, CalibrationSession>;
  metrics: CalibrationMetrics;
  validationStrategy: string;
  qualityThreshold: number;
  accuracyThreshold: number;
  callbacks: {
    onQualityUpdate: Array<(event: { sessionId: string; quality: DataQualityAssessment; timestamp: number }) => void>;
    onCalibrationComplete: Array<(result: any) => void>;
    onValidationComplete: Array<(result: any) => void>;
    onRecommendation: Array<(event: { sessionId: string; recommendations: CalibrationRecommendation[]; quality: DataQualityAssessment; accuracy: AccuracyAssessment }) => void>;
  };
}

/**
 * Advanced calibration quality metrics factory
 */
export const createCalibrationMetrics = (): CalibrationMetrics => {
  const calculateAccuracy = (calibrationPoints: CalibrationSample[], validationPoints: ValidationPoint[]): AccuracyAssessment => {
    if (!calibrationPoints || !validationPoints || validationPoints.length === 0) {
      return { 
        accuracy: 0, 
        confidence: 0, 
        meanError: 0,
        stdError: 0,
        errorDegrees: 0,
        accuracyGrade: 'very_poor',
        sampleCount: 0,
        details: {
          distances: [],
          distribution: {
            min: 0, max: 0, median: 0, percentile25: 0, percentile75: 0, percentile95: 0
          }
        }
      };
    }

    const distances = validationPoints.map(validation => {
      const target = calibrationPoints.find(cal => 
        Math.abs(cal.targetX - validation.targetX) < 0.1 && 
        Math.abs(cal.targetY - validation.targetY) < 0.1
      );
      
      if (!target) return null;
      
      const dx = target.x - validation.gazeX;
      const dy = target.y - validation.gazeY;
      return Math.sqrt(dx * dx + dy * dy);
    }).filter((d): d is number => d !== null);

    if (distances.length === 0) {
      return {
        accuracy: 0, 
        confidence: 0, 
        meanError: 0,
        stdError: 0,
        errorDegrees: 0,
        accuracyGrade: 'very_poor',
        sampleCount: 0,
        details: {
          distances: [],
          distribution: {
            min: 0, max: 0, median: 0, percentile25: 0, percentile75: 0, percentile95: 0
          }
        }
      };
    }

    const meanError = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const stdError = Math.sqrt(
      distances.reduce((sum, d) => sum + Math.pow(d - meanError, 2), 0) / distances.length
    );

    // Convert to degrees (assuming screen distance ~60cm, screen width ~30cm)
    const errorDegrees = meanError * 28.6; // rough conversion to degrees
    
    let accuracyGrade: 'excellent' | 'good' | 'acceptable' | 'poor' | 'very_poor';
    let confidence: number;
    
    if (errorDegrees < 0.5) {
      accuracyGrade = 'excellent';
      confidence = 0.95;
    } else if (errorDegrees < 1.0) {
      accuracyGrade = 'good';
      confidence = 0.85;
    } else if (errorDegrees < 2.0) {
      accuracyGrade = 'acceptable';
      confidence = 0.7;
    } else if (errorDegrees < 3.0) {
      accuracyGrade = 'poor';
      confidence = 0.5;
    } else {
      accuracyGrade = 'very_poor';
      confidence = 0.3;
    }

    return {
      accuracy: Math.max(0, 1 - (errorDegrees / 5.0)), // Normalize to 0-1
      confidence,
      meanError,
      stdError,
      errorDegrees,
      accuracyGrade,
      sampleCount: distances.length,
      details: {
        distances,
        distribution: calculateErrorDistribution(distances)
      }
    };
  };

  const calculateErrorDistribution = (distances: number[]): ErrorDistribution => {
    const sorted = [...distances].sort((a, b) => a - b);
    const n = sorted.length;
    
    return {
      min: sorted[0],
      max: sorted[n - 1],
      median: n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)],
      percentile25: sorted[Math.floor(n * 0.25)],
      percentile75: sorted[Math.floor(n * 0.75)],
      percentile95: sorted[Math.floor(n * 0.95)]
    };
  };

  const assessDataQuality = (gazeData: CalibrationSample[]): DataQualityAssessment => {
    if (!gazeData || gazeData.length === 0) {
      return { 
        quality: 0, 
        qualityGrade: 'very_poor',
        completeness: 0,
        avgConfidence: 0,
        intervalStability: 0,
        spatialCoverage: { xRange: 0, yRange: 0 },
        issues: ['no_data'], 
        recommendations: ['collect_gaze_data'],
        sampleCount: 0,
        validSampleCount: 0
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    let qualityScore = 1.0;

    // Check data completeness
    const validSamples = gazeData.filter(d => d.confidence > 0.5);
    const completeness = validSamples.length / gazeData.length;
    
    if (completeness < 0.8) {
      issues.push('low_data_completeness');
      recommendations.push('improve_tracking_conditions');
      qualityScore *= 0.8;
    }

    // Check confidence distribution
    const avgConfidence = validSamples.length > 0 ? 
      validSamples.reduce((sum, d) => sum + d.confidence, 0) / validSamples.length : 0;
    if (avgConfidence < 0.7) {
      issues.push('low_confidence');
      recommendations.push('recalibrate_device');
      qualityScore *= 0.7;
    }

    // Check temporal stability
    const timeGaps: number[] = [];
    for (let i = 1; i < gazeData.length; i++) {
      timeGaps.push(gazeData[i].timestamp - gazeData[i-1].timestamp);
    }
    
    const avgInterval = timeGaps.length > 0 ? 
      timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length : 0;
    const expectedInterval = 1000 / 200; // 200Hz = 5ms
    const intervalStability = avgInterval > 0 ? 
      1 - Math.abs(avgInterval - expectedInterval) / expectedInterval : 0;
    
    if (intervalStability < 0.8) {
      issues.push('unstable_sampling_rate');
      recommendations.push('check_system_performance');
      qualityScore *= 0.9;
    }

    // Check spatial distribution
    const xValues = validSamples.map(d => d.x);
    const yValues = validSamples.map(d => d.y);
    
    const xRange = xValues.length > 0 ? Math.max(...xValues) - Math.min(...xValues) : 0;
    const yRange = yValues.length > 0 ? Math.max(...yValues) - Math.min(...yValues) : 0;
    
    if (xRange < 0.5 || yRange < 0.5) {
      issues.push('limited_spatial_coverage');
      recommendations.push('use_full_screen_calibration');
      qualityScore *= 0.8;
    }

    let qualityGrade: 'excellent' | 'good' | 'acceptable' | 'poor' | 'very_poor';
    if (qualityScore >= 0.9) qualityGrade = 'excellent';
    else if (qualityScore >= 0.8) qualityGrade = 'good';
    else if (qualityScore >= 0.7) qualityGrade = 'acceptable';
    else if (qualityScore >= 0.6) qualityGrade = 'poor';
    else qualityGrade = 'very_poor';

    return {
      quality: qualityScore,
      qualityGrade,
      completeness,
      avgConfidence,
      intervalStability,
      spatialCoverage: { xRange, yRange },
      issues,
      recommendations,
      sampleCount: gazeData.length,
      validSampleCount: validSamples.length
    };
  };

  return {
    calculateAccuracy,
    calculateErrorDistribution,
    assessDataQuality
  };
};

/**
 * Advanced calibration manager factory
 */
export const createAdvancedCalibrationManager = (config: CalibrationManagerConfig = {}): AdvancedCalibrationManager => {
  const state: CalibrationManagerState = {
    sessions: new Map(),
    metrics: createCalibrationMetrics(),
    validationStrategy: config.validationStrategy || 'cross_validation',
    qualityThreshold: config.qualityThreshold || 0.7,
    accuracyThreshold: config.accuracyThreshold || 1.5, // degrees
    callbacks: {
      onQualityUpdate: [],
      onCalibrationComplete: [],
      onValidationComplete: [],
      onRecommendation: []
    }
  };

  const startCalibrationSession = (sessionId: string, calibrationPoints?: CalibrationPoint[]): CalibrationSession => {
    const session: CalibrationSession = {
      sessionId,
      startTime: Date.now(),
      status: 'collecting',
      calibrationPoints: calibrationPoints || generateDefaultCalibrationPoints(),
      collectedData: [],
      validationData: [],
      currentPointIndex: 0,
      quality: null,
      accuracy: null,
      recommendations: []
    };

    state.sessions.set(sessionId, session);
    return session;
  };

  const generateDefaultCalibrationPoints = (): CalibrationPoint[] => {
    // 9-point calibration grid
    const points: CalibrationPoint[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        points.push({
          id: `point_${x}_${y}`,
          targetX: 0.1 + (x * 0.4), // 0.1, 0.5, 0.9
          targetY: 0.1 + (y * 0.4), // 0.1, 0.5, 0.9
          duration: 2000, // 2 seconds per point
          samples: []
        });
      }
    }
    return points;
  };

  const addCalibrationData = (sessionId: string, gazeData: any): CalibrationSession => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Calibration session ${sessionId} not found`);
    }

    const currentPoint = session.calibrationPoints[session.currentPointIndex];
    if (!currentPoint) {
      throw new Error('No current calibration point');
    }

    // Add gaze data to current point
    const sample: CalibrationSample = {
      ...gazeData,
      timestamp: Date.now(),
      targetX: currentPoint.targetX,
      targetY: currentPoint.targetY
    };
    
    currentPoint.samples.push(sample);
    session.collectedData.push(sample);

    // Check if current point has enough samples
    if (currentPoint.samples.length >= 10) { // At least 10 samples per point
      session.currentPointIndex++;
      
      if (session.currentPointIndex >= session.calibrationPoints.length) {
        // All points collected, move to validation
        session.status = 'validating';
        performValidation(sessionId);
      }
    }

    return session;
  };

  const performValidation = async (sessionId: string): Promise<any> => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Calibration session ${sessionId} not found`);
    }

    // Perform quality assessment
    const quality = state.metrics.assessDataQuality(session.collectedData);
    session.quality = quality;

    // Generate validation points (subset of calibration points)
    const validationPoints = generateValidationPoints(session.calibrationPoints);
    
    // Calculate accuracy metrics
    const accuracy = state.metrics.calculateAccuracy(
      session.collectedData,
      validationPoints
    );
    session.accuracy = accuracy;

    // Generate recommendations
    const recommendations = generateRecommendations(quality, accuracy);
    session.recommendations = recommendations;

    // Determine final status
    if (quality.quality >= state.qualityThreshold && 
        accuracy.errorDegrees <= state.accuracyThreshold) {
      session.status = 'completed';
    } else {
      session.status = 'needs_recalibration';
    }

    session.endTime = Date.now();

    // Create calibration result
    const calibrationResult = createCalibrationResult({
      sessionId,
      status: session.status,
      quality: quality.qualityGrade,
      accuracy: accuracy.accuracyGrade,
      timestamp: session.endTime,
      metrics: {
        quality,
        accuracy,
        duration: session.endTime - session.startTime,
        pointCount: session.calibrationPoints.length,
        sampleCount: session.collectedData.length
      },
      recommendations
    });

    // Notify callbacks
    state.callbacks.onCalibrationComplete.forEach(cb => {
      try {
        cb(calibrationResult);
      } catch (error) {
        console.warn('Calibration complete callback error:', error);
      }
    });

    if (recommendations.length > 0) {
      state.callbacks.onRecommendation.forEach(cb => {
        try {
          cb({ sessionId, recommendations, quality, accuracy });
        } catch (error) {
          console.warn('Recommendation callback error:', error);
        }
      });
    }

    return calibrationResult;
  };

  const generateValidationPoints = (calibrationPoints: CalibrationPoint[]): ValidationPoint[] => {
    // Use every other point for validation (cross-validation)
    return calibrationPoints.filter((_, index) => index % 2 === 0)
      .map(point => ({
        targetX: point.targetX,
        targetY: point.targetY,
        gazeX: point.samples.length > 0 ? 
          point.samples.reduce((sum, s) => sum + s.x, 0) / point.samples.length : 0,
        gazeY: point.samples.length > 0 ? 
          point.samples.reduce((sum, s) => sum + s.y, 0) / point.samples.length : 0,
        confidence: point.samples.length > 0 ?
          point.samples.reduce((sum, s) => sum + s.confidence, 0) / point.samples.length : 0
      }));
  };

  const generateRecommendations = (quality: DataQualityAssessment, accuracy: AccuracyAssessment): CalibrationRecommendation[] => {
    const recommendations: CalibrationRecommendation[] = [];

    // Quality-based recommendations
    quality.recommendations.forEach(rec => {
      recommendations.push({
        type: 'quality',
        priority: 'high',
        recommendation: rec,
        description: getRecommendationDescription(rec)
      });
    });

    // Accuracy-based recommendations
    if (accuracy.errorDegrees > 2.0) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        recommendation: 'recalibrate_full',
        description: 'Calibration accuracy is below acceptable threshold. Perform full recalibration.'
      });
    } else if (accuracy.errorDegrees > 1.0) {
      recommendations.push({
        type: 'accuracy',
        priority: 'medium',
        recommendation: 'recalibrate_partial',
        description: 'Consider partial recalibration to improve accuracy.'
      });
    }

    // Environmental recommendations
    if (quality.avgConfidence < 0.7) {
      recommendations.push({
        type: 'environment',
        priority: 'medium',
        recommendation: 'improve_lighting',
        description: 'Low confidence suggests poor lighting conditions. Improve ambient lighting.'
      });
    }

    return recommendations;
  };

  const getRecommendationDescription = (recommendation: string): string => {
    const descriptions: Record<string, string> = {
      'collect_gaze_data': 'Insufficient gaze data collected. Ensure eye tracker is properly positioned.',
      'improve_tracking_conditions': 'Low data completeness. Check for obstructions and ensure proper head positioning.',
      'recalibrate_device': 'Low confidence levels suggest device needs recalibration.',
      'check_system_performance': 'Unstable sampling rate detected. Check system performance and close unnecessary applications.',
      'use_full_screen_calibration': 'Limited spatial coverage. Use full screen area for calibration points.'
    };
    
    return descriptions[recommendation] || 'Follow standard calibration procedures.';
  };

  // Real-time quality monitoring
  const monitorRealTimeQuality = (sessionId: string, recentGazeData: any[]): DataQualityAssessment | null => {
    const session = state.sessions.get(sessionId);
    if (!session) return null;

    const quality = state.metrics.assessDataQuality(recentGazeData);
    
    // Update session with real-time quality
    session.realtimeQuality = quality;

    // Notify quality callbacks
    state.callbacks.onQualityUpdate.forEach(cb => {
      try {
        cb({ sessionId, quality, timestamp: Date.now() });
      } catch (error) {
        console.warn('Quality update callback error:', error);
      }
    });

    return quality;
  };

  // Session management
  const getSession = (sessionId: string): CalibrationSession | null => {
    const session = state.sessions.get(sessionId);
    return session ? { ...session } : null;
  };

  const getAllSessions = (): CalibrationSession[] => {
    return Array.from(state.sessions.values()).map(session => ({ ...session }));
  };

  const cleanupSession = (sessionId: string): boolean => {
    return state.sessions.delete(sessionId);
  };

  // Event handlers
  const onQualityUpdate = (callback: (event: { sessionId: string; quality: DataQualityAssessment; timestamp: number }) => void): (() => void) => {
    state.callbacks.onQualityUpdate.push(callback);
    return () => {
      const index = state.callbacks.onQualityUpdate.indexOf(callback);
      if (index !== -1) state.callbacks.onQualityUpdate.splice(index, 1);
    };
  };

  const onCalibrationComplete = (callback: (result: any) => void): (() => void) => {
    state.callbacks.onCalibrationComplete.push(callback);
    return () => {
      const index = state.callbacks.onCalibrationComplete.indexOf(callback);
      if (index !== -1) state.callbacks.onCalibrationComplete.splice(index, 1);
    };
  };

  const onRecommendation = (callback: (event: { sessionId: string; recommendations: CalibrationRecommendation[]; quality: DataQualityAssessment; accuracy: AccuracyAssessment }) => void): (() => void) => {
    state.callbacks.onRecommendation.push(callback);
    return () => {
      const index = state.callbacks.onRecommendation.indexOf(callback);
      if (index !== -1) state.callbacks.onRecommendation.splice(index, 1);
    };
  };

  return {
    // Session management
    startCalibrationSession,
    addCalibrationData,
    performValidation,
    monitorRealTimeQuality,
    
    // Session access
    getSession,
    getAllSessions,
    cleanupSession,
    
    // Event handlers
    onQualityUpdate,
    onCalibrationComplete,
    onRecommendation,
    
    // Configuration
    setQualityThreshold: (threshold: number) => { state.qualityThreshold = threshold; },
    setAccuracyThreshold: (threshold: number) => { state.accuracyThreshold = threshold; },
    
    // Utilities
    getMetrics: () => state.metrics
  };
};

/**
 * Calibration utility functions
 */
export const CalibrationUtils = {
  /**
   * Validate calibration configuration
   */
  validateConfig: (config: CalibrationManagerConfig): boolean => {
    if (config.qualityThreshold !== undefined && (config.qualityThreshold < 0 || config.qualityThreshold > 1)) {
      return false;
    }
    
    if (config.accuracyThreshold !== undefined && config.accuracyThreshold < 0) {
      return false;
    }
    
    const validStrategies = ['cross_validation', 'holdout', 'bootstrap'];
    if (config.validationStrategy && !validStrategies.includes(config.validationStrategy)) {
      return false;
    }
    
    return true;
  },

  /**
   * Generate custom calibration points pattern
   */
  generateCustomPattern: (pattern: 'grid' | 'cross' | 'random', pointCount = 9): CalibrationPoint[] => {
    const points: CalibrationPoint[] = [];
    
    switch (pattern) {
      case 'grid': {
        const gridSize = Math.ceil(Math.sqrt(pointCount));
        for (let i = 0; i < pointCount; i++) {
          const x = i % gridSize;
          const y = Math.floor(i / gridSize);
          points.push({
            id: `grid_${x}_${y}`,
            targetX: 0.1 + (x / (gridSize - 1)) * 0.8,
            targetY: 0.1 + (y / (gridSize - 1)) * 0.8,
            duration: 2000,
            samples: []
          });
        }
        break;
      }
      
      case 'cross': {
        // Center point
        points.push({
          id: 'center',
          targetX: 0.5,
          targetY: 0.5,
          duration: 2000,
          samples: []
        });
        
        // Cardinal directions
        const positions = [
          { x: 0.1, y: 0.5 }, // left
          { x: 0.9, y: 0.5 }, // right
          { x: 0.5, y: 0.1 }, // top
          { x: 0.5, y: 0.9 }, // bottom
          { x: 0.1, y: 0.1 }, // top-left
          { x: 0.9, y: 0.1 }, // top-right
          { x: 0.1, y: 0.9 }, // bottom-left
          { x: 0.9, y: 0.9 }  // bottom-right
        ];
        
        positions.slice(0, pointCount - 1).forEach((pos, i) => {
          points.push({
            id: `cross_${i}`,
            targetX: pos.x,
            targetY: pos.y,
            duration: 2000,
            samples: []
          });
        });
        break;
      }
      
      case 'random': {
        for (let i = 0; i < pointCount; i++) {
          points.push({
            id: `random_${i}`,
            targetX: 0.1 + Math.random() * 0.8,
            targetY: 0.1 + Math.random() * 0.8,
            duration: 2000,
            samples: []
          });
        }
        break;
      }
    }
    
    return points;
  },

  /**
   * Calculate calibration completion percentage
   */
  calculateProgress: (session: CalibrationSession): number => {
    const totalPoints = session.calibrationPoints.length;
    const completedPoints = session.calibrationPoints.filter(point => point.samples.length >= 10).length;
    return totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;
  },

  /**
   * Estimate remaining calibration time
   */
  estimateRemainingTime: (session: CalibrationSession): number => {
    const totalPoints = session.calibrationPoints.length;
    const completedPoints = session.calibrationPoints.filter(point => point.samples.length >= 10).length;
    const remainingPoints = totalPoints - completedPoints;
    
    if (remainingPoints <= 0) return 0;
    
    const avgDurationPerPoint = session.calibrationPoints.length > 0 ?
      session.calibrationPoints[0].duration : 2000;
    
    return remainingPoints * avgDurationPerPoint;
  }
};
