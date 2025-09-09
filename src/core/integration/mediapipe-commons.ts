/**
 * @fileoverview MediaPipe Commons Module
 * 
 * Shared utilities, landmarks, and configurations for MediaPipe-based pipelines.
 * Eliminates code duplication across MediaPipe Face Mesh, Face Detection, and Iris Tracking.
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import { ErrorCategory, ErrorSeverity, handleError } from '../../shared/utils/error-handler.js'

/**
 * MediaPipe landmark point structure
 */
export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

/**
 * Eye landmark structure
 */
export interface EyeLandmarks {
  outline: number[];
  upper: number[];
  lower: number[];
  inner_corner: number;
  outer_corner: number;
  center: number;
  top: number;
  bottom: number;
}

/**
 * Face bounding box
 */
export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  center: {
    x: number;
    y: number;
  };
}

/**
 * Key facial points for pose estimation
 */
export interface KeyFacialPoints {
  noseTip: LandmarkPoint;
  chinBottom: LandmarkPoint;
  leftEyeOuter: LandmarkPoint;
  rightEyeOuter: LandmarkPoint;
  leftMouthCorner: LandmarkPoint;
  rightMouthCorner: LandmarkPoint;
  foreheadCenter: LandmarkPoint;
  leftCheek: LandmarkPoint;
  rightCheek: LandmarkPoint;
}

/**
 * Iris landmark data
 */
export interface IrisLandmarks {
  leftIris: {
    center: LandmarkPoint;
    boundary: LandmarkPoint[];
  };
  rightIris: {
    center: LandmarkPoint;
    boundary: LandmarkPoint[];
  };
}

/**
 * Face detection result
 */
export interface FaceData {
  id: number;
  landmarks: LandmarkPoint[];
  keyPoints: KeyFacialPoints | null;
  boundingBox: FaceBoundingBox | null;
  confidence: number;
  iris?: IrisLandmarks | null;
  leftEyeAspectRatio?: number;
  rightEyeAspectRatio?: number;
}

/**
 * MediaPipe processing results
 */
export interface MediaPipeResults {
  faces: FaceData[];
  timestamp: number;
  processingTime: number;
}

/**
 * MediaPipe model configuration
 */
export interface MediaPipeConfig {
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  selfieMode?: boolean;
  staticImageMode?: boolean;
  enablePerformanceOptimizations?: boolean;
  refineLandmarks?: boolean;
}

/**
 * MediaPipe availability status
 */
export interface MediaPipeAvailability {
  FaceMesh: boolean;
  FaceDetection: boolean;
  Iris: boolean;
  Camera: boolean;
  overall: boolean;
}

/**
 * Camera calibration parameters
 */
export interface CameraMatrix {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  distortion: number[];
}

/**
 * 3D canonical face model
 */
export interface CanonicalFaceModel {
  points: number[][];
  indices: number[];
}

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
} as const;

// Iris-specific landmark indices (when iris model is enabled)
export const IRIS_LANDMARKS = {
  LEFT_IRIS: [468, 469, 470, 471, 472],      // Center + 4 boundary points
  RIGHT_IRIS: [473, 474, 475, 476, 477],     // Center + 4 boundary points
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473
} as const;

// 3D canonical face model for pose estimation (in millimeters)
export const CANONICAL_FACE_MODEL_3D: CanonicalFaceModel = {
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
export const DEFAULT_CAMERA_MATRIX: CameraMatrix = {
  fx: 1.0,    // Focal length X (normalized)
  fy: 1.0,    // Focal length Y (normalized) 
  cx: 0.5,    // Principal point X (normalized)
  cy: 0.5,    // Principal point Y (normalized)
  distortion: [0, 0, 0, 0, 0] // Distortion coefficients
};

/**
 * Creates MediaPipe base configuration with common settings
 */
export const createMediaPipeBase = (specificConfig: Partial<MediaPipeConfig> = {}): MediaPipeConfig => {
  const baseMediaPipeConfig: MediaPipeConfig = {
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
 */
export const checkMediaPipeAvailability = (): MediaPipeAvailability => {
  const availability: MediaPipeAvailability = {
    FaceMesh: typeof window !== 'undefined' && Boolean((window as any).FaceMesh),
    FaceDetection: typeof window !== 'undefined' && Boolean((window as any).FaceDetection),
    Iris: typeof window !== 'undefined' && Boolean((window as any).Iris),
    Camera: typeof window !== 'undefined' && Boolean((window as any).Camera),
    overall: false
  };
  
  availability.overall = availability.FaceMesh || availability.FaceDetection || availability.Iris;
  
  return availability;
};

/**
 * Extracts key facial points from MediaPipe landmarks for pose estimation
 */
export const extractKeyPoints = (landmarks: LandmarkPoint[]): KeyFacialPoints | null => {
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
      `Failed to extract key points: ${(error as Error).message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING,
      { landmarkCount: landmarks.length }
    );
    return null;
  }
};

/**
 * Calculates eye aspect ratio (EAR) for blink detection
 */
export const calculateEyeAspectRatio = (eyeLandmarks: any): number => {
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
      `Failed to calculate eye aspect ratio: ${(error as Error).message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING
    );
    return 0;
  }
};

/**
 * Extracts iris landmarks when iris model is available
 */
export const extractIrisLandmarks = (landmarks: LandmarkPoint[]): IrisLandmarks | null => {
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
      `Failed to extract iris landmarks: ${(error as Error).message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING,
      { landmarkCount: landmarks.length }
    );
    return null;
  }
};

/**
 * Normalizes landmarks to a 0-1 coordinate system
 */
export const normalizeLandmarks = (landmarks: LandmarkPoint[], width: number, height: number): LandmarkPoint[] => {
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
 */
export const calculateFaceBoundingBox = (landmarks: LandmarkPoint[]): FaceBoundingBox | null => {
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
      `Failed to calculate bounding box: ${(error as Error).message}`,
      ErrorCategory.PROCESSING,
      ErrorSeverity.WARNING
    );
    return null;
  }
};

/**
 * Creates a shared MediaPipe result processor
 */
export const createMediaPipeProcessor = (pipelineType: string) => {
  const processResults = (results: any, imageWidth: number, imageHeight: number): MediaPipeResults => {
    if (!results || !results.multiFaceLandmarks) {
      return {
        faces: [],
        timestamp: Date.now(),
        processingTime: 0
      };
    }
    
    const faces: FaceData[] = results.multiFaceLandmarks.map((landmarks: LandmarkPoint[], index: number) => {
      const normalizedLandmarks = normalizeLandmarks(landmarks, imageWidth, imageHeight);
      const boundingBox = calculateFaceBoundingBox(normalizedLandmarks);
      const keyPoints = extractKeyPoints(landmarks);
      
      const faceData: FaceData = {
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
 */
const extractEyeLandmarks = (landmarks: LandmarkPoint[], eye: string) => {
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
 */
export const createMediaPipeLoader = () => {
  const loadModel = async (modelType: string, config: Partial<MediaPipeConfig> = {}): Promise<any> => {
    try {
      const availability = checkMediaPipeAvailability();
      
      if (!(availability as any)[modelType]) {
        throw new Error(`MediaPipe ${modelType} not available`);
      }
      
      let model: any;
      switch (modelType) {
      case 'FaceMesh':
        model = new (window as any).FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        break;
          
      case 'FaceDetection':
        model = new (window as any).FaceDetection({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
        });
        break;
          
      case 'Iris':
        model = new (window as any).Iris({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/iris/${file}`
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
        `Failed to load MediaPipe model ${modelType}: ${(error as Error).message}`,
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
