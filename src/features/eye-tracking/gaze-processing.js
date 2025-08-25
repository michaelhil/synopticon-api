/**
 * Gaze Data Processing Utilities
 * Following functional programming patterns with factory functions
 */

import { 
  createGazeData, 
  createEyeState, 
  createGazeSemantics, 
  createEyeTrackingResult 
} from '../../core/types.js';

// Gaze data validation and normalization
export const createGazeProcessor = (config = {}) => {
  const state = {
    screenWidth: config.screenWidth || 1920,
    screenHeight: config.screenHeight || 1080,
    confidenceThreshold: config.confidenceThreshold || 0.5,
    smoothingFactor: config.smoothingFactor || 0.3,
    lastGazePoint: null,
    gazeHistory: []
  };

  // Validate raw gaze data
  const validateGazeData = (rawData) => {
    if (!rawData) return { valid: false, reason: 'No data provided' };
    
    if (typeof rawData.x !== 'number' || typeof rawData.y !== 'number') {
      return { valid: false, reason: 'Invalid coordinates' };
    }
    
    if (rawData.x < 0 || rawData.x > 1 || rawData.y < 0 || rawData.y > 1) {
      return { valid: false, reason: 'Coordinates out of range' };
    }
    
    if (typeof rawData.confidence !== 'number' || rawData.confidence < 0 || rawData.confidence > 1) {
      return { valid: false, reason: 'Invalid confidence value' };
    }
    
    return { valid: true };
  };

  // Apply smoothing to gaze coordinates
  const applySmoothing = (currentGaze, previousGaze) => {
    if (!previousGaze) return currentGaze;
    
    const smoothing = state.smoothingFactor;
    return {
      x: previousGaze.x * (1 - smoothing) + currentGaze.x * smoothing,
      y: previousGaze.y * (1 - smoothing) + currentGaze.y * smoothing,
      confidence: Math.max(currentGaze.confidence, previousGaze.confidence * 0.9)
    };
  };

  // Calculate screen coordinates
  const toScreenCoordinates = (normalizedGaze) => ({
    x: Math.round(normalizedGaze.x * state.screenWidth),
    y: Math.round(normalizedGaze.y * state.screenHeight)
  });

  // Determine screen region
  const getScreenRegion = (gazeData) => {
    const { x, y } = gazeData;
    
    // Define regions
    if (x < 0.33) {
      if (y < 0.33) return 'upper_left';
      if (y > 0.66) return 'lower_left';
      return 'center_left';
    } else if (x > 0.66) {
      if (y < 0.33) return 'upper_right';
      if (y > 0.66) return 'lower_right';
      return 'center_right';
    } else {
      if (y < 0.33) return 'upper_center';
      if (y > 0.66) return 'lower_center';
      return 'center';
    }
  };

  // Calculate gaze velocity
  const calculateVelocity = (currentGaze, previousGaze, timeDelta) => {
    if (!previousGaze || timeDelta <= 0) return 0;
    
    const dx = currentGaze.x - previousGaze.x;
    const dy = currentGaze.y - previousGaze.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance / (timeDelta / 1000); // pixels per second
  };

  // Generate semantic description
  const generateSemantics = (gazeData, velocity = 0) => {
    const region = getScreenRegion(gazeData);
    const confidence = gazeData.confidence;
    
    let quality = 'low';
    if (confidence > 0.8) quality = 'high_confidence';
    else if (confidence > 0.6) quality = 'moderate';
    
    let interpretation = 'unknown';
    if (velocity < 0.1) interpretation = 'focused_attention';
    else if (velocity < 0.5) interpretation = 'scanning';
    else interpretation = 'rapid_movement';
    
    let behaviorType = 'unknown';
    if (velocity < 0.05) behaviorType = 'fixation';
    else if (velocity > 0.3) behaviorType = 'saccade';
    else behaviorType = 'smooth_pursuit';
    
    const screenCoords = toScreenCoordinates(gazeData);
    
    return createGazeSemantics({
      description: `Looking at ${region.replace('_', ' ')} region`,
      region,
      quality,
      interpretation,
      behaviorType,
      attentionLevel: confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low',
      gazePattern: interpretation,
      context: {
        calibrationQuality: 'unknown', // Will be updated by device manager
        trackingStability: velocity < 0.2 ? 'stable' : 'unstable',
        deviceHealth: 'unknown',
        environmentalConditions: 'unknown'
      },
      derived: {
        screenCoordinates: screenCoords,
        confidenceLevel: quality,
        gazeVelocity: velocity
      }
    });
  };

  // Main processing function
  const processGazeData = (rawData) => {
    // Validate input
    const validation = validateGazeData(rawData);
    if (!validation.valid) {
      throw new Error(`Invalid gaze data: ${validation.reason}`);
    }

    // Apply smoothing if enabled
    let processedGaze = { ...rawData };
    if (state.lastGazePoint && state.smoothingFactor > 0) {
      processedGaze = applySmoothing(processedGaze, state.lastGazePoint);
    }

    // Calculate velocity
    let velocity = 0;
    if (state.lastGazePoint) {
      const timeDelta = rawData.timestamp - state.lastGazePoint.timestamp;
      velocity = calculateVelocity(processedGaze, state.lastGazePoint, timeDelta);
    }

    // Generate semantic data
    const semantics = generateSemantics(processedGaze, velocity);

    // Create final gaze data object
    const gazeData = createGazeData({
      ...processedGaze,
      semantic: semantics,
      metadata: {
        velocity,
        screenCoordinates: toScreenCoordinates(processedGaze),
        region: semantics.region,
        smoothed: state.smoothingFactor > 0
      }
    });

    // Update history
    state.lastGazePoint = { ...processedGaze, timestamp: rawData.timestamp };
    state.gazeHistory.push(gazeData);
    
    // Keep history size reasonable
    if (state.gazeHistory.length > 1000) {
      state.gazeHistory = state.gazeHistory.slice(-1000);
    }

    return gazeData;
  };

  // Get recent gaze history
  const getGazeHistory = (duration = 5000) => {
    const cutoff = Date.now() - duration;
    return state.gazeHistory.filter(gaze => gaze.timestamp > cutoff);
  };

  // Calculate fixations from history
  const detectFixations = (duration = 5000, threshold = 0.05) => {
    const recentGaze = getGazeHistory(duration);
    if (recentGaze.length < 10) return [];

    const fixations = [];
    let currentFixation = null;

    for (const gaze of recentGaze) {
      if (!currentFixation) {
        currentFixation = {
          startTime: gaze.timestamp,
          x: gaze.x,
          y: gaze.y,
          points: [gaze],
          confidence: gaze.confidence
        };
        continue;
      }

      // Check if gaze point is within threshold
      const distance = Math.sqrt(
        Math.pow(gaze.x - currentFixation.x, 2) + 
        Math.pow(gaze.y - currentFixation.y, 2)
      );

      if (distance <= threshold) {
        // Continue current fixation
        currentFixation.points.push(gaze);
        currentFixation.confidence = Math.max(currentFixation.confidence, gaze.confidence);
      } else {
        // End current fixation and start new one
        if (currentFixation.points.length >= 5) { // Minimum 5 points for fixation
          fixations.push({
            ...currentFixation,
            endTime: currentFixation.points[currentFixation.points.length - 1].timestamp,
            duration: currentFixation.points[currentFixation.points.length - 1].timestamp - currentFixation.startTime,
            dispersion: calculateDispersion(currentFixation.points)
          });
        }

        currentFixation = {
          startTime: gaze.timestamp,
          x: gaze.x,
          y: gaze.y,
          points: [gaze],
          confidence: gaze.confidence
        };
      }
    }

    // Handle final fixation
    if (currentFixation && currentFixation.points.length >= 5) {
      fixations.push({
        ...currentFixation,
        endTime: currentFixation.points[currentFixation.points.length - 1].timestamp,
        duration: currentFixation.points[currentFixation.points.length - 1].timestamp - currentFixation.startTime,
        dispersion: calculateDispersion(currentFixation.points)
      });
    }

    return fixations;
  };

  // Calculate dispersion of gaze points
  const calculateDispersion = (points) => {
    if (points.length < 2) return 0;

    const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    const variance = points.reduce((sum, p) => {
      return sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2);
    }, 0) / points.length;

    return Math.sqrt(variance);
  };

  // Get processing statistics
  const getStats = () => ({
    totalProcessed: state.gazeHistory.length,
    historySize: state.gazeHistory.length,
    lastUpdate: state.lastGazePoint?.timestamp || null,
    averageConfidence: state.gazeHistory.length > 0 
      ? state.gazeHistory.reduce((sum, g) => sum + g.confidence, 0) / state.gazeHistory.length
      : 0,
    settings: {
      smoothingFactor: state.smoothingFactor,
      confidenceThreshold: state.confidenceThreshold,
      screenResolution: `${state.screenWidth}x${state.screenHeight}`
    }
  });

  return {
    processGazeData,
    validateGazeData,
    getGazeHistory,
    detectFixations,
    getStats,
    
    // Configuration
    setScreenSize: (width, height) => {
      state.screenWidth = width;
      state.screenHeight = height;
    },
    setSmoothing: (factor) => {
      state.smoothingFactor = Math.max(0, Math.min(1, factor));
    },
    setConfidenceThreshold: (threshold) => {
      state.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    },
    
    // Utilities
    toScreenCoordinates,
    getScreenRegion,
    generateSemantics
  };
};