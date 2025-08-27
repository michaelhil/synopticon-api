/**
 * MediaPipe Commons Module
 * Shared utilities, landmarks, and configurations for MediaPipe-based pipelines
 * Eliminates code duplication across MediaPipe Face Mesh, Face Detection, and Iris Tracking
 */

import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';

// Shared MediaPipe landmark definitions
export const MEDIAPIPE_LANDMARKS = {
  // Core facial landmarks (shared across all MediaPipe models)
  FACE_OUTLINE: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
    377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103,
    67, 109
  ],
  
  // Eye landmarks (common to face mesh and iris tracking)
  LEFT_EYE: {
    outline: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    upper: [246, 161, 160, 159, 158, 157, 173],
    lower: [33, 7, 163, 144, 145, 153, 154, 155, 133],
    inner_corner: 133,
    outer_corner: 33,
    center: 468, // Iris center when available
    top: 159,
    bottom: 145
  },
  
  RIGHT_EYE: {
    outline: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    upper: [398, 384, 385, 386, 387, 388, 466],
    lower: [362, 382, 381, 380, 374, 373, 390, 249, 263],
    inner_corner: 362,
    outer_corner: 263,
    center: 473, // Iris center when available
    top: 386,
    bottom: 374
  },
  
  // Nose landmarks
  NOSE: {
    tip: 1,
    bridge: 9,
    left_ala: 31,
    right_ala: 261,
    left_nostril: 20,
    right_nostril: 250
  },
  
  // Mouth landmarks
  MOUTH: {
    outer_lip: [61, 146, 91, 181, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318],
    inner_lip: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 325, 319, 325, 319],
    left_corner: 61,
    right_corner: 291,
    top: 13,
    bottom: 14
  },
  
  // Eyebrow landmarks
  LEFT_EYEBROW: [46, 53, 52, 51, 48],
  RIGHT_EYEBROW: [276, 283, 282, 295, 285],
  
  // Cheek landmarks
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  
  // Chin landmarks
  CHIN: 175,
  
  // Forehead landmarks
  FOREHEAD_CENTER: 9
};

// Iris-specific landmark indices (when iris model is enabled)
export const IRIS_LANDMARKS = {
  LEFT_IRIS: [468, 469, 470, 471, 472],      // Center + 4 boundary points
  RIGHT_IRIS: [473, 474, 475, 476, 477],     // Center + 4 boundary points
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473
};

// 3D canonical face model for pose estimation (in millimeters)
export const CANONICAL_FACE_MODEL_3D = {
  // Primary points for PnP pose estimation
  points: [
    [0.0, 0.0, 0.0],           // Nose tip (reference point)
    [0.0, -58.0, -14.0],       // Chin bottom
    [-35.0, 20.0, -15.0],      // Left eye outer corner
    [35.0, 20.0, -15.0],       // Right eye outer corner
    [-20.0, -25.0, -8.0],      // Left mouth corner
    [20.0, -25.0, -8.0],       // Right mouth corner
    [0.0, 45.0, -10.0],        // Forehead center
    [-30.0, -10.0, -20.0],     // Left cheek
    [30.0, -10.0, -20.0]       // Right cheek
  ],
  
  // Corresponding 2D landmark indices
  indices: [
    MEDIAPIPE_LANDMARKS.NOSE.tip,           // 1
    MEDIAPIPE_LANDMARKS.CHIN,               // 175
    MEDIAPIPE_LANDMARKS.LEFT_EYE.outer_corner,  // 33
    MEDIAPIPE_LANDMARKS.RIGHT_EYE.outer_corner, // 263
    MEDIAPIPE_LANDMARKS.MOUTH.left_corner,  // 61
    MEDIAPIPE_LANDMARKS.MOUTH.right_corner, // 291
    MEDIAPIPE_LANDMARKS.FOREHEAD_CENTER,    // 9
    MEDIAPIPE_LANDMARKS.LEFT_CHEEK,         // 234
    MEDIAPIPE_LANDMARKS.RIGHT_CHEEK         // 454
  ]
};

// Camera calibration matrix (typical webcam parameters)
export const DEFAULT_CAMERA_MATRIX = {
  fx: 1.0,    // Focal length X (normalized)
  fy: 1.0,    // Focal length Y (normalized) 
  cx: 0.5,    // Principal point X (normalized)
  cy: 0.5,    // Principal point Y (normalized)
  distortion: [0, 0, 0, 0, 0] // Distortion coefficients
};

/**
 * Creates MediaPipe base configuration with common settings
 * @param {Object} specificConfig - Pipeline-specific configuration overrides
 * @returns {Object} - Complete MediaPipe configuration
 */
export const createMediaPipeBase = (specificConfig = {}) => {
  const baseMediaPipeConfig = {
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: false,
    staticImageMode: false,
    enablePerformanceOptimizations: true
  };
  
  return { ...baseMediaPipeConfig, ...specificConfig };
};

/**
 * Checks if MediaPipe dependencies are available
 * @returns {Object} - Availability status for each MediaPipe model
 */
export const checkMediaPipeAvailability = () => {
  const availability = {
    FaceMesh: typeof window !== 'undefined' && !!window.FaceMesh,
    FaceDetection: typeof window !== 'undefined' && !!window.FaceDetection,
    Iris: typeof window !== 'undefined' && !!window.Iris,
    Camera: typeof window !== 'undefined' && !!window.Camera,
    overall: false
  };
  
  availability.overall = availability.FaceMesh || availability.FaceDetection || availability.Iris;
  
  return availability;
};

/**
 * Extracts key facial points from MediaPipe landmarks for pose estimation
 * @param {Array} landmarks - MediaPipe face landmarks
 * @returns {Object} - Key facial points with 2D coordinates
 */
export const extractKeyPoints = (landmarks) => {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }
  
  try {
    return {
      noseTip: landmarks[MEDIAPIPE_LANDMARKS.NOSE.tip],
      chinBottom: landmarks[MEDIAPIPE_LANDMARKS.CHIN],
      leftEyeOuter: landmarks[MEDIAPIPE_LANDMARKS.LEFT_EYE.outer_corner],
      rightEyeOuter: landmarks[MEDIAPIPE_LANDMARKS.RIGHT_EYE.outer_corner],
      leftMouthCorner: landmarks[MEDIAPIPE_LANDMARKS.MOUTH.left_corner],
      rightMouthCorner: landmarks[MEDIAPIPE_LANDMARKS.MOUTH.right_corner],
      foreheadCenter: landmarks[MEDIAPIPE_LANDMARKS.FOREHEAD_CENTER],
      leftCheek: landmarks[MEDIAPIPE_LANDMARKS.LEFT_CHEEK],
      rightCheek: landmarks[MEDIAPIPE_LANDMARKS.RIGHT_CHEEK]
    };
  } catch (error) {
    handleError(
      `Failed to extract key points: ${error.message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING,
      { landmarkCount: landmarks.length }
    );
    return null;
  }
};

/**
 * Calculates eye aspect ratio (EAR) for blink detection
 * @param {Object} eyeLandmarks - Eye landmark coordinates
 * @returns {number} - Eye aspect ratio
 */
export const calculateEyeAspectRatio = (eyeLandmarks) => {
  if (!eyeLandmarks || !eyeLandmarks.upper || !eyeLandmarks.lower) {
    return 0;
  }
  
  try {
    // Calculate vertical distances
    const verticalDistance1 = Math.sqrt(
      Math.pow(eyeLandmarks.upper[2].x - eyeLandmarks.lower[2].x, 2) +
      Math.pow(eyeLandmarks.upper[2].y - eyeLandmarks.lower[2].y, 2)
    );
    
    const verticalDistance2 = Math.sqrt(
      Math.pow(eyeLandmarks.upper[4].x - eyeLandmarks.lower[4].x, 2) +
      Math.pow(eyeLandmarks.upper[4].y - eyeLandmarks.lower[4].y, 2)
    );
    
    // Calculate horizontal distance
    const horizontalDistance = Math.sqrt(
      Math.pow(eyeLandmarks.outer_corner.x - eyeLandmarks.inner_corner.x, 2) +
      Math.pow(eyeLandmarks.outer_corner.y - eyeLandmarks.inner_corner.y, 2)
    );
    
    // Calculate EAR
    const ear = (verticalDistance1 + verticalDistance2) / (2.0 * horizontalDistance);
    return ear;
  } catch (error) {
    handleError(
      `Failed to calculate eye aspect ratio: ${error.message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING
    );
    return 0;
  }
};

/**
 * Extracts iris landmarks when iris model is available
 * @param {Array} landmarks - All MediaPipe landmarks including iris
 * @returns {Object} - Iris-specific landmarks
 */
export const extractIrisLandmarks = (landmarks) => {
  if (!landmarks || landmarks.length < 478) { // Standard + iris landmarks
    return null;
  }
  
  try {
    return {
      leftIris: {
        center: landmarks[IRIS_LANDMARKS.LEFT_IRIS_CENTER],
        boundary: IRIS_LANDMARKS.LEFT_IRIS.slice(1).map(idx => landmarks[idx])
      },
      rightIris: {
        center: landmarks[IRIS_LANDMARKS.RIGHT_IRIS_CENTER],
        boundary: IRIS_LANDMARKS.RIGHT_IRIS.slice(1).map(idx => landmarks[idx])
      }
    };
  } catch (error) {
    handleError(
      `Failed to extract iris landmarks: ${error.message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING,
      { landmarkCount: landmarks.length }
    );
    return null;
  }
};

/**
 * Normalizes landmarks to a 0-1 coordinate system
 * @param {Array} landmarks - Raw landmarks
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} - Normalized landmarks
 */
export const normalizeLandmarks = (landmarks, width, height) => {
  if (!landmarks || landmarks.length === 0) {
    return [];
  }
  
  return landmarks.map(landmark => ({
    x: landmark.x / width,
    y: landmark.y / height,
    z: landmark.z || 0 // Z coordinate if available
  }));
};

/**
 * Calculates face bounding box from landmarks
 * @param {Array} landmarks - Face landmarks
 * @returns {Object} - Bounding box coordinates
 */
export const calculateFaceBoundingBox = (landmarks) => {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }
  
  try {
    const xs = landmarks.map(p => p.x);
    const ys = landmarks.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
      }
    };
  } catch (error) {
    handleError(
      `Failed to calculate bounding box: ${error.message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING
    );
    return null;
  }
};

/**
 * Creates a shared MediaPipe result processor
 * @param {string} pipelineType - Type of pipeline ('face-mesh', 'face-detection', 'iris')
 * @returns {Object} - Result processing functions
 */
export const createMediaPipeProcessor = (pipelineType) => {
  const processResults = (results, imageWidth, imageHeight) => {
    if (!results || !results.multiFaceLandmarks) {
      return {
        faces: [],
        timestamp: Date.now(),
        processingTime: 0
      };
    }
    
    const faces = results.multiFaceLandmarks.map((landmarks, index) => {
      const normalizedLandmarks = normalizeLandmarks(landmarks, imageWidth, imageHeight);
      const boundingBox = calculateFaceBoundingBox(normalizedLandmarks);
      const keyPoints = extractKeyPoints(landmarks);
      
      const faceData = {
        id: index,
        landmarks: normalizedLandmarks,
        keyPoints,
        boundingBox,
        confidence: results.faceDetections?.[index]?.confidence || 0.8
      };
      
      // Add pipeline-specific data
      if (pipelineType === 'iris' && landmarks.length >= 478) {
        faceData.iris = extractIrisLandmarks(landmarks);
        faceData.leftEyeAspectRatio = calculateEyeAspectRatio(
          extractEyeLandmarks(landmarks, 'left')
        );
        faceData.rightEyeAspectRatio = calculateEyeAspectRatio(
          extractEyeLandmarks(landmarks, 'right')
        );
      }
      
      return faceData;
    });
    
    return {
      faces,
      timestamp: Date.now(),
      processingTime: 0 // Will be set by caller
    };
  };
  
  return { processResults };
};

/**
 * Extracts eye-specific landmarks
 * @param {Array} landmarks - All face landmarks
 * @param {string} eye - 'left' or 'right'
 * @returns {Object} - Eye landmark data
 */
const extractEyeLandmarks = (landmarks, eye) => {
  const eyeData = eye === 'left' ? MEDIAPIPE_LANDMARKS.LEFT_EYE : MEDIAPIPE_LANDMARKS.RIGHT_EYE;
  
  return {
    outline: eyeData.outline.map(idx => landmarks[idx]),
    upper: eyeData.upper.map(idx => landmarks[idx]),
    lower: eyeData.lower.map(idx => landmarks[idx]),
    inner_corner: landmarks[eyeData.inner_corner],
    outer_corner: landmarks[eyeData.outer_corner],
    center: landmarks[eyeData.center],
    top: landmarks[eyeData.top],
    bottom: landmarks[eyeData.bottom]
  };
};

/**
 * Creates MediaPipe loading utilities with error handling
 * @returns {Object} - Loading utilities
 */
export const createMediaPipeLoader = () => {
  const loadModel = async (modelType, config = {}) => {
    try {
      const availability = checkMediaPipeAvailability();
      
      if (!availability[modelType]) {
        throw new Error(`MediaPipe ${modelType} not available`);
      }
      
      let model;
      switch (modelType) {
        case 'FaceMesh':
          model = new window.FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
          });
          break;
          
        case 'FaceDetection':
          model = new window.FaceDetection({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
          });
          break;
          
        case 'Iris':
          model = new window.Iris({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/iris/${file}`
          });
          break;
          
        default:
          throw new Error(`Unknown MediaPipe model type: ${modelType}`);
      }
      
      // Apply configuration
      if (config.minDetectionConfidence !== undefined) {
        model.setOptions({ minDetectionConfidence: config.minDetectionConfidence });
      }
      if (config.minTrackingConfidence !== undefined) {
        model.setOptions({ minTrackingConfidence: config.minTrackingConfidence });
      }
      if (config.refineLandmarks !== undefined) {
        model.setOptions({ refineLandmarks: config.refineLandmarks });
      }
      
      return model;
    } catch (error) {
      handleError(
        `Failed to load MediaPipe model ${modelType}: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR,
        { modelType, config }
      );
      throw error;
    }
  };
  
  return { loadModel };
};

// Export all constants and utilities
export default {
  MEDIAPIPE_LANDMARKS,
  IRIS_LANDMARKS,
  CANONICAL_FACE_MODEL_3D,
  DEFAULT_CAMERA_MATRIX,
  createMediaPipeBase,
  checkMediaPipeAvailability,
  extractKeyPoints,
  calculateEyeAspectRatio,
  extractIrisLandmarks,
  normalizeLandmarks,
  calculateFaceBoundingBox,
  createMediaPipeProcessor,
  createMediaPipeLoader
};