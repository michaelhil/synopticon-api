/**
 * @fileoverview Gaze Data Processing Utilities
 * 
 * Advanced gaze data processing with smoothing, validation, fixation detection,
 * and semantic analysis following functional programming patterns.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { 
  createEyeState, 
  createEyeTrackingResult, 
  createGazeData, 
  createGazeSemantics 
} from '../../../core/configuration/types.js';

/**
 * Gaze processor configuration
 */
export interface GazeProcessorConfig {
  screenWidth?: number;
  screenHeight?: number;
  confidenceThreshold?: number;
  smoothingFactor?: number;
}

/**
 * Raw gaze data input
 */
export interface RawGazeData {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
}

/**
 * Processed gaze point
 */
export interface GazePoint {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
}

/**
 * Screen coordinates
 */
export interface ScreenCoordinates {
  x: number;
  y: number;
}

/**
 * Screen region type
 */
export type ScreenRegion = 
  | 'upper_left' | 'upper_center' | 'upper_right'
  | 'center_left' | 'center' | 'center_right'
  | 'lower_left' | 'lower_center' | 'lower_right';

/**
 * Gaze validation result
 */
export interface GazeValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Fixation data
 */
export interface Fixation {
  startTime: number;
  endTime: number;
  duration: number;
  x: number;
  y: number;
  confidence: number;
  points: GazePoint[];
  dispersion: number;
}

/**
 * Gaze processor statistics
 */
export interface GazeProcessorStats {
  totalProcessed: number;
  historySize: number;
  lastUpdate: number | null;
  averageConfidence: number;
  settings: {
    smoothingFactor: number;
    confidenceThreshold: number;
    screenResolution: string;
  };
}

/**
 * Gaze processor interface
 */
export interface GazeProcessor {
  processGazeData: (rawData: RawGazeData) => any;
  validateGazeData: (rawData: RawGazeData) => GazeValidationResult;
  getGazeHistory: (duration?: number) => any[];
  detectFixations: (duration?: number, threshold?: number) => Fixation[];
  getStats: () => GazeProcessorStats;
  
  // Configuration
  setScreenSize: (width: number, height: number) => void;
  setSmoothing: (factor: number) => void;
  setConfidenceThreshold: (threshold: number) => void;
  
  // Utilities
  toScreenCoordinates: (normalizedGaze: GazePoint) => ScreenCoordinates;
  getScreenRegion: (gazeData: GazePoint) => ScreenRegion;
  generateSemantics: (gazeData: GazePoint, velocity?: number) => any;
}

/**
 * Internal state for gaze processor
 */
interface GazeProcessorState {
  screenWidth: number;
  screenHeight: number;
  confidenceThreshold: number;
  smoothingFactor: number;
  lastGazePoint: GazePoint | null;
  gazeHistory: any[];
}

/**
 * Gaze data validation and normalization
 */
export const createGazeProcessor = (config: GazeProcessorConfig = {}): GazeProcessor => {
  const state: GazeProcessorState = {
    screenWidth: config.screenWidth || 1920,
    screenHeight: config.screenHeight || 1080,
    confidenceThreshold: config.confidenceThreshold || 0.5,
    smoothingFactor: config.smoothingFactor || 0.3,
    lastGazePoint: null,
    gazeHistory: []
  };

  // Validate raw gaze data
  const validateGazeData = (rawData: RawGazeData): GazeValidationResult => {
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
  const applySmoothing = (currentGaze: GazePoint, previousGaze: GazePoint): GazePoint => {
    if (!previousGaze) return currentGaze;
    
    const smoothing = state.smoothingFactor;
    return {
      x: previousGaze.x * (1 - smoothing) + currentGaze.x * smoothing,
      y: previousGaze.y * (1 - smoothing) + currentGaze.y * smoothing,
      confidence: Math.max(currentGaze.confidence, previousGaze.confidence * 0.9),
      timestamp: currentGaze.timestamp
    };
  };

  // Calculate screen coordinates
  const toScreenCoordinates = (normalizedGaze: GazePoint): ScreenCoordinates => ({
    x: Math.round(normalizedGaze.x * state.screenWidth),
    y: Math.round(normalizedGaze.y * state.screenHeight)
  });

  // Determine screen region
  const getScreenRegion = (gazeData: GazePoint): ScreenRegion => {
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
  const calculateVelocity = (currentGaze: GazePoint, previousGaze: GazePoint, timeDelta: number): number => {
    if (!previousGaze || timeDelta <= 0) return 0;
    
    const dx = currentGaze.x - previousGaze.x;
    const dy = currentGaze.y - previousGaze.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance / (timeDelta / 1000); // pixels per second
  };

  // Generate semantic description
  const generateSemantics = (gazeData: GazePoint, velocity = 0): any => {
    const region = getScreenRegion(gazeData);
    const {confidence} = gazeData;
    
    let quality: 'low' | 'moderate' | 'high_confidence' = 'low';
    if (confidence > 0.8) quality = 'high_confidence';
    else if (confidence > 0.6) quality = 'moderate';
    
    let interpretation: 'unknown' | 'focused_attention' | 'scanning' | 'rapid_movement' = 'unknown';
    if (velocity < 0.1) interpretation = 'focused_attention';
    else if (velocity < 0.5) interpretation = 'scanning';
    else interpretation = 'rapid_movement';
    
    let behaviorType: 'unknown' | 'fixation' | 'saccade' | 'smooth_pursuit' = 'unknown';
    if (velocity < 0.05) behaviorType = 'fixation';
    else if (velocity > 0.3) behaviorType = 'saccade';
    else behaviorType = 'smooth_pursuit';
    
    const screenCoords = toScreenCoordinates(gazeData);
    
    return createGazeSemantics({
      description: `Looking at ${region.replace('_', ' ')} region (${interpretation})`,
      region,
      quality,
      confidence,
      metadata: {
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
      }
    });
  };

  // Main processing function
  const processGazeData = (rawData: RawGazeData): any => {
    // Validate input
    const validation = validateGazeData(rawData);
    if (!validation.valid) {
      throw new Error(`Invalid gaze data: ${validation.reason}`);
    }

    // Apply smoothing if enabled
    let processedGaze: GazePoint = { ...rawData };
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
  const getGazeHistory = (duration = 5000): any[] => {
    const cutoff = Date.now() - duration;
    return state.gazeHistory.filter(gaze => gaze.timestamp > cutoff);
  };

  // Calculate fixations from history
  const detectFixations = (duration = 5000, threshold = 0.05): Fixation[] => {
    const recentGaze = getGazeHistory(duration);
    if (recentGaze.length < 10) return [];

    const fixations: Fixation[] = [];
    let currentFixation: Partial<Fixation> | null = null;

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
        Math.pow(gaze.x - currentFixation.x!, 2) + 
        Math.pow(gaze.y - currentFixation.y!, 2)
      );

      if (distance <= threshold) {
        // Continue current fixation
        currentFixation.points!.push(gaze);
        currentFixation.confidence = Math.max(currentFixation.confidence!, gaze.confidence);
      } else {
        // End current fixation and start new one
        if (currentFixation.points!.length >= 5) { // Minimum 5 points for fixation
          const points = currentFixation.points!;
          fixations.push({
            ...currentFixation as Fixation,
            endTime: points[points.length - 1].timestamp,
            duration: points[points.length - 1].timestamp - currentFixation.startTime!,
            dispersion: calculateDispersion(points)
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
    if (currentFixation && currentFixation.points!.length >= 5) {
      const points = currentFixation.points!;
      fixations.push({
        ...currentFixation as Fixation,
        endTime: points[points.length - 1].timestamp,
        duration: points[points.length - 1].timestamp - currentFixation.startTime!,
        dispersion: calculateDispersion(points)
      });
    }

    return fixations;
  };

  // Calculate dispersion of gaze points
  const calculateDispersion = (points: GazePoint[]): number => {
    if (points.length < 2) return 0;

    const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    const variance = points.reduce((sum, p) => {
      return sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2);
    }, 0) / points.length;

    return Math.sqrt(variance);
  };

  // Get processing statistics
  const getStats = (): GazeProcessorStats => ({
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
    setScreenSize: (width: number, height: number) => {
      state.screenWidth = width;
      state.screenHeight = height;
    },
    setSmoothing: (factor: number) => {
      state.smoothingFactor = Math.max(0, Math.min(1, factor));
    },
    setConfidenceThreshold: (threshold: number) => {
      state.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    },
    
    // Utilities
    toScreenCoordinates,
    getScreenRegion,
    generateSemantics
  };
};

/**
 * Gaze processing utilities
 */
export const GazeProcessingUtils = {
  /**
   * Calculate average gaze position over time window
   */
  calculateAverageGaze: (gazePoints: GazePoint[]): GazePoint | null => {
    if (gazePoints.length === 0) return null;
    
    const avgX = gazePoints.reduce((sum, p) => sum + p.x, 0) / gazePoints.length;
    const avgY = gazePoints.reduce((sum, p) => sum + p.y, 0) / gazePoints.length;
    const avgConfidence = gazePoints.reduce((sum, p) => sum + p.confidence, 0) / gazePoints.length;
    const lastTimestamp = gazePoints[gazePoints.length - 1].timestamp;
    
    return {
      x: avgX,
      y: avgY,
      confidence: avgConfidence,
      timestamp: lastTimestamp
    };
  },

  /**
   * Detect saccades (rapid eye movements)
   */
  detectSaccades: (
    gazePoints: GazePoint[], 
    velocityThreshold = 0.3,
    minDuration = 20
  ): Array<{
    startIndex: number;
    endIndex: number;
    duration: number;
    distance: number;
    peakVelocity: number;
  }> => {
    if (gazePoints.length < 3) return [];
    
    const saccades: Array<{
      startIndex: number;
      endIndex: number;
      duration: number;
      distance: number;
      peakVelocity: number;
    }> = [];
    
    let saccadeStart = -1;
    let peakVelocity = 0;
    
    for (let i = 1; i < gazePoints.length; i++) {
      const current = gazePoints[i];
      const previous = gazePoints[i - 1];
      const timeDelta = current.timestamp - previous.timestamp;
      
      if (timeDelta <= 0) continue;
      
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = distance / (timeDelta / 1000);
      
      if (velocity > velocityThreshold) {
        if (saccadeStart === -1) {
          saccadeStart = i - 1;
          peakVelocity = velocity;
        } else {
          peakVelocity = Math.max(peakVelocity, velocity);
        }
      } else if (saccadeStart !== -1) {
        // End of saccade
        const duration = current.timestamp - gazePoints[saccadeStart].timestamp;
        
        if (duration >= minDuration) {
          const startPoint = gazePoints[saccadeStart];
          const endPoint = gazePoints[i - 1];
          const totalDistance = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.y - startPoint.y, 2)
          );
          
          saccades.push({
            startIndex: saccadeStart,
            endIndex: i - 1,
            duration,
            distance: totalDistance,
            peakVelocity
          });
        }
        
        saccadeStart = -1;
        peakVelocity = 0;
      }
    }
    
    return saccades;
  },

  /**
   * Calculate gaze heatmap data
   */
  generateHeatmapData: (
    gazePoints: GazePoint[],
    gridWidth = 32,
    gridHeight = 18
  ): number[][] => {
    const heatmap = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(0));
    
    gazePoints.forEach(point => {
      const gridX = Math.floor(point.x * gridWidth);
      const gridY = Math.floor(point.y * gridHeight);
      
      if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        heatmap[gridY][gridX] += point.confidence;
      }
    });
    
    return heatmap;
  },

  /**
   * Validate gaze processor configuration
   */
  validateConfig: (config: GazeProcessorConfig): boolean => {
    if (config.screenWidth !== undefined && (config.screenWidth <= 0 || !Number.isInteger(config.screenWidth))) {
      return false;
    }
    
    if (config.screenHeight !== undefined && (config.screenHeight <= 0 || !Number.isInteger(config.screenHeight))) {
      return false;
    }
    
    if (config.confidenceThreshold !== undefined && (config.confidenceThreshold < 0 || config.confidenceThreshold > 1)) {
      return false;
    }
    
    if (config.smoothingFactor !== undefined && (config.smoothingFactor < 0 || config.smoothingFactor > 1)) {
      return false;
    }
    
    return true;
  }
};
