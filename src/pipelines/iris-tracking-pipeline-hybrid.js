/**
 * Hybrid Iris Tracking Pipeline Implementation
 * Works in both browser and Node.js environments with graceful fallback
 */

import { createPipeline } from '../core/pipeline.js';
import { 
  Capability,
  createPerformanceProfile,
  createFaceResult,
  createAnalysisResult
} from '../core/types.js';
import { 
  detectRuntime, 
  checkFeatures,
  createUniversalCanvas,
  loadTensorFlow,
  imageToTensor
} from '../utils/runtime-detector.js';
import { createMediaPipeLoader } from '../utils/dependency-loader.js';

// Iris tracking configuration
const createIrisConfig = (config = {}) => ({
  maxNumFaces: config.maxNumFaces || 1,
  refineLandmarks: config.refineLandmarks !== false,
  minDetectionConfidence: config.minDetectionConfidence || 0.5,
  minTrackingConfidence: config.minTrackingConfidence || 0.5,
  smoothing: config.smoothing || true,
  gazeSmoothing: config.gazeSmoothing || 0.7,
  ...config
});

// Convert MediaPipe Iris results to standard format
const irisToFaceResult = (irisResults, index = 0) => {
  if (!irisResults || !irisResults.multiFaceLandmarks || irisResults.multiFaceLandmarks.length === 0) {
    return null;
  }

  const faceLandmarks = irisResults.multiFaceLandmarks[index];
  
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

  // Extract eye regions and iris information
  const leftEyeRegion = faceLandmarks.slice(33, 42);  // Approximation
  const rightEyeRegion = faceLandmarks.slice(362, 374);

  return createFaceResult({
    id: `iris_face_${index}_${Date.now()}`,
    boundingBox: bbox,
    confidence: 0.9,
    landmarks: faceLandmarks.map((pt, idx) => ({
      x: pt.x,
      y: pt.y,
      z: pt.z || 0,
      confidence: pt.visibility || 0.9,
      name: `iris_landmark_${idx}`
    })),
    eyes: {
      left: { 
        position: leftEyeRegion.length > 0 ? { x: leftEyeRegion[0].x, y: leftEyeRegion[0].y } : null,
        openness: 1.0,
        gaze: calculateGazeDirection(leftEyeRegion)
      },
      right: { 
        position: rightEyeRegion.length > 0 ? { x: rightEyeRegion[0].x, y: rightEyeRegion[0].y } : null,
        openness: 1.0,
        gaze: calculateGazeDirection(rightEyeRegion)
      }
    },
    quality: {
      brightness: 1.0,
      sharpness: 0.9,
      occlusion: 0
    }
  });
};

// Calculate gaze direction from iris landmarks
const calculateGazeDirection = (eyeLandmarks) => {
  if (!eyeLandmarks || eyeLandmarks.length === 0) {
    return { x: 0, y: 0, confidence: 0 };
  }

  // Simplified gaze calculation
  const centerX = eyeLandmarks.reduce((sum, pt) => sum + pt.x, 0) / eyeLandmarks.length;
  const centerY = eyeLandmarks.reduce((sum, pt) => sum + pt.y, 0) / eyeLandmarks.length;
  
  // Normalize to screen coordinates (-1 to 1)
  const gazeX = (centerX - 0.5) * 2;
  const gazeY = (centerY - 0.5) * 2;
  
  return {
    x: Math.max(-1, Math.min(1, gazeX)),
    y: Math.max(-1, Math.min(1, gazeY)),
    confidence: 0.8
  };
};

// Node.js fallback using basic eye tracking
const createAdvancedNodeFallback = async () => {
  let tf = null;
  let blazefaceModel = null;
  
  try {
    tf = await loadTensorFlow();
    if (tf) {
      const blazeface = await import('@tensorflow-models/blazeface');
      blazefaceModel = await blazeface.load();
      console.log('✅ Advanced iris fallback with BlazeFace initialized');
    }
  } catch (error) {
    console.warn('⚠️ Advanced iris fallback failed:', error.message);
  }
  
  return {
    process: async (input) => {
      const startTime = Date.now();
      
      if (tf && blazefaceModel) {
        try {
          const inputTensor = await imageToTensor(input, tf);
          const predictions = await blazefaceModel.estimateFaces(inputTensor, false);
          inputTensor.dispose();
          
          const faces = predictions.map((prediction, index) => {
            const { topLeft, bottomRight, landmarks, probability } = prediction;
            
            return createFaceResult({
              id: `iris_fallback_${index}`,
              boundingBox: {
                x: topLeft[0],
                y: topLeft[1],
                width: bottomRight[0] - topLeft[0],
                height: bottomRight[1] - topLeft[1]
              },
              confidence: probability[0],
              landmarks: landmarks.map((pt, idx) => ({
                x: pt[0], y: pt[1], z: 0, confidence: 0.7, name: `landmark_${idx}`
              })),
              eyes: {
                left: { 
                  position: landmarks[1] ? { x: landmarks[1][0], y: landmarks[1][1] } : null,
                  openness: 1.0,
                  gaze: { x: 0, y: 0, confidence: 0.5 }
                },
                right: { 
                  position: landmarks[0] ? { x: landmarks[0][0], y: landmarks[0][1] } : null,
                  openness: 1.0,
                  gaze: { x: 0, y: 0, confidence: 0.5 }
                }
              }
            });
          });
          
          return createAnalysisResult({
            faces,
            metadata: {
              processingTime: Date.now() - startTime,
              frameTimestamp: Date.now(),
              pipelineName: 'iris-tracking-advanced-fallback',
              backend: 'tensorflow-blazeface',
              runtime: 'node',
              fallbackReason: 'mediapipe-iris-unavailable'
            }
          });
        } catch (error) {
          console.warn('Advanced iris fallback processing failed:', error);
        }
      }
      
      // Basic geometric fallback
      return createAnalysisResult({
        faces: [{
          ...createFaceResult({
            id: 'iris_basic_face_0',
            boundingBox: { x: 160, y: 120, width: 320, height: 240 },
            confidence: 0.3,
            landmarks: [],
            eyes: {
              left: { 
                position: { x: 240, y: 200 },
                openness: 1.0,
                gaze: { x: 0, y: 0, confidence: 0.3 }
              },
              right: { 
                position: { x: 400, y: 200 },
                openness: 1.0,
                gaze: { x: 0, y: 0, confidence: 0.3 }
              }
            }
          })
        }],
        metadata: {
          processingTime: Date.now() - startTime,
          frameTimestamp: Date.now(),
          pipelineName: 'iris-tracking-basic-fallback',
          backend: 'geometric',
          runtime: 'node',
          fallbackReason: 'no-models-available'
        }
      });
    }
  };
};

// Create hybrid iris tracking pipeline
export const createHybridIrisTrackingPipeline = (config = {}) => {
  const state = {
    iris: null,
    mediaPipeLoader: null,
    runtime: detectRuntime(),
    features: checkFeatures(),
    config: createIrisConfig(config),
    isInitialized: false,
    fallback: null,
    eyeTrackingFilter: null
  };

  const initialize = async () => {
    try {
      console.log(`🔄 Initializing Iris tracking pipeline for ${state.runtime} environment...`);
      
      if (state.features.isBrowser) {
        // Browser: Load MediaPipe Iris
        try {
          state.mediaPipeLoader = createMediaPipeLoader();
          await state.mediaPipeLoader.load();
          
          // Load MediaPipe Iris
          const iris = new window.Iris({
            locateFile: (file) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/iris/${file}`;
            }
          });

          iris.setOptions({
            maxNumFaces: state.config.maxNumFaces,
            refineLandmarks: state.config.refineLandmarks,
            minDetectionConfidence: state.config.minDetectionConfidence,
            minTrackingConfidence: state.config.minTrackingConfidence
          });

          iris.onResults((results) => {
            state.lastResults = results;
          });

          state.iris = iris;
          console.log('✅ MediaPipe Iris initialized for browser');
        } catch (error) {
          console.warn('MediaPipe Iris initialization failed, using fallback:', error);
          state.fallback = await createAdvancedNodeFallback();
        }
      } else {
        // Node.js: Use advanced fallback
        console.log('📦 Using advanced iris fallback for Node.js environment');
        state.fallback = await createAdvancedNodeFallback();
      }
      
      state.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Iris tracking initialization failed:', error);
      // Use advanced fallback
      state.fallback = await createAdvancedNodeFallback();
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
      
      // Use fallback if MediaPipe Iris not available
      if (state.fallback) {
        return state.fallback.process(input);
      }

      // Browser processing with MediaPipe Iris
      if (state.iris) {
        // Process input through MediaPipe Iris
        await state.iris.send({ image: input });
        
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

        if (!results) {
          return createAnalysisResult({
            faces: [],
            metadata: {
              processingTime: Date.now() - startTime,
              frameTimestamp: Date.now(),
              pipelineName: 'iris-tracking-hybrid',
              backend: 'mediapipe-iris'
            }
          });
        }

        // Convert MediaPipe Iris results to standard format
        const faces = [];
        if (results.multiFaceLandmarks) {
          for (let i = 0; i < results.multiFaceLandmarks.length; i++) {
            const face = irisToFaceResult(results, i);
            if (face) faces.push(face);
          }
        }

        return createAnalysisResult({
          faces,
          metadata: {
            processingTime: Date.now() - startTime,
            frameTimestamp: Date.now(),
            pipelineName: 'iris-tracking-hybrid',
            backend: 'mediapipe-iris',
            runtime: state.runtime
          }
        });
      }

      // Should not reach here
      throw new Error('No iris processing method available');
      
    } catch (error) {
      console.error('Iris tracking processing error:', error);
      
      // Return empty result on error
      return createAnalysisResult({
        faces: [],
        metadata: {
          processingTime: 0,
          error: error.message,
          pipelineName: 'iris-tracking-hybrid',
          runtime: state.runtime
        }
      });
    }
  };

  const cleanup = () => {
    if (state.iris && typeof state.iris.close === 'function') {
      state.iris.close();
    }
    if (state.mediaPipeLoader) {
      state.mediaPipeLoader.cleanup();
    }
    state.iris = null;
    state.mediaPipeLoader = null;
    state.fallback = null;
    state.isInitialized = false;
    console.log('🧹 Iris tracking pipeline cleaned up');
  };

  return createPipeline({
    name: 'iris-tracking-hybrid',
    capabilities: [
      Capability.EYE_TRACKING,
      Capability.GAZE_ESTIMATION,
      Capability.LANDMARK_DETECTION
    ],
    performance: createPerformanceProfile({
      fps: 30,
      latency: '25-40ms',
      modelSize: '3MB',
      cpuUsage: state.features.isBrowser ? 'medium' : 'low',
      memoryUsage: 'low'
    }),
    initialize,
    process,
    cleanup,
    getConfig: () => state.config,
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
      if (state.iris) {
        state.iris.setOptions(state.config);
      }
    },
    isInitialized: () => state.isInitialized,
    getHealthStatus: () => ({
      healthy: state.isInitialized,
      runtime: state.runtime,
      backend: state.iris ? 'mediapipe-iris' : 'fallback',
      modelLoaded: !!state.iris || !!state.fallback
    })
  });
};

// Export as main factory
export const createIrisTrackingPipeline = createHybridIrisTrackingPipeline;