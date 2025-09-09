/**
 * MediaPipe Iris Tracking Pipeline
 * Specialized pipeline for high-precision eye tracking and gaze estimation
 */

import { createPipeline } from '../../../../core/pipeline/pipeline.js';
import { createPipelineConfig } from '../../../../core/pipeline/pipeline-config.ts';
import { createImageProcessor } from '../../../../core/engine/image-processor.js';
import { getGlobalResourcePool } from '../../../../core/performance/resource-pool.ts';
import { 
  IRIS_LANDMARKS as SHARED_IRIS_LANDMARKS,
  calculateEyeAspectRatio,
  checkMediaPipeAvailability,
  createMediaPipeBase,
  createMediaPipeLoader,
  extractIrisLandmarks
} from '../../../../core/integration/mediapipe-commons.js';
import { 
  Capability,
  createAnalysisResult,
  createEyeResult,
  createPerformanceProfile
} from '../../../../core/configuration/types.js';
import { ErrorCategory, ErrorSeverity, handleError } from "../../../../shared/utils/error-handler.ts";

// Use shared iris landmarks from MediaPipe commons
const IRIS_LANDMARKS = SHARED_IRIS_LANDMARKS;

// Extended iris landmark definitions
const EXTENDED_IRIS_LANDMARKS = {
  // Inherit from shared landmarks
  ...SHARED_IRIS_LANDMARKS,
  
  // Eye contour landmarks
  leftEyeContour: [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246
  ],
  rightEyeContour: [
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
  ],
  
  // Key reference points
  leftEyeInner: 133,      // Inner corner
  leftEyeOuter: 33,       // Outer corner
  rightEyeInner: 362,     // Inner corner
  rightEyeOuter: 263,     // Outer corner
  
  // Eyelid landmarks for openness calculation
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeTop: 386,
  rightEyeBottom: 374
};

// 3D eye model for gaze vector calculation (approximate)
const EYE_3D_MODEL = {
  eyeballRadius: 12.0,    // mm
  irisRadius: 5.9,        // mm
  pupilRadius: 2.0,       // mm
  eyeDepth: 4.0,          // mm from surface to center
  interPupillaryDistance: 63.0, // mm (average IPD)
  
  // 3D positions relative to face center
  leftEyePosition: [-31.5, 20.0, -15.0],    // mm
  rightEyePosition: [31.5, 20.0, -15.0]     // mm
};

// Gaze estimation using 3D eye model
const estimateGazeVector = (irisCenter, eyeCorners, eyePosition, eyeModel = EYE_3D_MODEL) => {
  try {
    if (!irisCenter || !eyeCorners || eyeCorners.length < 2) {
      return [0, 0, -1]; // Default forward gaze
    }
    
    // Calculate eye coordinate system
    const [innerCorner, outerCorner] = eyeCorners;
    
    // Eye width and height for normalization
    const eyeWidth = Math.abs(outerCorner.x - innerCorner.x);
    const eyeHeight = eyeWidth * 0.6; // Approximate eye aspect ratio
    
    if (eyeWidth < 0.001) {
      return [0, 0, -1];
    }
    
    // Normalize iris position relative to eye corners
    const eyeCenter = {
      x: (innerCorner.x + outerCorner.x) / 2,
      y: (innerCorner.y + outerCorner.y) / 2
    };
    
    // Calculate iris displacement from eye center
    const irisDisplacementX = (irisCenter.x - eyeCenter.x) / eyeWidth;
    const irisDisplacementY = (irisCenter.y - eyeCenter.y) / eyeHeight;
    
    // Convert 2D iris displacement to 3D gaze vector
    // This is a simplified model - more sophisticated approaches use corneal reflection
    const maxGazeAngle = Math.PI / 6; // 30 degrees maximum
    
    const gazeX = irisDisplacementX * Math.sin(maxGazeAngle);
    const gazeY = -irisDisplacementY * Math.sin(maxGazeAngle); // Negative for screen coordinates
    const gazeZ = -Math.cos(Math.abs(gazeX) + Math.abs(gazeY)); // Forward component
    
    // Normalize gaze vector
    const magnitude = Math.sqrt(gazeX * gazeX + gazeY * gazeY + gazeZ * gazeZ);
    
    return [
      gazeX / magnitude,
      gazeY / magnitude,
      gazeZ / magnitude
    ];
    
  } catch (error) {
    console.warn('Gaze estimation failed:', error);
    return [0, 0, -1];
  }
};

// Calculate eye openness from eyelid landmarks
const calculateEyeOpenness = (topLandmark, bottomLandmark, eyeWidth) => {
  try {
    if (!topLandmark || !bottomLandmark || eyeWidth <= 0) {
      return 1.0; // Default to open
    }
    
    const eyeHeight = Math.abs(topLandmark.y - bottomLandmark.y);
    const openness = eyeHeight / (eyeWidth * 0.3); // Normal eye height ratio
    
    return Math.max(0, Math.min(1, openness));
  } catch (error) {
    return 1.0;
  }
};

// Extract detailed eye information from MediaPipe Iris results
const extractEyeTracking = (results, config) => {
  if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    return createEyeResult({ confidence: 0 });
  }

  try {
    const landmarks = results.multiFaceLandmarks[0]; // Single face mode
    
    // Extract iris landmarks
    const leftIrisLandmarks = IRIS_LANDMARKS.leftIris.map(idx => 
      idx < landmarks.length ? landmarks[idx] : null
    ).filter(Boolean);
    
    const rightIrisLandmarks = IRIS_LANDMARKS.rightIris.map(idx => 
      idx < landmarks.length ? landmarks[idx] : null
    ).filter(Boolean);
    
    // Get eye contours
    const leftEyeContour = IRIS_LANDMARKS.leftEyeContour.map(idx =>
      idx < landmarks.length ? [landmarks[idx].x, landmarks[idx].y] : null
    ).filter(Boolean);
    
    const rightEyeContour = IRIS_LANDMARKS.rightEyeContour.map(idx =>
      idx < landmarks.length ? [landmarks[idx].x, landmarks[idx].y] : null
    ).filter(Boolean);
    
    // Get key reference points
    const leftEyeCenter = landmarks[IRIS_LANDMARKS.leftEyeCenter] || { x: 0, y: 0, z: 0 };
    const rightEyeCenter = landmarks[IRIS_LANDMARKS.rightEyeCenter] || { x: 0, y: 0, z: 0 };
    
    const leftEyeInner = landmarks[IRIS_LANDMARKS.leftEyeInner] || { x: 0, y: 0 };
    const leftEyeOuter = landmarks[IRIS_LANDMARKS.leftEyeOuter] || { x: 0, y: 0 };
    const rightEyeInner = landmarks[IRIS_LANDMARKS.rightEyeInner] || { x: 0, y: 0 };
    const rightEyeOuter = landmarks[IRIS_LANDMARKS.rightEyeOuter] || { x: 0, y: 0 };
    
    // Calculate eye dimensions
    const leftEyeWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);
    const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);
    
    // Calculate eye openness
    const leftEyeTop = landmarks[IRIS_LANDMARKS.leftEyeTop] || { x: 0, y: 0 };
    const leftEyeBottom = landmarks[IRIS_LANDMARKS.leftEyeBottom] || { x: 0, y: 0 };
    const rightEyeTop = landmarks[IRIS_LANDMARKS.rightEyeTop] || { x: 0, y: 0 };
    const rightEyeBottom = landmarks[IRIS_LANDMARKS.rightEyeBottom] || { x: 0, y: 0 };
    
    const leftOpenness = calculateEyeOpenness(leftEyeTop, leftEyeBottom, leftEyeWidth);
    const rightOpenness = calculateEyeOpenness(rightEyeTop, rightEyeBottom, rightEyeWidth);
    
    // Estimate gaze vectors
    let leftGaze = [0, 0, -1];
    let rightGaze = [0, 0, -1];
    
    if (config.enableGazeEstimation) {
      leftGaze = estimateGazeVector(
        leftEyeCenter,
        [leftEyeInner, leftEyeOuter],
        EYE_3D_MODEL.leftEyePosition
      );
      
      rightGaze = estimateGazeVector(
        rightEyeCenter,
        [rightEyeInner, rightEyeOuter],
        EYE_3D_MODEL.rightEyePosition
      );
    }
    
    // Calculate convergence point (basic implementation)
    const convergenceDistance = 600; // mm (approximate screen distance)
    const convergencePoint = [
      (leftEyeCenter.x + rightEyeCenter.x) / 2,
      (leftEyeCenter.y + rightEyeCenter.y) / 2,
      convergenceDistance
    ];
    
    // Calculate combined gaze direction
    const gazeDirection = [
      (leftGaze[0] + rightGaze[0]) / 2,
      (leftGaze[1] + rightGaze[1]) / 2,
      (leftGaze[2] + rightGaze[2]) / 2
    ];
    
    return createEyeResult({
      left: {
        center: [leftEyeCenter.x, leftEyeCenter.y],
        pupil: [leftEyeCenter.x, leftEyeCenter.y], // Iris center as pupil approximation
        landmarks: leftEyeContour,
        gazeVector: leftGaze,
        openness: leftOpenness
      },
      right: {
        center: [rightEyeCenter.x, rightEyeCenter.y],
        pupil: [rightEyeCenter.x, rightEyeCenter.y],
        landmarks: rightEyeContour,
        gazeVector: rightGaze,
        openness: rightOpenness
      },
      convergencePoint,
      gazeDirection,
      metadata: {
        irisLandmarksDetected: leftIrisLandmarks.length + rightIrisLandmarks.length,
        averageOpenness: (leftOpenness + rightOpenness) / 2,
        eyeDistance: Math.abs(leftEyeCenter.x - rightEyeCenter.x)
      }
    });

  } catch (error) {
    console.warn('Iris eye tracking extraction failed:', error);
    return createEyeResult({ confidence: 0 });
  }
};

// Gaze point estimation on screen
export const estimateScreenGazePoint = (eyeResult, screenDimensions, cameraPosition = { x: 0.5, y: 0.5 }) => {
  try {
    if (!eyeResult || !eyeResult.gazeDirection) {
      return null;
    }
    
    const [gazeX, gazeY, gazeZ] = eyeResult.gazeDirection;
    
    // Simple screen intersection calculation
    // Assumes screen is perpendicular to camera at fixed distance
    const screenDistance = 600; // mm
    const screenWidth = screenDimensions.width || 1920;
    const screenHeight = screenDimensions.height || 1080;
    
    // Project gaze ray to screen plane
    if (Math.abs(gazeZ) < 0.1) {
      return null; // Nearly parallel gaze
    }
    
    const t = screenDistance / Math.abs(gazeZ);
    const intersectionX = gazeX * t;
    const intersectionY = gazeY * t;
    
    // Convert to screen coordinates
    const screenX = (intersectionX / 300 + cameraPosition.x) * screenWidth;
    const screenY = (-intersectionY / 200 + cameraPosition.y) * screenHeight;
    
    return {
      x: Math.max(0, Math.min(screenWidth, screenX)),
      y: Math.max(0, Math.min(screenHeight, screenY)),
      confidence: eyeResult.metadata?.averageOpenness || 0.5
    };
    
  } catch (error) {
    console.warn('Screen gaze estimation failed:', error);
    return null;
  }
};

// Create eye tracking smoothing filter
export const createEyeTrackingFilter = (config = {}) => {
  const state = {
    initialized: false,
    leftGaze: [0, 0, -1],
    rightGaze: [0, 0, -1],
    gazeDirection: [0, 0, -1],
    leftOpenness: 1.0,
    rightOpenness: 1.0,
    alpha: config.smoothingFactor || 0.6
  };

  const update = (eyeResult) => {
    if (!state.initialized) {
      state.leftGaze = [...eyeResult.left.gazeVector];
      state.rightGaze = [...eyeResult.right.gazeVector];
      state.gazeDirection = [...eyeResult.gazeDirection];
      state.leftOpenness = eyeResult.left.openness;
      state.rightOpenness = eyeResult.right.openness;
      state.initialized = true;
      return eyeResult;
    }
    
    const {alpha} = state;
    
    // Smooth gaze vectors
    const smoothedLeftGaze = state.leftGaze.map((prev, i) => 
      alpha * eyeResult.left.gazeVector[i] + (1 - alpha) * prev
    );
    
    const smoothedRightGaze = state.rightGaze.map((prev, i) => 
      alpha * eyeResult.right.gazeVector[i] + (1 - alpha) * prev
    );
    
    const smoothedGazeDirection = state.gazeDirection.map((prev, i) => 
      alpha * eyeResult.gazeDirection[i] + (1 - alpha) * prev
    );
    
    // Smooth openness
    const smoothedLeftOpenness = alpha * eyeResult.left.openness + (1 - alpha) * state.leftOpenness;
    const smoothedRightOpenness = alpha * eyeResult.right.openness + (1 - alpha) * state.rightOpenness;
    
    // Update state
    state.leftGaze = smoothedLeftGaze;
    state.rightGaze = smoothedRightGaze;
    state.gazeDirection = smoothedGazeDirection;
    state.leftOpenness = smoothedLeftOpenness;
    state.rightOpenness = smoothedRightOpenness;
    
    // Return smoothed result
    return createEyeResult({
      left: {
        ...eyeResult.left,
        gazeVector: smoothedLeftGaze,
        openness: smoothedLeftOpenness
      },
      right: {
        ...eyeResult.right,
        gazeVector: smoothedRightGaze,
        openness: smoothedRightOpenness
      },
      convergencePoint: eyeResult.convergencePoint,
      gazeDirection: smoothedGazeDirection,
      metadata: eyeResult.metadata
    });
  };

  const reset = () => {
    state.initialized = false;
  };

  return { update, reset, isInitialized: () => state.initialized };
};

/**
 * Create MediaPipe Iris Tracking Pipeline
 * 
 * Factory function that creates a high-precision eye tracking and gaze estimation
 * pipeline using MediaPipe Iris. Provides detailed iris landmarks, gaze vectors,
 * and screen gaze point estimation.
 * 
 * @param {Object} config - Pipeline configuration
 * @param {number} [config.maxNumFaces=1] - Maximum faces to track (iris works best with 1)
 * @param {boolean} [config.refineLandmarks=true] - Enable refined landmark detection
 * @param {number} [config.minDetectionConfidence=0.5] - Minimum detection confidence
 * @param {number} [config.minTrackingConfidence=0.5] - Minimum tracking confidence
 * @param {boolean} [config.enableGazeEstimation=true] - Enable 3D gaze vector estimation
 * @param {number} [config.smoothingFactor=0.7] - Temporal smoothing factor
 * @returns {Object} Pipeline instance with process, initialize, and cleanup methods
 * 
 * @example
 * const pipeline = createIrisTrackingPipeline({
 *   maxNumFaces: 1,
 *   enableGazeEstimation: true,
 *   smoothingFactor: 0.8
 * });
 * 
 * await pipeline.initialize();
 * const result = await pipeline.process(videoFrame);
 * const gazePoint = estimateScreenGazePoint(result.eyes, { width: 1920, height: 1080 });
 * await pipeline.cleanup();
 */
/**
 * Creates standardized Iris Tracking pipeline
 * @param {Object} userConfig - User configuration overrides
 * @returns {Object} - Iris Tracking pipeline instance
 */
export const createIrisTrackingPipeline = (userConfig = {}) => {
  // Use unified configuration system
  const config = createPipelineConfig('iris-tracking', userConfig);
  
  const state = {
    iris: null,
    eyeTrackingFilter: null,
    mediaPipeLoader: null,
    imageProcessor: null,
    resourcePool: null,
    isInitialized: false,
    config
  };

  const initialize = async (initConfig = {}) => {
    try {
      handleError(
        'Initializing MediaPipe Iris tracking pipeline',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { config: state.config }
      );

      // Initialize shared resources
      state.resourcePool = getGlobalResourcePool();
      state.imageProcessor = createImageProcessor({ resourcePool: state.resourcePool });
      
      // Import dependency loader
      const { createMediaPipeLoader } = await import('../../../../shared/utils/dependency-loader.js');
      state.mediaPipeLoader = createMediaPipeLoader();

      // Load Iris with configuration
      state.iris = await state.mediaPipeLoader.loadIris({
        maxNumFaces: state.config.maxNumFaces,
        minDetectionConfidence: state.config.minDetectionConfidence,
        minTrackingConfidence: state.config.minTrackingConfidence
      });
      
      // Initialize smoothing filter
      state.eyeTrackingFilter = createEyeTrackingFilter({
        smoothingFactor: state.config.smoothingFactor
      });

      state.isInitialized = true;
      console.log('✅ MediaPipe Iris tracking pipeline initialized');
      return true;
    } catch (error) {
      handleError(
        `MediaPipe Iris initialization failed: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR,
        { error }
      );
      throw new Error(`MediaPipe Iris initialization failed: ${error.message}`);
    }
  };

  const process = async (frame) => {
    if (!state.isInitialized) {
      await initialize();
    }

    try {
      const startTime = Date.now();
      
      // Send frame to MediaPipe Iris
      const results = await new Promise((resolve, reject) => {
        state.iris.onResults(resolve);
        state.iris.send({ image: frame });
        
        // Set timeout to prevent hanging - configurable for test environments
        const timeout = state.config.processingTimeout || 3000;
        setTimeout(() => reject(new Error('Iris processing timeout')), timeout);
      });
      
      // Extract eye tracking information
      const eyeResult = extractEyeTracking(results, state.config);
      
      // Apply smoothing if enabled
      const smoothedResult = state.eyeTrackingFilter ? 
        state.eyeTrackingFilter.update(eyeResult) : eyeResult;
      
      const processingTime = Date.now() - startTime;
      
      return createAnalysisResult({
        faces: [], // Iris pipeline focuses on eyes
        eyes: smoothedResult,
        confidence: smoothedResult.metadata?.averageOpenness || 0.5,
        metadata: {
          processingTime,
          frameTimestamp: Date.now(),
          pipelineName: 'mediapipe-iris',
          irisDetected: (smoothedResult.metadata?.irisLandmarksDetected || 0) > 0,
          gazeEstimationEnabled: state.config.enableGazeEstimation,
          smoothingApplied: Boolean(state.eyeTrackingFilter)
        }
      });

    } catch (error) {
      handleError(
        `MediaPipe Iris processing failed: ${error.message}`,
        ErrorCategory.PROCESSING,
        ErrorSeverity.ERROR,
        { error }
      );
      throw new Error(`MediaPipe Iris processing failed: ${error.message}`);
    }
  };

  const cleanup = () => {
    try {
      if (state.mediaPipeLoader) {
        state.mediaPipeLoader.cleanup();
        state.mediaPipeLoader = null;
      }
      if (state.eyeTrackingFilter) {
        state.eyeTrackingFilter.reset();
      }
      state.iris = null;
      state.isInitialized = false;
      console.log('🧹 MediaPipe Iris tracking pipeline cleaned up');
    } catch (error) {
      console.warn('⚠️ MediaPipe Iris cleanup error:', error);
    }
  };

  const pipeline = createPipeline({
    name: 'mediapipe-iris',
    capabilities: [
      Capability.EYE_TRACKING
    ],
    performance: createPerformanceProfile({
      fps: 30,
      latency: '25-40ms',
      modelSize: '3MB',
      cpuUsage: 'medium',
      memoryUsage: 'low',
      batteryImpact: 'medium'
    }),

    initialize,
    process,
    cleanup,
    getConfig: () => state.config,
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
    },
    isInitialized: () => state.isInitialized,
    getHealthStatus: () => ({
      healthy: state.isInitialized,
      runtime: 'browser', // MediaPipe Iris browser-only
      backend: 'mediapipe-iris',
      modelLoaded: Boolean(state.iris),
      smoothingEnabled: Boolean(state.eyeTrackingFilter)
    })
  });

  // Extend pipeline with custom methods
  return {
    ...pipeline,
    getConfig: () => state.config,
    isInitialized: () => state.isInitialized,
    // Override getHealthStatus to match test expectations
    getHealthStatus: () => ({
      healthy: state.isInitialized,
      runtime: 'browser',
      backend: 'mediapipe-iris',
      modelLoaded: Boolean(state.iris),
      smoothingEnabled: Boolean(state.eyeTrackingFilter)
    }),
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
    },
    getStats: () => ({
      runtime: 'browser',
      backend: 'mediapipe-iris',
      config: { ...state.config },
      initialized: state.isInitialized,
      performance: {
        fps: 30,
        latency: '25-40ms',
        modelSize: '3MB',
        cpuUsage: 'medium',
        memoryUsage: 'low'
      },
      capabilities: ['iris-tracking', 'gaze-estimation', 'eye-tracking']
    }),
    getInfo: () => ({
      name: 'iris-tracking',
      version: '1.0.0',
      type: 'eye-tracking',
      capabilities: ['iris-tracking', 'gaze-estimation', 'eye-tracking'],
      performance: {
        fps: 30,
        latency: '25-40ms',
        modelSize: '3MB',
        cpuUsage: 'medium',
        memoryUsage: 'low',
        batteryImpact: 'medium'
      },
      requirements: {
        webgl: false,
        mediaApi: true,
        hardware: 'camera',
        mediapipe: true
      }
    })
  };
};
