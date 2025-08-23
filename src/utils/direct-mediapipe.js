/**
 * Direct MediaPipe Integration (Simplified)
 * Direct implementation to bypass orchestrator complexity for demo
 */

import { createPose6DOF } from '../core/types.js';
import { createPoseCalibrator } from './pose-calibration.js';

// Create direct MediaPipe face detection
export const createDirectMediaPipe = () => {
  const state = {
    faceMesh: null,
    isInitialized: false,
    poseCalibrator: createPoseCalibrator({
      sampleCount: 20,              // Reduce required samples
      samplingDuration: 3000,       // 3 seconds
      minConfidence: 0.3,           // Lower confidence threshold
      outlierThreshold: 3.0,        // More lenient outlier detection
      autoCalibrationFrames: 60     // 2 seconds at 30fps
    }),
    currentStrategy: 'accuracy_first'
  };

  return createProcessor(state, 'facemesh');
};

// Create direct MediaPipe Iris tracking
export const createDirectIris = () => {
  const state = {
    iris: null,
    isInitialized: false,
    poseCalibrator: createPoseCalibrator({
      sampleCount: 20,
      samplingDuration: 3000,
      minConfidence: 0.3,
      outlierThreshold: 3.0,
      autoCalibrationFrames: 60
    }),
    currentStrategy: 'accuracy_first'
  };

  return createProcessor(state, 'iris');
};

// Generic processor factory
const createProcessor = (state, type) => {

  // Initialize MediaPipe model based on type
  const initialize = async () => {
    try {
      if (type === 'facemesh') {
        // Check if MediaPipe Face Mesh is loaded
        if (typeof window === 'undefined' || !window.FaceMesh) {
          throw new Error('MediaPipe Face Mesh not loaded');
        }

        state.faceMesh = new window.FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          }
        });

        state.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        console.log('✅ Direct MediaPipe Face Mesh initialized');

      } else if (type === 'iris') {
        // MediaPipe Iris is not available via CDN, so we'll use Face Mesh with iris detection
        if (typeof window === 'undefined' || !window.FaceMesh) {
          throw new Error('MediaPipe Face Mesh not loaded (needed for iris tracking)');
        }

        // Use Face Mesh but configure for iris tracking
        state.iris = new window.FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          }
        });

        state.iris.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        console.log('✅ Direct MediaPipe Iris (via Face Mesh) initialized');
      }

      state.isInitialized = true;
      return true;

    } catch (error) {
      console.error(`❌ MediaPipe ${type} initialization failed:`, error);
      return false;
    }
  };

  // Process frame directly
  const processFrame = async (videoElement) => {
    if (!state.isInitialized) {
      // Try to initialize if not ready
      const initialized = await initialize();
      if (!initialized) {
        return { faces: [], error: `MediaPipe ${type} not initialized` };
      }
    }

    return new Promise((resolve) => {
      try {
        if (type === 'facemesh') {
          state.faceMesh.onResults((results) => {
            if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
              const landmarks = results.multiFaceLandmarks[0];
              
              // Create face result with pose estimation
              const face = {
                landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 })),
                pose: estimatePose6DOF(landmarks),
                boundingBox: calculateBoundingBox(landmarks),
                confidence: 0.9 // MediaPipe doesn't provide per-face confidence
              };

              // Apply calibration if available
              if (face.pose && state.poseCalibrator.isCalibrated()) {
                face.pose = state.poseCalibrator.applyCalibratedPose(face.pose, face.landmarks);
              }

              resolve({
                faces: [face],
                pipelineUsed: 'mediapipe-facemesh',
                processingTime: performance.now(),
                enhanced: true
              });
            } else {
              resolve({ faces: [], enhanced: true });
            }
          });

          // Send frame to MediaPipe Face Mesh
          state.faceMesh.send({ image: videoElement });

        } else if (type === 'iris') {
          state.iris.onResults((results) => {
            if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
              const landmarks = results.multiFaceLandmarks[0];
              
              // Create face result with iris tracking data extracted from face mesh
              const face = {
                landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 })),
                pose: estimatePose6DOF(landmarks),
                boundingBox: calculateBoundingBox(landmarks),
                confidence: 0.9,
                // Extract eye tracking from face mesh landmarks
                eyeTracking: extractEyeTrackingFromFaceMesh(landmarks)
              };

              // Apply calibration if available
              if (face.pose && state.poseCalibrator.isCalibrated()) {
                face.pose = state.poseCalibrator.applyCalibratedPose(face.pose, face.landmarks);
              }

              resolve({
                faces: [face],
                pipelineUsed: 'mediapipe-iris',
                processingTime: performance.now(),
                enhanced: true
              });
            } else {
              resolve({ faces: [], enhanced: true });
            }
          });

          // Send frame to MediaPipe Iris (Face Mesh)
          state.iris.send({ image: videoElement });
        }

      } catch (error) {
        console.error(`MediaPipe ${type} processing error:`, error);
        resolve({ faces: [], error: error.message });
      }
    });
  };

  // Estimate 6DOF pose from landmarks
  const estimatePose6DOF = (landmarks) => {
    try {
      // Key landmark indices for MediaPipe Face Mesh (468 points)
      const keyPoints = {
        noseTip: landmarks[1],       // Nose tip
        leftEye: landmarks[33],      // Left eye outer corner  
        rightEye: landmarks[263],    // Right eye outer corner
        leftMouth: landmarks[61],    // Left mouth corner
        rightMouth: landmarks[291],  // Right mouth corner
        chin: landmarks[18],         // Chin center
        forehead: landmarks[10]      // Forehead center
      };

      // Validate key points exist
      if (!keyPoints.noseTip || !keyPoints.leftEye || !keyPoints.rightEye) {
        throw new Error('Missing key landmarks');
      }

      // Calculate face center and dimensions
      const eyeCenterX = (keyPoints.leftEye.x + keyPoints.rightEye.x) / 2;
      const eyeCenterY = (keyPoints.leftEye.y + keyPoints.rightEye.y) / 2;
      
      // Calculate face dimensions for normalization
      const eyeDistance = Math.sqrt(
        Math.pow(keyPoints.rightEye.x - keyPoints.leftEye.x, 2) + 
        Math.pow(keyPoints.rightEye.y - keyPoints.leftEye.y, 2)
      );
      
      const faceHeight = Math.abs(keyPoints.chin.y - keyPoints.forehead.y);

      // Calculate yaw from eye line angle
      const eyeDx = keyPoints.rightEye.x - keyPoints.leftEye.x;
      const eyeDy = keyPoints.rightEye.y - keyPoints.leftEye.y;
      let yaw = Math.atan2(eyeDy, eyeDx);
      
      // Normalize yaw to reasonable range (-π/2 to π/2)
      yaw = Math.max(-Math.PI/2, Math.min(Math.PI/2, yaw));

      // Calculate pitch from nose position relative to eye line
      const noseToEyeY = keyPoints.noseTip.y - eyeCenterY;
      let pitch = Math.atan2(noseToEyeY, eyeDistance * 2) * 1.5; // Scale factor
      
      // Normalize pitch
      pitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, pitch));

      // Calculate roll from face tilt (simplified)
      let roll = yaw * 0.5; // Approximate correlation
      roll = Math.max(-Math.PI/4, Math.min(Math.PI/4, roll));

      // Estimate translation based on face position and size
      const translation = {
        x: (eyeCenterX - 0.5) * 300,  // Horizontal offset in mm
        y: (0.5 - eyeCenterY) * 300,  // Vertical offset (inverted Y)
        z: (0.15 - eyeDistance) * 1000 // Depth estimate from face size
      };

      // Ensure reasonable translation bounds
      translation.x = Math.max(-150, Math.min(150, translation.x));
      translation.y = Math.max(-150, Math.min(150, translation.y));
      translation.z = Math.max(-200, Math.min(200, translation.z));

      const pose = createPose6DOF({
        rotation: { yaw, pitch, roll },
        translation,
        confidence: 0.85
      });

      // Debug logging for first few frames
      if (Math.random() < 0.01) { // 1% of frames
        console.log('Pose estimated:', {
          yaw: (yaw * 180 / Math.PI).toFixed(1) + '°',
          pitch: (pitch * 180 / Math.PI).toFixed(1) + '°',
          roll: (roll * 180 / Math.PI).toFixed(1) + '°',
          translation: {
            x: translation.x.toFixed(1),
            y: translation.y.toFixed(1),
            z: translation.z.toFixed(1)
          },
          eyeDistance: eyeDistance.toFixed(3),
          faceHeight: faceHeight.toFixed(3)
        });
      }

      return pose;

    } catch (error) {
      console.warn('Pose estimation failed:', error);
      return createPose6DOF({
        rotation: { yaw: 0, pitch: 0, roll: 0 },
        translation: { x: 0, y: 0, z: 0 },
        confidence: 0.1
      });
    }
  };

  // Eye tracking calibration state
  const eyeCalibrationState = {
    isCalibrated: false,
    baselineEyePosition: null,
    calibrationSamples: [],
    sampleCount: 30
  };

  // Extract eye tracking information from Face Mesh landmarks
  const extractEyeTrackingFromFaceMesh = (landmarks) => {
    try {
      const eyeTracking = {};

      // More precise iris position estimation using pupil landmarks
      // Left eye: use the center-most landmarks
      const leftPupilCenter = landmarks[468] || landmarks[473]; // These are closer to actual pupil
      const leftEyeInner = landmarks[133];
      const leftEyeOuter = landmarks[33];
      const leftEyeTop = landmarks[159];
      const leftEyeBottom = landmarks[145];
      
      // Right eye: use the center-most landmarks  
      const rightPupilCenter = landmarks[473] || landmarks[468];
      const rightEyeInner = landmarks[362];
      const rightEyeOuter = landmarks[263];
      const rightEyeTop = landmarks[386];
      const rightEyeBottom = landmarks[374];

      // Calculate actual eye aperture centers (not just geometric center)
      const leftEyeRect = {
        centerX: (leftEyeInner.x + leftEyeOuter.x) / 2,
        centerY: (leftEyeTop.y + leftEyeBottom.y) / 2,
        width: leftEyeOuter.x - leftEyeInner.x,
        height: leftEyeBottom.y - leftEyeTop.y
      };

      const rightEyeRect = {
        centerX: (rightEyeInner.x + rightEyeOuter.x) / 2,
        centerY: (rightEyeTop.y + rightEyeBottom.y) / 2,
        width: rightEyeOuter.x - rightEyeInner.x,
        height: rightEyeBottom.y - rightEyeTop.y
      };

      // Use more sophisticated pupil detection
      const leftPupilPos = {
        x: leftPupilCenter ? leftPupilCenter.x : leftEyeRect.centerX,
        y: leftPupilCenter ? leftPupilCenter.y : leftEyeRect.centerY
      };

      const rightPupilPos = {
        x: rightPupilCenter ? rightPupilCenter.x : rightEyeRect.centerX,
        y: rightPupilCenter ? rightPupilCenter.y : rightEyeRect.centerY
      };

      eyeTracking.leftIris = {
        center: leftPupilPos,
        eyeRect: leftEyeRect,
        landmarks: [leftEyeInner, leftEyeOuter, leftEyeTop, leftEyeBottom].map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 }))
      };

      eyeTracking.rightIris = {
        center: rightPupilPos,
        eyeRect: rightEyeRect,
        landmarks: [rightEyeInner, rightEyeOuter, rightEyeTop, rightEyeBottom].map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 }))
      };

      // Eye midpoint for gaze origin
      const eyeMidpointX = (leftPupilPos.x + rightPupilPos.x) / 2;
      const eyeMidpointY = (leftPupilPos.y + rightPupilPos.y) / 2;

      eyeTracking.eyeMidpoint = {
        x: eyeMidpointX,
        y: eyeMidpointY
      };

      // Calculate gaze direction with calibration
      if (eyeCalibrationState.isCalibrated && eyeCalibrationState.baselineEyePosition) {
        // Calculate gaze offset from calibrated baseline
        const leftGazeOffsetX = leftPupilPos.x - eyeCalibrationState.baselineEyePosition.leftPupil.x;
        const leftGazeOffsetY = leftPupilPos.y - eyeCalibrationState.baselineEyePosition.leftPupil.y;
        const rightGazeOffsetX = rightPupilPos.x - eyeCalibrationState.baselineEyePosition.rightPupil.x;
        const rightGazeOffsetY = rightPupilPos.y - eyeCalibrationState.baselineEyePosition.rightPupil.y;

        // Average both eyes and scale for visibility
        const avgGazeOffsetX = (leftGazeOffsetX + rightGazeOffsetX) / 2;
        const avgGazeOffsetY = (leftGazeOffsetY + rightGazeOffsetY) / 2;

        // Scale the gaze vector for visibility (make it longer)
        const gazeScale = 5.0; // Amplification factor
        
        eyeTracking.gazePoint = {
          x: eyeMidpointX + avgGazeOffsetX * gazeScale,
          y: eyeMidpointY + avgGazeOffsetY * gazeScale,
          confidence: 0.9
        };

        eyeTracking.gazeVector = {
          x: avgGazeOffsetX * gazeScale,
          y: avgGazeOffsetY * gazeScale,
          z: 1.0
        };

        // Debug logging
        if (Math.random() < 0.02) {
          console.log('👁️ Calibrated gaze:', {
            leftOffset: { x: leftGazeOffsetX.toFixed(4), y: leftGazeOffsetY.toFixed(4) },
            rightOffset: { x: rightGazeOffsetX.toFixed(4), y: rightGazeOffsetY.toFixed(4) },
            avgOffset: { x: avgGazeOffsetX.toFixed(4), y: avgGazeOffsetY.toFixed(4) },
            gazePoint: { x: eyeTracking.gazePoint.x.toFixed(3), y: eyeTracking.gazePoint.y.toFixed(3) },
            calibrated: true
          });
        }

      } else {
        // Not calibrated - show static default or prompt for calibration
        eyeTracking.gazePoint = {
          x: eyeMidpointX,
          y: eyeMidpointY - 0.1, // Slight upward bias as default
          confidence: 0.3
        };

        eyeTracking.gazeVector = { x: 0, y: -0.1, z: 1.0 };
        eyeTracking.needsCalibration = true;

        // Debug logging for non-calibrated state
        if (Math.random() < 0.02) {
          console.log('👁️ Eye tracking (not calibrated):', {
            leftPupil: { x: leftPupilPos.x.toFixed(3), y: leftPupilPos.y.toFixed(3) },
            rightPupil: { x: rightPupilPos.x.toFixed(3), y: rightPupilPos.y.toFixed(3) },
            eyeMidpoint: { x: eyeMidpointX.toFixed(3), y: eyeMidpointY.toFixed(3) },
            calibrated: false
          });
        }
      }

      return eyeTracking;

    } catch (error) {
      console.warn('Eye tracking extraction failed:', error);
      return {};
    }
  };

  // Eye tracking calibration functions
  const startEyeCalibration = () => {
    eyeCalibrationState.calibrationSamples = [];
    eyeCalibrationState.isCalibrated = false;
    console.log('🎯 Starting eye tracking calibration. Look straight ahead at the camera.');
    return {
      message: 'Look straight ahead at the camera',
      duration: 3000,
      sampleCount: eyeCalibrationState.sampleCount
    };
  };

  const addEyeCalibrationSample = (eyeTrackingData) => {
    if (eyeTrackingData.leftIris && eyeTrackingData.rightIris) {
      eyeCalibrationState.calibrationSamples.push({
        leftPupil: { ...eyeTrackingData.leftIris.center },
        rightPupil: { ...eyeTrackingData.rightIris.center },
        timestamp: Date.now()
      });

      console.log(`📊 Eye calibration sample ${eyeCalibrationState.calibrationSamples.length}/${eyeCalibrationState.sampleCount}`);
      
      return {
        samplesCollected: eyeCalibrationState.calibrationSamples.length,
        samplesRequired: eyeCalibrationState.sampleCount,
        progress: eyeCalibrationState.calibrationSamples.length / eyeCalibrationState.sampleCount
      };
    }
    return { samplesCollected: 0, samplesRequired: eyeCalibrationState.sampleCount, progress: 0 };
  };

  const finishEyeCalibration = () => {
    if (eyeCalibrationState.calibrationSamples.length < 10) {
      throw new Error('Not enough calibration samples collected');
    }

    // Calculate baseline eye position from samples
    const leftPupilX = eyeCalibrationState.calibrationSamples.reduce((sum, s) => sum + s.leftPupil.x, 0) / eyeCalibrationState.calibrationSamples.length;
    const leftPupilY = eyeCalibrationState.calibrationSamples.reduce((sum, s) => sum + s.leftPupil.y, 0) / eyeCalibrationState.calibrationSamples.length;
    const rightPupilX = eyeCalibrationState.calibrationSamples.reduce((sum, s) => sum + s.rightPupil.x, 0) / eyeCalibrationState.calibrationSamples.length;
    const rightPupilY = eyeCalibrationState.calibrationSamples.reduce((sum, s) => sum + s.rightPupil.y, 0) / eyeCalibrationState.calibrationSamples.length;

    eyeCalibrationState.baselineEyePosition = {
      leftPupil: { x: leftPupilX, y: leftPupilY },
      rightPupil: { x: rightPupilX, y: rightPupilY }
    };

    eyeCalibrationState.isCalibrated = true;
    
    console.log('✅ Eye tracking calibration complete:', eyeCalibrationState.baselineEyePosition);
    
    return {
      success: true,
      baseline: eyeCalibrationState.baselineEyePosition,
      samplesUsed: eyeCalibrationState.calibrationSamples.length
    };
  };

  // Calculate centroid of a set of landmarks
  const calculateCentroid = (landmarks) => {
    const sum = landmarks.reduce(
      (acc, lm) => ({
        x: acc.x + lm.x,
        y: acc.y + lm.y,
        z: acc.z + (lm.z || 0)
      }),
      { x: 0, y: 0, z: 0 }
    );

    return {
      x: sum.x / landmarks.length,
      y: sum.y / landmarks.length,
      z: sum.z / landmarks.length
    };
  };

  // Calculate bounding box from landmarks
  const calculateBoundingBox = (landmarks) => {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    landmarks.forEach(lm => {
      minX = Math.min(minX, lm.x);
      minY = Math.min(minY, lm.y);
      maxX = Math.max(maxX, lm.x);
      maxY = Math.max(maxY, lm.y);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Calibration methods with enhanced debugging
  const startCalibration = () => {
    console.log('🎯 Starting calibration...');
    const result = state.poseCalibrator.startCalibration();
    console.log('Calibration started:', result);
    return result;
  };

  const finishCalibration = () => {
    console.log('🎯 Finishing calibration...');
    try {
      const result = state.poseCalibrator.finishCalibration();
      console.log('Calibration finished:', result);
      return result;
    } catch (error) {
      console.error('Calibration finish failed:', error);
      throw error;
    }
  };

  const addCalibrationSample = (pose, landmarks) => {
    const result = state.poseCalibrator.addSample(pose, landmarks);
    if (result.accepted) {
      console.log(`📊 Sample ${result.samplesCollected}/${result.samplesRequired} collected (${(result.progress * 100).toFixed(1)}%)`);
    } else {
      console.log(`❌ Sample rejected: ${result.reason}`);
    }
    return result;
  };

  const setupAutoCalibration = () => {
    console.log('🤖 Setting up auto-calibration...');
    const autoCalibration = state.poseCalibrator.autoCalibrate();
    let frameCount = 0;
    
    return {
      processAutoCalibrationFrame: (pose, landmarks) => {
        frameCount++;
        const result = autoCalibration.processFrame(pose, landmarks);
        
        // Log progress occasionally
        if (frameCount % 30 === 0 || result.status !== 'waiting') {
          console.log(`🤖 Auto-calibration frame ${frameCount}: ${result.status}`, result);
        }
        
        return result;
      },
      getFrameCount: () => frameCount,
      reset: () => { frameCount = 0; }
    };
  };

  const switchStrategy = (strategy) => {
    state.currentStrategy = strategy;
    console.log(`Switched to ${strategy} strategy`);
  };

  return {
    initialize,
    processFrame,
    startCalibration,
    finishCalibration,
    addCalibrationSample,
    setupAutoCalibration,
    switchStrategy,
    getCurrentStrategy: () => state.currentStrategy,
    isCalibrated: () => state.poseCalibrator.isCalibrated(),
    resetCalibration: () => state.poseCalibrator.reset(),
    isInitialized: () => state.isInitialized,
    
    // Eye tracking calibration methods (only for iris pipeline)
    startEyeCalibration: type === 'iris' ? startEyeCalibration : null,
    addEyeCalibrationSample: type === 'iris' ? addEyeCalibrationSample : null,
    finishEyeCalibration: type === 'iris' ? finishEyeCalibration : null,
    resetEyeCalibration: type === 'iris' ? () => {
      eyeCalibrationState.isCalibrated = false;
      eyeCalibrationState.baselineEyePosition = null;
      eyeCalibrationState.calibrationSamples = [];
      console.log('🔄 Eye calibration reset');
    } : null,
    isEyeCalibrated: () => type === 'iris' ? eyeCalibrationState.isCalibrated : false
  };
};

// Fallback BlazeFace implementation
export const createDirectBlazeFace = () => {
  const state = {
    model: null,
    isInitialized: false,
    poseCalibrator: createPoseCalibrator()
  };

  const initialize = async () => {
    try {
      // Load TensorFlow.js and BlazeFace
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not loaded');
      }

      state.model = await blazeface.load();
      state.isInitialized = true;
      console.log('✅ BlazeFace initialized');
      return true;

    } catch (error) {
      console.error('❌ BlazeFace initialization failed:', error);
      return false;
    }
  };

  const processFrame = async (videoElement) => {
    if (!state.isInitialized) {
      await initialize();
    }

    try {
      const predictions = await state.model.estimateFaces(videoElement, false);
      
      if (predictions.length > 0) {
        const prediction = predictions[0];
        
        // Extract landmarks and create simple pose
        const landmarks = prediction.landmarks;
        const pose = estimateSimplePose(landmarks);
        
        return {
          faces: [{
            landmarks: landmarks.map(lm => ({ x: lm[0] / videoElement.videoWidth, y: lm[1] / videoElement.videoHeight })),
            pose,
            boundingBox: {
              x: prediction.topLeft[0] / videoElement.videoWidth,
              y: prediction.topLeft[1] / videoElement.videoHeight,
              width: (prediction.bottomRight[0] - prediction.topLeft[0]) / videoElement.videoWidth,
              height: (prediction.bottomRight[1] - prediction.topLeft[1]) / videoElement.videoHeight
            },
            confidence: prediction.probability[0]
          }],
          pipelineUsed: 'blazeface-direct',
          processingTime: performance.now()
        };
      }

      return { faces: [] };

    } catch (error) {
      console.error('BlazeFace processing error:', error);
      return { faces: [], error: error.message };
    }
  };

  const estimateSimplePose = (landmarks) => {
    // Simple 3DOF pose from BlazeFace landmarks
    const leftEye = landmarks[0];
    const rightEye = landmarks[1];
    const nose = landmarks[2];
    const mouth = landmarks[3];

    const yaw = Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]);
    const pitch = Math.atan2(nose[1] - (leftEye[1] + rightEye[1]) / 2, 100);
    
    return createPose6DOF({
      rotation: { yaw, pitch, roll: yaw * 0.3 },
      translation: { x: 0, y: 0, z: 0 },
      confidence: 0.6
    });
  };

  return {
    initialize,
    processFrame,
    isInitialized: () => state.isInitialized
  };
};

// Multi-pipeline processor that can switch between different MediaPipe models
export const createMultiPipelineProcessor = async () => {
  const processors = {};
  let currentPipeline = 'mediapipe';
  let activeProcessor = null;

  // Initialize available processors
  const initializeProcessors = async () => {
    console.log('🔍 Initializing available processors...');

    // Try to create MediaPipe Face Mesh
    try {
      processors.mediapipe = await createDirectMediaPipe();
      await processors.mediapipe.initialize();
      console.log('✅ MediaPipe Face Mesh ready');
    } catch (error) {
      console.warn('⚠️ MediaPipe Face Mesh not available:', error.message);
    }

    // Try to create MediaPipe Iris
    try {
      processors.iris = await createDirectIris();
      await processors.iris.initialize();
      console.log('✅ MediaPipe Iris ready');
    } catch (error) {
      console.warn('⚠️ MediaPipe Iris not available:', error.message);
    }

    // Try to create BlazeFace
    try {
      processors.blazeface = await createDirectBlazeFace();
      await processors.blazeface.initialize();
      console.log('✅ BlazeFace ready');
    } catch (error) {
      console.warn('⚠️ BlazeFace not available:', error.message);
    }

    // Set initial active processor
    activeProcessor = processors.mediapipe || processors.iris || processors.blazeface || createMockProcessor();
  };

  // Switch between pipelines
  const switchPipeline = (pipeline) => {
    if (processors[pipeline]) {
      currentPipeline = pipeline;
      activeProcessor = processors[pipeline];
      console.log(`🔄 Switched to ${pipeline} pipeline`);
      return true;
    } else {
      console.warn(`⚠️ Pipeline ${pipeline} not available`);
      return false;
    }
  };

  // Initialize all processors
  await initializeProcessors();

  return {
    initialize: async () => true, // Already initialized
    processFrame: async (videoElement) => {
      return activeProcessor ? activeProcessor.processFrame(videoElement) : { faces: [] };
    },
    switchPipeline,
    getCurrentPipeline: () => currentPipeline,
    getAvailablePipelines: () => Object.keys(processors),
    
    // Proxy calibration methods to active processor
    startCalibration: () => activeProcessor?.startCalibration?.() || { duration: 3000, requiredSamples: 20 },
    finishCalibration: () => activeProcessor?.finishCalibration?.() || { success: false },
    addCalibrationSample: (pose, landmarks) => activeProcessor?.addCalibrationSample?.(pose, landmarks) || { accepted: false },
    setupAutoCalibration: () => activeProcessor?.setupAutoCalibration?.() || {
      processAutoCalibrationFrame: () => ({ status: 'waiting' })
    },
    switchStrategy: (strategy) => activeProcessor?.switchStrategy?.(strategy),
    isCalibrated: () => activeProcessor?.isCalibrated?.() || false,
    isInitialized: () => !!activeProcessor,
    
    // Eye tracking calibration methods (proxy to active processor)
    startEyeCalibration: () => activeProcessor?.startEyeCalibration?.() || null,
    addEyeCalibrationSample: (eyeData) => activeProcessor?.addEyeCalibrationSample?.(eyeData) || { accepted: false },
    finishEyeCalibration: () => activeProcessor?.finishEyeCalibration?.() || { success: false },
    resetEyeCalibration: () => activeProcessor?.resetEyeCalibration?.() || null,
    isEyeCalibrated: () => activeProcessor?.isEyeCalibrated?.() || false
  };
};

// Check what's available and create appropriate processor (backwards compatibility)
export const createAvailableProcessor = async () => {
  return createMultiPipelineProcessor();
};

// Mock processor for testing without libraries
const createMockProcessor = () => ({
  initialize: async () => true,
  processFrame: async () => ({
    faces: [{
      landmarks: [],
      pose: createPose6DOF({
        rotation: { 
          yaw: (Math.random() - 0.5) * 0.5, 
          pitch: (Math.random() - 0.5) * 0.3, 
          roll: (Math.random() - 0.5) * 0.2 
        },
        translation: { 
          x: (Math.random() - 0.5) * 50, 
          y: (Math.random() - 0.5) * 30, 
          z: (Math.random() - 0.5) * 20 
        },
        confidence: 0.8 + Math.random() * 0.2
      }),
      boundingBox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      confidence: 0.8 + Math.random() * 0.2
    }],
    pipelineUsed: 'mock',
    processingTime: 10 + Math.random() * 5
  }),
  startCalibration: () => ({ duration: 3000, requiredSamples: 30 }),
  finishCalibration: () => ({ success: true, quality: { rating: 'good' } }),
  setupAutoCalibration: () => ({
    processAutoCalibrationFrame: () => ({ status: 'waiting', reason: 'mock' })
  }),
  switchStrategy: () => {},
  isCalibrated: () => false,
  isInitialized: () => true
});