/**
 * BlazeFace pipeline implementation
 * Wraps existing BlazeFace detection in standardized pipeline interface
 */

import { createPipeline } from '../core/pipeline.js';
import { 
  Capability,
  createPerformanceProfile,
  createFaceResult,
  createPose3DOF,
  createAnalysisResult
} from '../core/types.js';

// BlazeFace-specific configuration and utilities
const createBlazeFaceConfig = (config = {}) => ({
  modelUrl: config.modelUrl || 'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface/dist/model.json',
  maxFaces: config.maxFaces || 10,
  iouThreshold: config.iouThreshold || 0.3,
  scoreThreshold: config.scoreThreshold || 0.75,
  returnTensors: config.returnTensors || false,
  ...config
});

// 3DOF pose estimation from BlazeFace landmarks
const estimatePose3DOF = (landmarks, bbox) => {
  if (!landmarks || landmarks.length < 6) {
    return createPose3DOF({ confidence: 0 });
  }

  try {
    // Extract key landmarks (BlazeFace provides 6 landmarks)
    const rightEye = landmarks[0];
    const leftEye = landmarks[1];
    const nose = landmarks[2];
    const mouth = landmarks[3];
    const rightEar = landmarks[4];
    const leftEar = landmarks[5];

    // Calculate face center and dimensions
    const [bx, by, bw, bh] = bbox;
    const faceCenterX = bx + bw / 2;
    const faceCenterY = by + bh / 2;

    // YAW estimation from eye positions relative to face center
    const eyeMidpointX = (rightEye[0] + leftEye[0]) / 2;
    const eyeDistance = Math.abs(leftEye[0] - rightEye[0]);
    const yawOffset = (eyeMidpointX - faceCenterX) / (bw / 2);
    const yaw = yawOffset * 45; // Scale to reasonable degree range

    // PITCH estimation from nose position relative to eye line
    const eyeMidpointY = (rightEye[1] + leftEye[1]) / 2;
    const pitchOffset = (nose[1] - eyeMidpointY) / (bh / 4);
    const pitch = pitchOffset * 30;

    // ROLL estimation from eye line angle
    const eyeAngle = Math.atan2(
      leftEye[1] - rightEye[1],
      leftEye[0] - rightEye[0]
    );
    const roll = (eyeAngle * 180) / Math.PI;

    // Calculate confidence based on landmark quality
    const landmarkSpread = Math.sqrt(
      Math.pow(leftEye[0] - rightEye[0], 2) + 
      Math.pow(leftEye[1] - rightEye[1], 2)
    );
    const confidence = Math.min(1.0, landmarkSpread / 50);

    return createPose3DOF({
      yaw: Math.max(-90, Math.min(90, yaw)),
      pitch: Math.max(-90, Math.min(90, pitch)),
      roll: Math.max(-180, Math.min(180, roll)),
      confidence
    });

  } catch (error) {
    console.warn('Pose estimation failed:', error);
    return createPose3DOF({ confidence: 0 });
  }
};

// Convert BlazeFace predictions to standardized face results
const processPredictions = (predictions) => {
  return predictions.map((prediction, index) => {
    // Extract bounding box
    let bbox;
    if (prediction.topLeft && prediction.bottomRight) {
      bbox = [
        prediction.topLeft[0],
        prediction.topLeft[1],
        prediction.bottomRight[0] - prediction.topLeft[0],
        prediction.bottomRight[1] - prediction.topLeft[1]
      ];
    } else if (prediction.bbox) {
      bbox = [...prediction.bbox];
    } else {
      bbox = [0, 0, 0, 0];
    }

    // Extract confidence
    const confidence = prediction.probability ? prediction.probability[0] : 0.9;

    // Extract landmarks
    const landmarks = prediction.landmarks || [];

    // Estimate 3DOF pose from landmarks
    const pose = estimatePose3DOF(landmarks, bbox);

    return createFaceResult({
      bbox,
      landmarks,
      pose,
      confidence,
      id: index
    });
  });
};

// Create BlazeFace pipeline factory
export const createBlazeFacePipeline = (config = {}) => {
  const blazeConfig = createBlazeFaceConfig(config);
  let model = null;
  let tf = null;

  return createPipeline({
    name: 'blazeface',
    capabilities: [
      Capability.FACE_DETECTION,
      Capability.POSE_ESTIMATION_3DOF,
      Capability.LANDMARK_DETECTION
    ],
    performance: createPerformanceProfile({
      fps: 60,
      latency: '10-20ms',
      modelSize: '1.5MB',
      cpuUsage: 'low',
      memoryUsage: 'low',
      batteryImpact: 'low'
    }),

    // Initialize BlazeFace model
    initialize: async (pipelineConfig) => {
      try {
        // Import dependency loader
        const { createTensorFlowLoader } = await import('../utils/dependency-loader.js');
        const tensorFlowLoader = createTensorFlowLoader();

        // Load BlazeFace model with dependencies
        model = await tensorFlowLoader.loadBlazeFace({
          maxFaces: blazeConfig.maxFaces,
          iouThreshold: blazeConfig.iouThreshold,
          scoreThreshold: blazeConfig.scoreThreshold
        });

        // Store reference to TensorFlow.js
        tf = window.tf;

        console.log('✅ BlazeFace pipeline initialized');
        return true;
      } catch (error) {
        throw new Error(`BlazeFace initialization failed: ${error.message}`);
      }
    },

    // Process video frame
    process: async (frame) => {
      if (!model) {
        throw new Error('BlazeFace model not initialized');
      }

      try {
        // Get predictions from BlazeFace
        const predictions = await model.estimateFaces(frame, blazeConfig.returnTensors);
        
        // Convert to standardized format
        const faces = processPredictions(predictions);

        return createAnalysisResult({
          faces,
          confidence: faces.length > 0 ? faces[0].confidence : 0,
          source: 'blazeface'
        });

      } catch (error) {
        throw new Error(`BlazeFace processing failed: ${error.message}`);
      }
    },

    // Cleanup resources
    cleanup: async () => {
      if (model && model.dispose) {
        model.dispose();
        model = null;
      }
      return true;
    },

    // Pipeline health status (standardization)
    getHealthStatus: () => ({
      healthy: !!model,
      runtime: 'browser',
      backend: 'blazeface-legacy',
      modelLoaded: !!model
    }),

    // Check if pipeline is initialized (standardization)
    isInitialized: () => !!model
  });
};

// Legacy compatibility - extract BlazeFace functionality from existing demo
export const extractBlazeFaceFromDemo = (demoWindow) => {
  if (!demoWindow || !demoWindow.model) {
    throw new Error('Demo window or model not available');
  }

  return createPipeline({
    name: 'blazeface-legacy',
    capabilities: [
      Capability.FACE_DETECTION,
      Capability.POSE_ESTIMATION_3DOF,
      Capability.LANDMARK_DETECTION
    ],
    performance: createPerformanceProfile({
      fps: 60,
      latency: '10-20ms',
      modelSize: '1.5MB',
      cpuUsage: 'low'
    }),

    initialize: async () => {
      // Model is already initialized in demo
      return true;
    },

    process: async (frame) => {
      try {
        // Use existing demo's detection function
        const predictions = await demoWindow.model.estimateFaces(frame, false);
        const faces = processPredictions(predictions);

        return createAnalysisResult({
          faces,
          confidence: faces.length > 0 ? faces[0].confidence : 0,
          source: 'blazeface-legacy'
        });
      } catch (error) {
        throw new Error(`Legacy BlazeFace processing failed: ${error.message}`);
      }
    },

    cleanup: async () => {
      // Don't cleanup shared demo resources
      return true;
    }
  });
};

// Utility for 3D pose calibration (from existing demo logic)
export const createPoseCalibrator = () => {
  let neutralPose = null;
  let calibrationSamples = [];
  const sampleCount = 30;

  const addCalibrationSample = (pose) => {
    if (!pose || pose.confidence < 0.5) return false;
    
    calibrationSamples.push({
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll
    });

    if (calibrationSamples.length > sampleCount) {
      calibrationSamples.shift();
    }

    return calibrationSamples.length >= sampleCount;
  };

  const finishCalibration = () => {
    if (calibrationSamples.length < sampleCount) {
      throw new Error('Insufficient calibration samples');
    }

    const avgYaw = calibrationSamples.reduce((sum, s) => sum + s.yaw, 0) / calibrationSamples.length;
    const avgPitch = calibrationSamples.reduce((sum, s) => sum + s.pitch, 0) / calibrationSamples.length;
    const avgRoll = calibrationSamples.reduce((sum, s) => sum + s.roll, 0) / calibrationSamples.length;

    neutralPose = { yaw: avgYaw, pitch: avgPitch, roll: avgRoll };
    calibrationSamples = [];

    return neutralPose;
  };

  const applyCalibratedPose = (rawPose) => {
    if (!neutralPose || !rawPose) return rawPose;

    return createPose3DOF({
      yaw: rawPose.yaw - neutralPose.yaw,
      pitch: rawPose.pitch - neutralPose.pitch,
      roll: rawPose.roll - neutralPose.roll,
      confidence: rawPose.confidence
    });
  };

  return {
    addCalibrationSample,
    finishCalibration,
    applyCalibratedPose,
    isCalibrated: () => neutralPose !== null,
    reset: () => {
      neutralPose = null;
      calibrationSamples = [];
    }
  };
};