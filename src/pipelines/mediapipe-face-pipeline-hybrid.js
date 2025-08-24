/**
 * Hybrid MediaPipe Face Detection Pipeline Implementation
 * Works in both browser and Node.js environments
 * Lightweight alternative to TensorFlow.js BlazeFace
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../core/pipeline.js';
import { 
  Capability,
  createPerformanceProfile,
  createFaceResult,
  createPose3DOF,
  createAnalysisResult
} from '../core/types.js';
import { 
  detectRuntime, 
  checkFeatures, 
  loadMediaPipe, 
  imageToMediaPipe,
  createUniversalCanvas 
} from '../utils/runtime-detector.js';
import { createMediaPipeFaceDetector } from '../modules/detection/mediapipe/mediapipe-face-detector.js';

// MediaPipe Face Detection configuration
const createMediaPipeFaceConfig = (config = {}) => ({
  modelSelection: config.modelSelection || 0, // 0 for short-range (< 2m), 1 for full-range
  minDetectionConfidence: config.minDetectionConfidence || 0.7,
  maxFaces: config.maxFaces || 10,
  selfieMode: config.selfieMode || false,
  ...config
});

// 3DOF pose estimation from MediaPipe face landmarks
const estimatePose3DOF = (landmarks, bbox) => {
  if (!landmarks || landmarks.length < 6) {
    return createPose3DOF({ confidence: 0 });
  }

  try {
    // MediaPipe face detection provides key landmarks
    const noseTip = landmarks[0];
    const leftEye = landmarks[1];
    const rightEye = landmarks[2];
    const leftMouth = landmarks[3];
    const rightMouth = landmarks[4];
    const leftEar = landmarks[5] || null;

    // Calculate face center and dimensions
    const [bx, by, bw, bh] = bbox;
    const faceCenterX = bx + bw / 2;
    const faceCenterY = by + bh / 2;

    // Estimate yaw (left/right rotation)
    const eyeCenterX = (leftEye[0] + rightEye[0]) / 2;
    const yawOffset = (eyeCenterX - faceCenterX) / (bw / 2);
    const yaw = Math.atan(yawOffset) * (180 / Math.PI);

    // Estimate pitch (up/down rotation)
    const eyeCenterY = (leftEye[1] + rightEye[1]) / 2;
    const mouthCenterY = (leftMouth[1] + rightMouth[1]) / 2;
    const faceHeight = bh;
    const eyeMouthDistance = mouthCenterY - eyeCenterY;
    const expectedEyeMouthRatio = 0.3; // Typical ratio
    const actualRatio = eyeMouthDistance / faceHeight;
    const pitchFactor = (actualRatio - expectedEyeMouthRatio) / expectedEyeMouthRatio;
    const pitch = pitchFactor * 30; // Convert to degrees

    // Estimate roll (tilt rotation)
    const eyeAngle = Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]);
    const roll = eyeAngle * (180 / Math.PI);

    // Calculate confidence based on face size and landmark quality
    const faceArea = bw * bh;
    const minFaceArea = 50 * 50; // Minimum face size
    const sizeConfidence = Math.min(faceArea / minFaceArea, 1);
    
    // Landmark quality based on eye distance
    const eyeDistance = Math.sqrt(
      Math.pow(rightEye[0] - leftEye[0], 2) + 
      Math.pow(rightEye[1] - leftEye[1], 2)
    );
    const expectedEyeDistance = bw * 0.3; // Expected ratio
    const eyeQuality = Math.max(0, 1 - Math.abs(eyeDistance - expectedEyeDistance) / expectedEyeDistance);
    
    const confidence = (sizeConfidence + eyeQuality) / 2;

    return createPose3DOF({
      yaw: Math.max(-90, Math.min(90, yaw)),
      pitch: Math.max(-90, Math.min(90, pitch)),
      roll: Math.max(-90, Math.min(90, roll)),
      confidence: Math.max(0, Math.min(1, confidence)),
      landmarks: landmarks,
      source: 'mediapipe_face_detection'
    });

  } catch (error) {
    console.warn('Pose estimation error:', error);
    return createPose3DOF({ confidence: 0 });
  }
};

// Create hybrid MediaPipe Face pipeline
export const createHybridMediaPipeFacePipeline = (config = {}) => {
  const state = {
    detector: null,
    runtime: detectRuntime(),
    features: checkFeatures(),
    config: createMediaPipeFaceConfig(config),
    isInitialized: false,
    canvas: null,
    ctx: null,
    mediaUtils: null
  };

  const initialize = async () => {
    try {
      console.log(`🔄 Initializing MediaPipe Face pipeline for ${state.runtime} environment...`);
      
      // Load MediaPipe utilities
      if (state.features.isBrowser) {
        state.mediaUtils = await loadMediaPipe();
      } else {
        // Server mode - use fallback detection
        console.log('🖥️ Server mode: Using lightweight face detection fallback');
        state.mediaUtils = { serverMode: true };
      }

      // Create MediaPipe face detector
      state.detector = createMediaPipeFaceDetector({
        ...state.config,
        runtime: state.runtime
      });
      
      await state.detector.initialize();
      
      // Create canvas for image processing if needed
      if (state.features.isNode) {
        state.canvas = await createUniversalCanvas(640, 480);
        state.ctx = state.canvas.getContext('2d');
      }
      
      state.isInitialized = true;
      console.log(`✅ MediaPipe Face pipeline initialized successfully in ${state.runtime} environment`);
      console.log(`📊 Detection confidence threshold: ${state.config.minDetectionConfidence}`);
      console.log(`📊 Max faces to detect: ${state.config.maxFaces}`);
      
      return true;
    } catch (error) {
      console.error('❌ MediaPipe Face initialization failed:', error);
      throw new Error(`MediaPipe Face initialization failed: ${error.message}`);
    }
  };

  const process = async (input) => {
    if (!state.isInitialized) {
      await initialize();
    }

    try {
      const startTime = Date.now();
      
      // Convert input to MediaPipe-compatible format
      const mediaInput = await imageToMediaPipe(input);
      
      // Perform face detection
      const detections = await state.detector.detectFaces(mediaInput);
      
      const processingTime = Date.now() - startTime;
      
      // Convert MediaPipe detections to our format
      const faces = detections.map((detection, index) => {
        const { bbox, landmarks, confidence } = detection;
        
        // Estimate 3DOF pose
        const pose3DOF = estimatePose3DOF(landmarks, bbox);
        
        return createFaceResult({
          id: `face_${index}`,
          bbox: {
            x: bbox[0],
            y: bbox[1], 
            width: bbox[2],
            height: bbox[3]
          },
          landmarks: landmarks.map(([x, y]) => ({ x, y })),
          confidence,
          pose3DOF,
          age: { value: null, confidence: 0 }, // Not provided by face detection
          gender: { value: null, confidence: 0 }, // Not provided by face detection
          emotion: { value: null, confidence: 0 }, // Not provided by face detection
          timestamp: Date.now()
        });
      });

      // Create performance profile
      const performanceProfile = createPerformanceProfile({
        processingTime,
        detectionCount: faces.length,
        modelSize: 5, // MediaPipe is ~5MB vs TensorFlow.js 635MB
        memoryUsage: process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0,
        gpuAccelerated: state.features.hasGPU && state.features.isBrowser,
        backend: 'mediapipe'
      });

      return createAnalysisResult({
        faces,
        processingTime,
        performanceProfile,
        metadata: {
          pipeline: 'mediapipe_face_hybrid',
          runtime: state.runtime,
          modelSelection: state.config.modelSelection,
          confidence_threshold: state.config.minDetectionConfidence,
          max_faces: state.config.maxFaces
        }
      });

    } catch (error) {
      console.error('MediaPipe Face processing error:', error);
      throw new Error(`Face processing failed: ${error.message}`);
    }
  };

  const cleanup = async () => {
    if (state.detector) {
      await state.detector.cleanup();
      state.detector = null;
    }
    
    state.isInitialized = false;
    console.log('🧹 MediaPipe Face pipeline cleaned up');
  };

  const getInfo = () => ({
    name: 'MediaPipe Face Detection (Hybrid)',
    version: '1.0.0',
    capabilities: [
      Capability.FACE_DETECTION,
      Capability.POSE_3DOF,
      Capability.REAL_TIME
    ],
    runtime: state.runtime,
    modelSize: '~5MB',
    performance: {
      typical_latency: '10-50ms',
      throughput: '30-60 FPS',
      memory_usage: 'Low (~50MB)'
    },
    configuration: state.config
  });

  // Create base pipeline
  const pipeline = createPipeline({
    name: 'mediapipe-face-hybrid',
    process,
    initialize,
    cleanup,
    getInfo,
    capabilities: [
      Capability.FACE_DETECTION,
      Capability.POSE_3DOF,
      Capability.REAL_TIME
    ]
  });

  return {
    ...pipeline,
    
    // Additional methods specific to face detection
    updateConfig: (newConfig) => {
      Object.assign(state.config, newConfig);
      if (state.detector && state.detector.updateConfig) {
        state.detector.updateConfig(newConfig);
      }
    },
    
    getConfig: () => ({ ...state.config }),
    
    isInitialized: () => state.isInitialized,
    
    getStats: () => ({
      isInitialized: state.isInitialized,
      runtime: state.runtime,
      detectorReady: !!state.detector,
      canvasReady: !!state.canvas,
      config: state.config
    })
  };
};

// Export for backward compatibility
export const createBlazeFacePipeline = createHybridMediaPipeFacePipeline;

// Export configuration helper
export { createMediaPipeFaceConfig };

// Export pipeline metadata
export const PIPELINE_INFO = {
  name: 'MediaPipe Face Detection (Hybrid)',
  version: '1.0.0',
  type: 'face_detection',
  capabilities: [
    'face_detection',
    'pose_3dof', 
    'real_time'
  ],
  requirements: {
    browser: ['MediaPipe Face Detection API support'],
    server: ['Lightweight face detection fallback']
  },
  performance: {
    model_size: '~5MB',
    typical_latency: '10-50ms',
    memory_usage: 'Low (~50MB)',
    bundle_reduction: '99% smaller than TensorFlow.js'
  }
};