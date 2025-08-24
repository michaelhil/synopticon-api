/**
 * Standardized Pipeline Result Types
 * Provides unified result formats across all pipeline types
 * Ensures consistent API surface and data interchange compatibility
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../utils/error-handler.js';

// Standard result status codes
export const ResultStatus = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  UNSUPPORTED: 'unsupported'
};

// Confidence levels for standardized interpretation
export const ConfidenceLevel = {
  VERY_HIGH: { min: 0.9, label: 'Very High' },
  HIGH: { min: 0.7, label: 'High' },
  MEDIUM: { min: 0.5, label: 'Medium' },
  LOW: { min: 0.3, label: 'Low' },
  VERY_LOW: { min: 0.0, label: 'Very Low' }
};

/**
 * Gets confidence level classification
 * @param {number} confidence - Confidence value (0-1)
 * @returns {Object} - Confidence level info
 */
export const getConfidenceLevel = (confidence) => {
  if (confidence >= ConfidenceLevel.VERY_HIGH.min) return ConfidenceLevel.VERY_HIGH;
  if (confidence >= ConfidenceLevel.HIGH.min) return ConfidenceLevel.HIGH;
  if (confidence >= ConfidenceLevel.MEDIUM.min) return ConfidenceLevel.MEDIUM;
  if (confidence >= ConfidenceLevel.LOW.min) return ConfidenceLevel.LOW;
  return ConfidenceLevel.VERY_LOW;
};

/**
 * Base result factory with common properties
 * @param {Object} data - Result data
 * @returns {Object} - Base result structure
 */
export const createBaseResult = (data = {}) => {
  const baseResult = {
    status: data.status || ResultStatus.SUCCESS,
    timestamp: data.timestamp || Date.now(),
    processingTime: data.processingTime || 0,
    confidence: Math.max(0, Math.min(1, data.confidence || 0)),
    source: data.source || 'unknown',
    version: data.version || '1.0.0',
    metadata: data.metadata || {}
  };

  // Add confidence level classification
  baseResult.confidenceLevel = getConfidenceLevel(baseResult.confidence);

  return baseResult;
};

/**
 * Creates standardized face detection/analysis result
 * @param {Object} data - Face analysis data
 * @returns {Object} - Standardized face result
 */
export const createFaceResult = (data = {}) => {
  const base = createBaseResult(data);
  
  return {
    ...base,
    type: 'face',
    faces: data.faces || [],
    totalFaces: data.faces?.length || 0,
    primaryFace: data.faces?.[0] || null,
    
    // Face-specific metrics
    detectionConfidence: data.detectionConfidence || base.confidence,
    trackingQuality: data.trackingQuality || null,
    
    // Processing details
    inputResolution: data.inputResolution || null,
    processedRegions: data.processedRegions || 0,
    
    // Capabilities used
    capabilities: {
      faceDetection: data.capabilities?.faceDetection || false,
      landmarkDetection: data.capabilities?.landmarkDetection || false,
      poseEstimation: data.capabilities?.poseEstimation || false,
      expressionAnalysis: data.capabilities?.expressionAnalysis || false,
      ageEstimation: data.capabilities?.ageEstimation || false,
      genderDetection: data.capabilities?.genderDetection || false,
      eyeTracking: data.capabilities?.eyeTracking || false
    }
  };
};

/**
 * Creates standardized emotion analysis result
 * @param {Object} data - Emotion analysis data
 * @returns {Object} - Standardized emotion result
 */
export const createEmotionResult = (data = {}) => {
  const base = createBaseResult(data);
  
  return {
    ...base,
    type: 'emotion',
    emotions: data.emotions || [],
    primaryEmotion: data.primaryEmotion || null,
    emotionProbabilities: data.emotionProbabilities || {},
    
    // Emotion-specific metrics
    valence: data.valence || null, // Positive/negative emotional value
    arousal: data.arousal || null, // Emotional intensity
    dominance: data.dominance || null, // Sense of control
    
    // Multi-face support
    faceEmotions: data.faceEmotions || [], // Per-face emotion data
    averageEmotion: data.averageEmotion || null,
    
    // Analysis details
    model: data.model || 'unknown',
    emotionLabels: data.emotionLabels || [
      'angry', 'disgusted', 'fearful', 'happy', 'sad', 'surprised', 'neutral'
    ]
  };
};

/**
 * Creates standardized age estimation result
 * @param {Object} data - Age estimation data
 * @returns {Object} - Standardized age result
 */
export const createAgeResult = (data = {}) => {
  const base = createBaseResult(data);
  
  return {
    ...base,
    type: 'age',
    estimatedAge: data.estimatedAge || 0,
    ageRange: data.ageRange || { min: 0, max: 100 },
    ageCategory: data.ageCategory || 'unknown',
    
    // Age-specific confidence
    ageConfidence: data.ageConfidence || base.confidence,
    
    // Multi-face support
    faceAges: data.faceAges || [], // Per-face age data
    averageAge: data.averageAge || null,
    
    // Category mappings
    categories: data.categories || {
      child: [0, 12],
      teen: [13, 19],
      adult: [20, 64],
      senior: [65, 100]
    }
  };
};

/**
 * Creates standardized gender detection result
 * @param {Object} data - Gender detection data
 * @returns {Object} - Standardized gender result
 */
export const createGenderResult = (data = {}) => {
  const base = createBaseResult(data);
  
  return {
    ...base,
    type: 'gender',
    gender: data.gender || 'unknown',
    genderProbabilities: data.genderProbabilities || { male: 0.5, female: 0.5 },
    
    // Gender-specific confidence
    genderConfidence: data.genderConfidence || base.confidence,
    
    // Multi-face support
    faceGenders: data.faceGenders || [], // Per-face gender data
    
    // Additional classifications
    binaryClassification: data.binaryClassification !== false, // True for male/female only
    supportedGenders: data.supportedGenders || ['male', 'female']
  };
};

/**
 * Creates standardized pose estimation result
 * @param {Object} data - Pose estimation data
 * @returns {Object} - Standardized pose result
 */
export const createPoseResult = (data = {}) => {
  const base = createBaseResult(data);
  
  return {
    ...base,
    type: 'pose',
    pose: data.pose || null,
    rotation: data.rotation || { yaw: 0, pitch: 0, roll: 0 },
    translation: data.translation || { x: 0, y: 0, z: 0 },
    
    // 6DOF pose data
    pose6DOF: data.pose6DOF || null,
    transformMatrix: data.transformMatrix || null,
    
    // Multi-face support
    facePoses: data.facePoses || [], // Per-face pose data
    
    // Pose quality metrics
    poseStability: data.poseStability || null,
    trackingLost: data.trackingLost || false,
    
    // Coordinate system
    coordinateSystem: data.coordinateSystem || 'screen', // 'screen', 'world', 'camera'
    units: data.units || 'degrees' // 'degrees', 'radians'
  };
};

/**
 * Creates standardized eye tracking result
 * @param {Object} data - Eye tracking data
 * @returns {Object} - Standardized eye result
 */
export const createEyeResult = (data = {}) => {
  const base = createBaseResult(data);
  
  return {
    ...base,
    type: 'eye',
    leftEye: data.leftEye || null,
    rightEye: data.rightEye || null,
    gazeDirection: data.gazeDirection || null,
    gazePoint: data.gazePoint || null,
    
    // Eye state
    leftEyeOpen: data.leftEyeOpen || null,
    rightEyeOpen: data.rightEyeOpen || null,
    blinkDetected: data.blinkDetected || false,
    
    // Iris tracking
    leftIris: data.leftIris || null,
    rightIris: data.rightIris || null,
    
    // Gaze metrics
    gazeStability: data.gazeStability || null,
    fixationPoint: data.fixationPoint || null,
    saccadeDetected: data.saccadeDetected || false,
    
    // Calibration
    isCalibrated: data.isCalibrated || false,
    calibrationQuality: data.calibrationQuality || null
  };
};

/**
 * Creates standardized landmark detection result
 * @param {Object} data - Landmark detection data
 * @returns {Object} - Standardized landmark result
 */
export const createLandmarkResult = (data = {}) => {
  const base = createBaseResult(data);
  
  return {
    ...base,
    type: 'landmarks',
    landmarks: data.landmarks || [],
    keyPoints: data.keyPoints || {},
    landmarkCount: data.landmarks?.length || 0,
    
    // Landmark types
    faceLandmarks: data.faceLandmarks || [],
    eyeLandmarks: data.eyeLandmarks || [],
    mouthLandmarks: data.mouthLandmarks || [],
    
    // Multi-face support
    faceLandmarkSets: data.faceLandmarkSets || [], // Per-face landmark data
    
    // Quality metrics
    landmarkQuality: data.landmarkQuality || null,
    detectionStability: data.detectionStability || null,
    
    // Coordinate system
    coordinateSystem: data.coordinateSystem || 'normalized', // 'normalized', 'pixel'
    imageResolution: data.imageResolution || null
  };
};

/**
 * Creates comprehensive analysis result combining multiple pipeline outputs
 * @param {Object} data - Analysis data from multiple pipelines
 * @returns {Object} - Standardized comprehensive result
 */
export const createAnalysisResult = (data = {}) => {
  const base = createBaseResult(data);
  
  const result = {
    ...base,
    type: 'analysis',
    
    // Component results
    faces: data.faces || [],
    emotions: data.emotions || [],
    ages: data.ages || [],
    genders: data.genders || [],
    poses: data.poses || [],
    eyes: data.eyes || [],
    landmarks: data.landmarks || [],
    
    // Summary statistics
    totalFaces: data.faces?.length || 0,
    averageConfidence: 0,
    
    // Pipeline information
    pipelinesUsed: data.pipelinesUsed || [],
    processingSequence: data.processingSequence || [],
    
    // Performance metrics
    totalProcessingTime: data.totalProcessingTime || base.processingTime,
    pipelineTimings: data.pipelineTimings || {},
    
    // Input information
    inputFormat: data.inputFormat || 'unknown',
    inputResolution: data.inputResolution || null,
    frameNumber: data.frameNumber || null
  };

  // Calculate average confidence across all results
  const confidenceValues = [];
  
  [result.faces, result.emotions, result.ages, result.genders, result.poses, result.eyes, result.landmarks]
    .forEach(resultArray => {
      if (Array.isArray(resultArray)) {
        resultArray.forEach(item => {
          if (item && typeof item.confidence === 'number') {
            confidenceValues.push(item.confidence);
          }
        });
      }
    });

  if (confidenceValues.length > 0) {
    result.averageConfidence = confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length;
    result.confidenceLevel = getConfidenceLevel(result.averageConfidence);
  }

  return result;
};

/**
 * Creates standardized error result
 * @param {Object} data - Error data
 * @returns {Object} - Standardized error result
 */
export const createErrorResult = (data = {}) => {
  const base = createBaseResult({
    ...data,
    status: ResultStatus.FAILED,
    confidence: 0
  });
  
  return {
    ...base,
    type: 'error',
    error: {
      message: data.message || 'Unknown error occurred',
      code: data.code || 'UNKNOWN_ERROR',
      category: data.category || ErrorCategory.PROCESSING,
      severity: data.severity || ErrorSeverity.ERROR,
      stack: data.stack || null,
      context: data.context || {}
    },
    
    // Recovery information
    recoverable: data.recoverable !== false,
    retryAfter: data.retryAfter || null,
    fallbackAvailable: data.fallbackAvailable || false,
    
    // Partial results if available
    partialResults: data.partialResults || null
  };
};

/**
 * Validates result structure for consistency
 * @param {Object} result - Result to validate
 * @returns {boolean} - True if valid
 */
export const validateResult = (result) => {
  try {
    // Check required base properties
    const requiredProps = ['status', 'timestamp', 'processingTime', 'confidence', 'source'];
    
    for (const prop of requiredProps) {
      if (!result.hasOwnProperty(prop)) {
        handleError(
          `Missing required property: ${prop}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.WARNING,
          { result }
        );
        return false;
      }
    }
    
    // Validate status
    if (!Object.values(ResultStatus).includes(result.status)) {
      handleError(
        `Invalid status: ${result.status}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING,
        { result }
      );
      return false;
    }
    
    // Validate confidence
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      handleError(
        `Invalid confidence value: ${result.confidence}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING,
        { result }
      );
      return false;
    }
    
    // Validate timestamp
    if (typeof result.timestamp !== 'number' || result.timestamp <= 0) {
      handleError(
        `Invalid timestamp: ${result.timestamp}`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING,
        { result }
      );
      return false;
    }
    
    return true;
  } catch (error) {
    handleError(
      `Result validation failed: ${error.message}`,
      ErrorCategory.VALIDATION,
      ErrorSeverity.ERROR,
      { result }
    );
    return false;
  }
};

/**
 * Merges multiple results into a single comprehensive result
 * @param {Array} results - Array of results to merge
 * @param {Object} options - Merge options
 * @returns {Object} - Merged result
 */
export const mergeResults = (results, options = {}) => {
  if (!Array.isArray(results) || results.length === 0) {
    return createErrorResult({ message: 'No results to merge' });
  }

  try {
    const mergeOptions = {
      preserveIndividualResults: options.preserveIndividualResults !== false,
      calculateAverages: options.calculateAverages !== false,
      includeTimings: options.includeTimings !== false,
      ...options
    };

    const merged = {
      status: ResultStatus.SUCCESS,
      timestamp: Date.now(),
      processingTime: 0,
      confidence: 0,
      source: 'merged',
      type: 'merged',
      
      // Merged data
      faces: [],
      emotions: [],
      ages: [],
      genders: [],
      poses: [],
      eyes: [],
      landmarks: [],
      
      // Metadata
      mergedResults: mergeOptions.preserveIndividualResults ? results : [],
      resultCount: results.length,
      resultTypes: [],
      
      // Performance
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };

    // Process each result
    results.forEach(result => {
      if (!result) return;

      // Accumulate processing time
      merged.totalProcessingTime += result.processingTime || 0;

      // Collect result types
      if (result.type && !merged.resultTypes.includes(result.type)) {
        merged.resultTypes.push(result.type);
      }

      // Merge type-specific data
      switch (result.type) {
        case 'face':
          if (result.faces) merged.faces.push(...result.faces);
          break;
        case 'emotion':
          if (result.emotions) merged.emotions.push(...result.emotions);
          break;
        case 'age':
          if (result.ages) merged.ages.push(...result.ages);
          break;
        case 'gender':
          if (result.genders) merged.genders.push(...result.genders);
          break;
        case 'pose':
          if (result.poses) merged.poses.push(...result.poses);
          break;
        case 'eye':
          if (result.eyes) merged.eyes.push(...result.eyes);
          break;
        case 'landmarks':
          if (result.landmarks) merged.landmarks.push(...result.landmarks);
          break;
        case 'analysis':
          // Merge comprehensive analysis results
          ['faces', 'emotions', 'ages', 'genders', 'poses', 'eyes', 'landmarks'].forEach(key => {
            if (result[key]) merged[key].push(...result[key]);
          });
          break;
      }
    });

    // Calculate averages and summaries
    if (mergeOptions.calculateAverages) {
      const confidences = results
        .filter(r => r && typeof r.confidence === 'number')
        .map(r => r.confidence);
      
      if (confidences.length > 0) {
        merged.confidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
      }
      
      merged.averageProcessingTime = merged.totalProcessingTime / results.length;
    }

    // Set final timestamp and processing time
    merged.processingTime = merged.totalProcessingTime;
    merged.confidenceLevel = getConfidenceLevel(merged.confidence);

    return merged;

  } catch (error) {
    return createErrorResult({
      message: `Result merging failed: ${error.message}`,
      context: { resultCount: results.length }
    });
  }
};

/**
 * Converts result to a specific format
 * @param {Object} result - Result to convert
 * @param {string} format - Target format ('json', 'csv', 'summary')
 * @returns {string|Object} - Converted result
 */
export const convertResult = (result, format = 'json') => {
  if (!result) return null;

  try {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(result, null, 2);
        
      case 'summary':
        return {
          type: result.type,
          status: result.status,
          confidence: `${(result.confidence * 100).toFixed(1)}%`,
          confidenceLevel: result.confidenceLevel?.label || 'Unknown',
          processingTime: `${result.processingTime.toFixed(2)}ms`,
          timestamp: new Date(result.timestamp).toISOString(),
          dataPoints: result.faces?.length || result.emotions?.length || 0
        };
        
      case 'csv':
        const csvData = [
          result.timestamp,
          result.type,
          result.status,
          result.confidence.toFixed(3),
          result.processingTime.toFixed(2),
          result.faces?.length || 0,
          result.source
        ];
        return csvData.join(',');
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    handleError(
      `Result conversion failed: ${error.message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING,
      { format, resultType: result?.type }
    );
    return null;
  }
};

// Export all result factories and utilities
export default {
  createBaseResult,
  createFaceResult,
  createEmotionResult,
  createAgeResult,
  createGenderResult,
  createPoseResult,
  createEyeResult,
  createLandmarkResult,
  createAnalysisResult,
  createErrorResult,
  validateResult,
  mergeResults,
  convertResult,
  ResultStatus,
  ConfidenceLevel,
  getConfidenceLevel
};