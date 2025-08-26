/**
 * Advanced Calibration Management and Quality Assessment
 * Comprehensive calibration state management with quality metrics
 * Following functional programming patterns with factory functions
 */

import { createCalibrationResult } from '../../core/types.js';

// Advanced calibration quality metrics
export const createCalibrationMetrics = () => {
  const calculateAccuracy = (calibrationPoints, validationPoints) => {
    if (!calibrationPoints || !validationPoints || validationPoints.length === 0) {
      return { accuracy: 0, confidence: 0, details: 'insufficient_data' };
    }

    const distances = validationPoints.map(validation => {
      const target = calibrationPoints.find(cal => 
        Math.abs(cal.targetX - validation.targetX) < 0.1 && 
        Math.abs(cal.targetY - validation.targetY) < 0.1
      );
      
      if (!target) return null;
      
      const dx = target.gazeX - validation.gazeX;
      const dy = target.gazeY - validation.gazeY;
      return Math.sqrt(dx * dx + dy * dy);
    }).filter(d => d !== null);

    if (distances.length === 0) {
      return { accuracy: 0, confidence: 0, details: 'no_matching_points' };
    }

    const meanError = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const stdError = Math.sqrt(
      distances.reduce((sum, d) => sum + Math.pow(d - meanError, 2), 0) / distances.length
    );

    // Convert to degrees (assuming screen distance ~60cm, screen width ~30cm)
    const errorDegrees = meanError * 28.6; // rough conversion to degrees
    
    let accuracyGrade;
    let confidence;
    
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

  const calculateErrorDistribution = (distances) => {
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

  const assessDataQuality = (gazeData) => {
    if (!gazeData || gazeData.length === 0) {
      return { quality: 0, issues: ['no_data'], recommendations: ['collect_gaze_data'] };
    }

    const issues = [];
    const recommendations = [];
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
    const avgConfidence = validSamples.reduce((sum, d) => sum + d.confidence, 0) / validSamples.length;
    if (avgConfidence < 0.7) {
      issues.push('low_confidence');
      recommendations.push('recalibrate_device');
      qualityScore *= 0.7;
    }

    // Check temporal stability
    const timeGaps = [];
    for (let i = 1; i < gazeData.length; i++) {
      timeGaps.push(gazeData[i].timestamp - gazeData[i-1].timestamp);
    }
    
    const avgInterval = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;
    const expectedInterval = 1000 / 200; // 200Hz = 5ms
    const intervalStability = 1 - Math.abs(avgInterval - expectedInterval) / expectedInterval;
    
    if (intervalStability < 0.8) {
      issues.push('unstable_sampling_rate');
      recommendations.push('check_system_performance');
      qualityScore *= 0.9;
    }

    // Check spatial distribution
    const xValues = validSamples.map(d => d.x);
    const yValues = validSamples.map(d => d.y);
    
    const xRange = Math.max(...xValues) - Math.min(...xValues);
    const yRange = Math.max(...yValues) - Math.min(...yValues);
    
    if (xRange < 0.5 || yRange < 0.5) {
      issues.push('limited_spatial_coverage');
      recommendations.push('use_full_screen_calibration');
      qualityScore *= 0.8;
    }

    let qualityGrade;
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

// Advanced calibration manager
export const createAdvancedCalibrationManager = (config = {}) => {
  const state = {
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

  const startCalibrationSession = (sessionId, calibrationPoints) => {
    const session = {
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

  const generateDefaultCalibrationPoints = () => {
    // 9-point calibration grid
    const points = [];
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

  const addCalibrationData = (sessionId, gazeData) => {
    const session = state.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Calibration session ${sessionId} not found`);
    }

    const currentPoint = session.calibrationPoints[session.currentPointIndex];
    if (!currentPoint) {
      throw new Error('No current calibration point');
    }

    // Add gaze data to current point
    currentPoint.samples.push({
      ...gazeData,
      timestamp: Date.now(),
      targetX: currentPoint.targetX,
      targetY: currentPoint.targetY
    });

    session.collectedData.push({
      ...gazeData,
      targetX: currentPoint.targetX,
      targetY: currentPoint.targetY
    });

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

  const performValidation = async (sessionId) => {
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

  const generateValidationPoints = (calibrationPoints) => {
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

  const generateRecommendations = (quality, accuracy) => {
    const recommendations = [];

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

  const getRecommendationDescription = (recommendation) => {
    const descriptions = {
      'collect_gaze_data': 'Insufficient gaze data collected. Ensure eye tracker is properly positioned.',
      'improve_tracking_conditions': 'Low data completeness. Check for obstructions and ensure proper head positioning.',
      'recalibrate_device': 'Low confidence levels suggest device needs recalibration.',
      'check_system_performance': 'Unstable sampling rate detected. Check system performance and close unnecessary applications.',
      'use_full_screen_calibration': 'Limited spatial coverage. Use full screen area for calibration points.'
    };
    
    return descriptions[recommendation] || 'Follow standard calibration procedures.';
  };

  // Real-time quality monitoring
  const monitorRealTimeQuality = (sessionId, recentGazeData) => {
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
  const getSession = (sessionId) => {
    const session = state.sessions.get(sessionId);
    return session ? { ...session } : null;
  };

  const getAllSessions = () => {
    return Array.from(state.sessions.values()).map(session => ({ ...session }));
  };

  const cleanupSession = (sessionId) => {
    return state.sessions.delete(sessionId);
  };

  // Event handlers
  const onQualityUpdate = (callback) => {
    state.callbacks.onQualityUpdate.push(callback);
    return () => {
      const index = state.callbacks.onQualityUpdate.indexOf(callback);
      if (index !== -1) state.callbacks.onQualityUpdate.splice(index, 1);
    };
  };

  const onCalibrationComplete = (callback) => {
    state.callbacks.onCalibrationComplete.push(callback);
    return () => {
      const index = state.callbacks.onCalibrationComplete.indexOf(callback);
      if (index !== -1) state.callbacks.onCalibrationComplete.splice(index, 1);
    };
  };

  const onRecommendation = (callback) => {
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
    setQualityThreshold: (threshold) => { state.qualityThreshold = threshold; },
    setAccuracyThreshold: (threshold) => { state.accuracyThreshold = threshold; },
    
    // Utilities
    getMetrics: () => state.metrics
  };
};