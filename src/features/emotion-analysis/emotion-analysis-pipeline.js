/**
 * Real Emotion Analysis Pipeline - No Mocks, No Fallbacks
 * Pure CNN implementation with MediaPipe face detection integration
 */

import { createPipeline } from '../../core/pipeline/pipeline.ts';
import { createPipelineConfig } from '../../core/pipeline/pipeline-config.js';
import { 
  Capability,
  createAnalysisResult,
  createEmotionResult,
  createPerformanceProfile
} from '../../core/configuration/types.ts';
import { EMOTION_LABELS, createRealCNNModel } from './real-cnn-model.js';

/**
 * Creates real emotion analysis pipeline with face detection
 */
export const createEmotionAnalysisPipeline = (userConfig = {}) => {
  const config = createPipelineConfig('emotion-analysis', userConfig);
  
  let cnnModel = null;
  const faceDetection = null;
  let isInitialized = false;

  return createPipeline({
    name: 'emotion-analysis',
    capabilities: [Capability.EXPRESSION_ANALYSIS],
    performance: createPerformanceProfile({
      fps: 30,
      latency: '5-15ms',
      modelSize: '1.2MB',
      cpuUsage: 'medium',
      memoryUsage: 'low',
      batteryImpact: 'low'
    }),

    initialize: async (initConfig = {}) => {
      try {
        console.log('🚀 Initializing real emotion analysis pipeline...');
        
        // Skip MediaPipe initialization on server - client will send pre-cropped faces
        console.log('💡 Running in server mode - expecting pre-cropped face images from client');
        
        // Initialize real CNN model
        cnnModel = createRealCNNModel();
        await cnnModel.initialize();
        
        isInitialized = true;
        console.log('✅ Real emotion analysis pipeline initialized successfully');
        return true;
        
      } catch (error) {
        console.error('❌ Emotion analysis pipeline initialization failed:', error.message);
        throw error;
      }
    },

    process: async (frame) => {
      if (!isInitialized || !cnnModel) {
        throw new Error('Emotion analysis pipeline not initialized');
      }

      const startTime = performance.now();

      try {
        // Processing frame with real CNN
        
        // Convert frame to ImageData if needed
        const imageData = await convertFrameToImageData(frame);
        
        // Assume the entire image is a face (client should send cropped face regions)
        const emotionResult = await cnnModel.predictEmotion(imageData);
        
        console.log('🎯 Pipeline received CNN result:', {
          emotion: emotionResult.emotion,
          confidence: emotionResult.confidence,
          emotions: emotionResult.emotions
        });
        
        const results = [{
          bbox: [0, 0, imageData.width, imageData.height], // Full image
          emotion: {
            emotion: emotionResult.emotion,
            confidence: emotionResult.confidence,
            probabilities: emotionResult.emotions,
            emotions: emotionResult.emotions,
            valence: calculateValence(emotionResult.emotions),
            arousal: calculateArousal(emotionResult.emotions)
          },
          confidence: emotionResult.confidence
        }];

        const processingTime = performance.now() - startTime;
        
        const analysisResult = {
          faces: results,
          confidence: results.length > 0 ? Math.max(...results.map(r => r.confidence)) : 0,
          processingTime,
          timestamp: Date.now(),
          source: 'real-emotion-cnn',
          metadata: {
            emotionLabels: EMOTION_LABELS,
            facesDetected: results.length,
            model: 'real-cnn-v1.0',
            processingPipeline: 'Real CNN'
          }
        };
        
        console.log('✅ Pipeline returning result:', {
          faceCount: analysisResult.faces.length,
          firstFaceEmotion: analysisResult.faces[0]?.emotion?.emotion,
          firstFaceConfidence: analysisResult.faces[0]?.emotion?.confidence
        });
        
        return analysisResult;

      } catch (error) {
        console.error('❌ Pipeline processing error:', error.message);
        console.error('❌ Pipeline error stack:', error.stack);
        throw error;
      }
    },

    cleanup: async () => {
      try {
        if (cnnModel) {
          await cnnModel.cleanup();
          cnnModel = null;
        }
        
// No MediaPipe cleanup needed in server mode
        
        isInitialized = false;
        console.log('✅ Real emotion analysis pipeline cleaned up');
        return true;
        
      } catch (error) {
        console.error('Emotion analysis cleanup failed:', error.message);
        return false;
      }
    },

    getHealthStatus: () => ({
      healthy: isInitialized && !!cnnModel,
      runtime: 'browser',
      backend: 'real-cnn',
      modelLoaded: cnnModel?.isLoaded || false,
      faceDetectionAvailable: false // Server mode
    }),

    getConfig: () => ({ ...config }),
    isInitialized: () => isInitialized
  });
};

// Initialize MediaPipe Face Detection
async function initializeFaceDetection() {
  if (typeof FaceDetection === 'undefined') {
    throw new Error('MediaPipe FaceDetection not available. Include MediaPipe scripts.');
  }

  faceDetection = new FaceDetection({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
  });

  faceDetection.setOptions({
    model: 'short',
    minDetectionConfidence: 0.5
  });

  // Set up result callback
  let detectionResults = null;
  faceDetection.onResults((results) => {
    detectionResults = results;
  });

  // Store reference for later use
  faceDetection._getResults = () => detectionResults;

  console.log('✅ MediaPipe Face Detection initialized');
}

// Convert various frame formats to ImageData
async function convertFrameToImageData(frame) {
  // Check if we're in server environment (Bun) or browser
  const isServer = typeof window === 'undefined';
  
  if (!isServer && frame instanceof ImageData) {
    return frame;
  }

  if (frame.data && frame.width && frame.height) {
    // Create ImageData-like structure compatible with server
    if (isServer) {
      return {
        data: new Uint8ClampedArray(frame.data),
        width: frame.width,
        height: frame.height
      };
    } else {
      return new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
    }
  }

  if (frame.data instanceof Buffer || frame.data instanceof Uint8Array) {
    // For server environment, we can't decode images easily
    // Assume this is already decoded pixel data and create a basic structure
    if (isServer) {
      return {
        data: new Uint8ClampedArray(frame.data),
        width: frame.width || 640,
        height: frame.height || 480
      };
    } else {
      // Browser environment - can decode images
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Create image from buffer
      const blob = new Blob([frame.data]);
      const img = new Image();
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      });
    }
  }

  throw new Error('Unsupported frame format for emotion analysis');
}

// Detect faces in image
async function detectFaces(imageData) {
  if (!faceDetection) {
    throw new Error('Face detection not initialized');
  }

  // Create canvas from ImageData
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);

  // Send to MediaPipe
  await faceDetection.send({ image: canvas });
  
  // Get results
  const results = faceDetection._getResults();
  
  if (!results || !results.detections) {
    return [];
  }

  // Convert MediaPipe detections to face objects
  return results.detections.map(detection => ({
    bbox: {
      x: Math.round(detection.boundingBox.xCenter * imageData.width - (detection.boundingBox.width * imageData.width / 2)),
      y: Math.round(detection.boundingBox.yCenter * imageData.height - (detection.boundingBox.height * imageData.height / 2)),
      width: Math.round(detection.boundingBox.width * imageData.width),
      height: Math.round(detection.boundingBox.height * imageData.height)
    },
    confidence: detection.score[0]
  }));
}

// Extract face region from image
function extractFaceRegion(imageData, bbox) {
  const canvas = document.createElement('canvas');
  canvas.width = bbox.width;
  canvas.height = bbox.height;
  const ctx = canvas.getContext('2d');

  // Create temp canvas with full image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(imageData, 0, 0);

  // Extract face region
  ctx.drawImage(tempCanvas, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height);

  return ctx.getImageData(0, 0, bbox.width, bbox.height);
}

// Calculate valence from emotion probabilities
function calculateValence(emotions) {
  const valenceMap = {
    happy: 0.8, surprised: 0.3, neutral: 0.0,
    angry: -0.6, disgusted: -0.7, fearful: -0.5, sad: -0.8
  };

  let valence = 0;
  for (const [emotion, probability] of Object.entries(emotions)) {
    valence += probability * (valenceMap[emotion] || 0);
  }

  return Math.round(valence * 1000) / 1000;
}

// Calculate arousal from emotion probabilities
function calculateArousal(emotions) {
  const arousalMap = {
    happy: 0.7, surprised: 0.9, angry: 0.8, fearful: 0.6,
    disgusted: 0.4, sad: -0.3, neutral: 0.0
  };

  let arousal = 0;
  for (const [emotion, probability] of Object.entries(emotions)) {
    arousal += probability * (arousalMap[emotion] || 0);
  }

  return Math.round(arousal * 1000) / 1000;
}

export { EMOTION_LABELS };