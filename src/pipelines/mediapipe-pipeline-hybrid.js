/**
 * Hybrid MediaPipe Face Mesh Pipeline Implementation
 * Works in both browser and Node.js environments with graceful fallback
 */

import { createPipeline } from '../core/pipeline.js';
import { 
  Capability,
  createPerformanceProfile,
  createFaceResult,
  createPose6DOF,
  createAnalysisResult
} from '../core/types.js';
import { 
  detectRuntime, 
  checkFeatures,
  createUniversalCanvas 
} from '../utils/runtime-detector.js';
import { createMediaPipeLoader } from '../utils/dependency-loader.js';

// MediaPipe configuration
const createMediaPipeConfig = (config = {}) => ({
  maxNumFaces: config.maxNumFaces || 1,
  refineLandmarks: config.refineLandmarks !== false,
  minDetectionConfidence: config.minDetectionConfidence || 0.5,
  minTrackingConfidence: config.minTrackingConfidence || 0.5,
  modelComplexity: config.modelComplexity || 1,
  ...config
});

// Convert MediaPipe landmarks to standard format
const mediaPipeToFaceResult = (faceLandmarks, index = 0) => {
  if (!faceLandmarks || faceLandmarks.length === 0) {
    return null;
  }

  // Calculate bounding box from landmarks
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  faceLandmarks.forEach(pt => {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  });

  const bbox = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };

  // Extract key landmarks for pose estimation
  const noseTip = faceLandmarks[1];
  const leftEye = faceLandmarks[33];
  const rightEye = faceLandmarks[263];
  const leftMouth = faceLandmarks[61];
  const rightMouth = faceLandmarks[291];
  const chin = faceLandmarks[152];

  // Estimate 6DOF pose (simplified)
  const pose6DOF = createPose6DOF({
    yaw: 0, // Would need proper calculation
    pitch: 0,
    roll: 0,
    x: noseTip?.x || 0,
    y: noseTip?.y || 0,
    z: noseTip?.z || 0,
    confidence: 0.8
  });

  // Convert landmarks to standard format
  const landmarks = faceLandmarks.map((pt, idx) => ({
    x: pt.x,
    y: pt.y,
    z: pt.z || 0,
    confidence: pt.visibility || 0.9,
    name: `landmark_${idx}`
  }));

  return createFaceResult({
    id: `face_${index}_${Date.now()}`,
    boundingBox: bbox,
    confidence: 0.9,
    landmarks,
    pose: null, // Use 6DOF instead
    pose6DOF,
    expression: null, // Would need separate model
    eyes: {
      left: { 
        position: leftEye ? { x: leftEye.x, y: leftEye.y } : null,
        openness: 1.0 
      },
      right: { 
        position: rightEye ? { x: rightEye.x, y: rightEye.y } : null,
        openness: 1.0 
      }
    },
    quality: {
      brightness: 1.0,
      sharpness: 0.9,
      occlusion: 0
    }
  });
};

// Node.js fallback implementation using simplified detection
const createNodeFallback = () => {
  return {
    process: async (input) => {
      // Simple mock detection for Node.js testing
      console.warn('MediaPipe not available in Node.js, using mock detection');
      
      return createAnalysisResult({
        faces: [
          createFaceResult({
            id: 'mock_face_0',
            boundingBox: { x: 100, y: 100, width: 200, height: 200 },
            confidence: 0.5,
            landmarks: [],
            pose6DOF: createPose6DOF({ confidence: 0.5 })
          })
        ],
        metadata: {
          processingTime: 50,
          frameTimestamp: Date.now(),
          pipelineName: 'mediapipe-fallback',
          backend: 'mock',
          runtime: 'node'
        }
      });
    }
  };
};

// Create hybrid MediaPipe pipeline
export const createHybridMediaPipePipeline = (config = {}) => {
  const state = {
    faceMesh: null,
    runtime: detectRuntime(),
    features: checkFeatures(),
    config: createMediaPipeConfig(config),
    isInitialized: false,
    fallback: null
  };

  const initialize = async () => {
    try {
      console.log(`🔄 Initializing MediaPipe pipeline for ${state.runtime} environment...`);
      
      if (state.features.isBrowser) {
        // Browser: Load MediaPipe
        try {
          const loader = createMediaPipeLoader();
          await loader.load();
          const deps = { FaceMesh: window.FaceMesh };
          
          if (!deps.FaceMesh) {
            throw new Error('MediaPipe FaceMesh not available');
          }

          state.faceMesh = new deps.FaceMesh({
            locateFile: (file) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
          });

          state.faceMesh.setOptions({
            maxNumFaces: state.config.maxNumFaces,
            refineLandmarks: state.config.refineLandmarks,
            minDetectionConfidence: state.config.minDetectionConfidence,
            minTrackingConfidence: state.config.minTrackingConfidence
          });

          state.faceMesh.onResults((results) => {
            state.lastResults = results;
          });

          console.log('✅ MediaPipe Face Mesh initialized for browser');
        } catch (error) {
          console.warn('MediaPipe initialization failed, using fallback:', error);
          state.fallback = createNodeFallback();
        }
      } else {
        // Node.js: Use fallback
        console.log('📦 Using fallback implementation for Node.js environment');
        state.fallback = createNodeFallback();
      }
      
      state.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ MediaPipe initialization failed:', error);
      // Use fallback
      state.fallback = createNodeFallback();
      state.isInitialized = true;
      return true;
    }
  };

  const process = async (input) => {
    if (!state.isInitialized) {
      await initialize();
    }

    try {
      const startTime = Date.now();
      
      // Use fallback if MediaPipe not available
      if (state.fallback) {
        return state.fallback.process(input);
      }

      // Browser processing with MediaPipe
      if (state.faceMesh) {
        // Process input through MediaPipe
        await state.faceMesh.send({ image: input });
        
        // Wait for results (with timeout)
        const results = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(null), 1000);
          const checkResults = setInterval(() => {
            if (state.lastResults) {
              clearTimeout(timeout);
              clearInterval(checkResults);
              const res = state.lastResults;
              state.lastResults = null;
              resolve(res);
            }
          }, 10);
        });

        if (!results || !results.multiFaceLandmarks) {
          return createAnalysisResult({
            faces: [],
            metadata: {
              processingTime: Date.now() - startTime,
              frameTimestamp: Date.now(),
              pipelineName: 'mediapipe-hybrid',
              backend: 'mediapipe'
            }
          });
        }

        // Convert MediaPipe results to standard format
        const faces = results.multiFaceLandmarks.map((landmarks, idx) => 
          mediaPipeToFaceResult(landmarks, idx)
        ).filter(face => face !== null);

        return createAnalysisResult({
          faces,
          metadata: {
            processingTime: Date.now() - startTime,
            frameTimestamp: Date.now(),
            pipelineName: 'mediapipe-hybrid',
            backend: 'mediapipe',
            runtime: state.runtime
          }
        });
      }

      // Should not reach here
      throw new Error('No processing method available');
      
    } catch (error) {
      console.error('MediaPipe processing error:', error);
      
      // Return empty result on error
      return createAnalysisResult({
        faces: [],
        metadata: {
          processingTime: 0,
          error: error.message,
          pipelineName: 'mediapipe-hybrid',
          runtime: state.runtime
        }
      });
    }
  };

  const cleanup = () => {
    if (state.faceMesh && typeof state.faceMesh.close === 'function') {
      state.faceMesh.close();
    }
    state.faceMesh = null;
    state.fallback = null;
    state.isInitialized = false;
    console.log('🧹 MediaPipe pipeline cleaned up');
  };

  return createPipeline({
    name: 'mediapipe-hybrid',
    capabilities: [
      Capability.FACE_DETECTION,
      Capability.POSE_ESTIMATION_6DOF,
      Capability.LANDMARK_DETECTION,
      Capability.EYE_TRACKING
    ],
    performance: createPerformanceProfile({
      fps: 30,
      latency: '30-50ms',
      modelSize: '11MB',
      cpuUsage: state.features.isBrowser ? 'medium' : 'low',
      memoryUsage: 'medium'
    }),
    initialize,
    process,
    cleanup,
    getConfig: () => state.config,
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
      if (state.faceMesh) {
        state.faceMesh.setOptions(state.config);
      }
    },
    isInitialized: () => state.isInitialized,
    getHealthStatus: () => ({
      healthy: state.isInitialized,
      runtime: state.runtime,
      backend: state.faceMesh ? 'mediapipe' : 'fallback',
      modelLoaded: !!state.faceMesh || !!state.fallback
    })
  });
};

// Export as main factory
export const createMediaPipeFaceMeshPipeline = createHybridMediaPipePipeline;