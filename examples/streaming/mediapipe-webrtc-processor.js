/**
 * MediaPipe WebRTC Processor - JavaScript
 * Client-side MediaPipe integration for real-time video analysis in WebRTC streams
 */

// MediaPipe Face Mesh 468 landmark definitions (comprehensive set)
const FACE_LANDMARKS = {
  // Face outline landmarks
  FACE_OUTLINE: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
    377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ],
  
  // Left eye region (from viewer's perspective - model's right eye)
  LEFT_EYE: {
    outline: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    upper: [246, 161, 160, 159, 158, 157, 173],
    lower: [33, 7, 163, 144, 145, 153, 154, 155, 133],
    inner_corner: 133,
    outer_corner: 33,
    center: 468, // Iris center (if available)
    pupil: 468
  },
  
  // Right eye region (from viewer's perspective - model's left eye)
  RIGHT_EYE: {
    outline: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    upper: [398, 384, 385, 386, 387, 388, 466],
    lower: [362, 382, 381, 380, 374, 373, 390, 249, 263],
    inner_corner: 362,
    outer_corner: 263,
    center: 473, // Iris center (if available)
    pupil: 473
  },
  
  // Eyebrow landmarks
  LEFT_EYEBROW: [46, 53, 52, 51, 48, 115, 131, 134, 102, 49, 220, 305],
  RIGHT_EYEBROW: [276, 283, 282, 295, 285, 336, 296, 334, 293, 300, 276, 283],
  
  // Nose landmarks (detailed)
  NOSE: {
    tip: 1,
    bridge: [6, 8, 9, 10, 151],
    left_wing: [31, 228, 229, 230, 231, 232, 233, 244, 245, 122, 6],
    right_wing: [461, 414, 435, 410, 454, 430, 394, 392, 351, 349, 348],
    bottom: [2, 97, 99, 1, 19, 94, 2],
    left_ala: 31,
    right_ala: 461,
    left_nostril: 20,
    right_nostril: 250
  },
  
  // Mouth landmarks (detailed)
  MOUTH: {
    outer: [61, 146, 91, 181, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318],
    upper: [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318],
    lower: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415],
    inner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415],
    corners: [61, 291],
    center_upper: 13,
    center_lower: 14
  },
  
  // Forehead landmarks
  FOREHEAD: [10, 151, 9, 8, 107, 55, 8, 9, 151, 10],
  
  // Cheek landmarks
  LEFT_CHEEK: [116, 117, 118, 119, 120, 121, 126, 142, 36, 205, 206, 207, 213, 192, 147],
  RIGHT_CHEEK: [345, 346, 347, 348, 349, 350, 451, 452, 453, 464, 435, 410, 454],
  
  // Jaw landmarks
  JAW: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323],
  
  // Chin point
  CHIN: 175,
  
  // Key reference points for pose estimation
  POSE_POINTS: {
    nose_tip: 1,
    left_eye_center: 263,
    right_eye_center: 33,
    mouth_center: 13,
    chin: 175,
    forehead_center: 9
  }
};

/**
 * Create MediaPipe WebRTC Processor
 * Factory function following existing architectural patterns
 */
export const createMediaPipeWebRTCProcessor = (config = {}) => {
  // Default configuration with quality adaptation
  const defaultConfig = {
    capabilities: ['face_detection', 'face_landmarks', 'pose_estimation_3dof'],
    quality: 'medium',
    adaptiveProcessing: true,
    targetFPS: 30,
    cpuThreshold: 0.8,
    batteryOptimized: false,
    enablePerformanceMonitoring: true
  };

  const finalConfig = { ...defaultConfig, ...config };
  
  // Internal state
  let faceMesh = null;
  let isInitialized = false;
  let isProcessing = false;
  let processingCanvas = null;
  let processingContext = null;
  
  // Performance monitoring
  let frameCount = 0;
  let lastFPSUpdate = performance.now();
  let currentFPS = 0;
  let averageProcessingTime = 0;
  const cpuUsage = 0;
  
  // Quality adaptation state
  let currentQuality = finalConfig.quality;
  let adaptationCounter = 0;
  
  // Event callbacks
  const callbacks = {
    onAnalysis: [],
    onError: [],
    onQualityChange: [],
    onPerformance: []
  };

  /**
   * Initialize MediaPipe Face Mesh
   */
  const initialize = async () => {
    try {
      if (isInitialized) {
        return true;
      }

      // Check MediaPipe availability with detailed diagnostics
      if (typeof window === 'undefined') {
        throw new Error('Window object not available - running in non-browser environment');
      }
      
      // Try to find FaceMesh constructor in different locations
      let FaceMeshConstructor = null;
      
      if (window.FaceMesh) {
        FaceMeshConstructor = window.FaceMesh;
      } else if (window.MediaPipe && window.MediaPipe.FaceMesh) {
        FaceMeshConstructor = window.MediaPipe.FaceMesh;
      } else if (window.mediapipe && window.mediapipe.FaceMesh) {
        FaceMeshConstructor = window.mediapipe.FaceMesh;
      }
      
      if (!FaceMeshConstructor) {
        const availableObjects = Object.getOwnPropertyNames(window).filter(key => 
          key.toLowerCase().includes('mediapipe') || 
          key.toLowerCase().includes('face') ||
          key.toLowerCase().includes('camera') ||
          key.includes('Mesh') ||
          key.includes('Face')
        );
        throw new Error(
          `MediaPipe FaceMesh constructor not found. Available objects: ${availableObjects.join(', ')}. ` +
          `Checked locations: window.FaceMesh, window.MediaPipe.FaceMesh, window.mediapipe.FaceMesh`
        );
      }

      // Create processing canvas for frame extraction
      processingCanvas = document.createElement('canvas');
      processingContext = processingCanvas.getContext('2d');
      
      if (!processingContext) {
        throw new Error('Failed to create canvas context for MediaPipe processing');
      }

      // Initialize MediaPipe Face Mesh using the found constructor
      faceMesh = new FaceMeshConstructor({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      // Set initial options based on quality
      updateMediaPipeOptions(currentQuality);
      
      // Set up result callback
      faceMesh.onResults(handleMediaPipeResults);
      
      // Initialize MediaPipe
      await faceMesh.initialize();
      
      isInitialized = true;
      console.log('🎯 MediaPipe WebRTC Processor initialized');
      
      return true;
      
    } catch (_error) {
      console.error('MediaPipe initialization error:', error);
      callbacks.onError.forEach(callback => callback(_error));
      return false;
    }
  };

  /**
   * Update MediaPipe options based on quality setting
   */
  const updateMediaPipeOptions = (quality) => {
    if (!faceMesh) return;

    const optionsMap = {
      low: {
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
      },
      medium: {
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      },
      high: {
        maxNumFaces: 2,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      },
      ultra: {
        maxNumFaces: 3,
        refineLandmarks: true,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.8
      }
    };

    faceMesh.setOptions(optionsMap[quality]);
  };

  /**
   * Process video frame through MediaPipe
   */
  const processFrame = async (video) => {
    if (!isInitialized || !faceMesh || !processingCanvas || !processingContext) {
      throw new Error('MediaPipe processor not initialized');
    }

    if (isProcessing) {
      return; // Skip frame if still processing
    }

    try {
      isProcessing = true;
      const startTime = performance.now();

      // Update canvas dimensions to match video
      if (processingCanvas.width !== video.videoWidth || processingCanvas.height !== video.videoHeight) {
        processingCanvas.width = video.videoWidth;
        processingCanvas.height = video.videoHeight;
      }

      // Draw video frame to canvas for MediaPipe processing
      processingContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      // Send frame to MediaPipe
      await faceMesh.send({ image: processingCanvas });
      
      // Update performance metrics
      const processingTime = performance.now() - startTime;
      updatePerformanceMetrics(processingTime);
      
      // Adaptive quality control
      if (finalConfig.adaptiveProcessing) {
        adaptQuality();
      }
      
    } catch (_error) {
      console.error('Frame processing error:', error);
      callbacks.onError.forEach(callback => callback(_error));
    } finally {
      isProcessing = false;
    }
  };

  /**
   * Handle MediaPipe analysis results
   */
  const handleMediaPipeResults = (results) => {
    try {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        return; // No faces detected
      }

      const landmarks = results.multiFaceLandmarks[0]; // Process first face
      
      // Extract landmarks in system format
      const faceLandmarks = extractFaceLandmarks(landmarks);
      
      // Calculate 3DOF head pose
      const headPose = calculateHeadPose(landmarks, faceLandmarks.boundingBox);
      
      // Basic emotion analysis (simplified)
      const emotions = analyzeBasicEmotions(landmarks);
      
      // Calculate confidence based on landmark quality
      const confidence = calculateConfidence(landmarks);
      
      // Create analysis result
      const analysisResult = {
        landmarks: faceLandmarks,
        pose: headPose,
        emotions,
        confidence,
        timestamp: performance.now(),
        performance: {
          processingTime: averageProcessingTime,
          fps: currentFPS
        }
      };

      // Emit analysis result to callbacks
      callbacks.onAnalysis.forEach(callback => callback(analysisResult));
      
    } catch (_error) {
      console.error('Results handling error:', error);
      callbacks.onError.forEach(callback => callback(_error));
    }
  };

  /**
   * Extract face landmarks in system format with comprehensive landmark mapping
   */
  const extractFaceLandmarks = (landmarks) => {
    // Calculate bounding box from face outline landmarks
    const outlinePoints = FACE_LANDMARKS.FACE_OUTLINE.map(idx => landmarks[idx]);
    const xs = outlinePoints.map(p => p.x);
    const ys = outlinePoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    // Extract comprehensive key points
    const keyPoints = {
      // Eye centers
      leftEye: landmarks[FACE_LANDMARKS.POSE_POINTS.left_eye_center],
      rightEye: landmarks[FACE_LANDMARKS.POSE_POINTS.right_eye_center],
      
      // Eye corners
      leftEyeInner: landmarks[FACE_LANDMARKS.LEFT_EYE.inner_corner],
      leftEyeOuter: landmarks[FACE_LANDMARKS.LEFT_EYE.outer_corner],
      rightEyeInner: landmarks[FACE_LANDMARKS.RIGHT_EYE.inner_corner],
      rightEyeOuter: landmarks[FACE_LANDMARKS.RIGHT_EYE.outer_corner],
      
      // Nose points
      noseTip: landmarks[FACE_LANDMARKS.POSE_POINTS.nose_tip],
      noseBridge: landmarks[FACE_LANDMARKS.NOSE.bridge[2]], // Center of bridge
      leftNostril: landmarks[FACE_LANDMARKS.NOSE.left_nostril],
      rightNostril: landmarks[FACE_LANDMARKS.NOSE.right_nostril],
      
      // Mouth points
      mouthCenter: landmarks[FACE_LANDMARKS.POSE_POINTS.mouth_center],
      mouthLeft: landmarks[FACE_LANDMARKS.MOUTH.corners[0]],
      mouthRight: landmarks[FACE_LANDMARKS.MOUTH.corners[1]],
      mouthUpperCenter: landmarks[FACE_LANDMARKS.MOUTH.center_upper],
      mouthLowerCenter: landmarks[FACE_LANDMARKS.MOUTH.center_lower],
      
      // Face structure
      chin: landmarks[FACE_LANDMARKS.CHIN],
      foreheadCenter: landmarks[FACE_LANDMARKS.POSE_POINTS.forehead_center],
      
      // Eyebrows
      leftEyebrow: FACE_LANDMARKS.LEFT_EYEBROW.map(idx => landmarks[idx]),
      rightEyebrow: FACE_LANDMARKS.RIGHT_EYEBROW.map(idx => landmarks[idx])
    };

    // Organize landmarks by facial regions - safely handle undefined indices
    const landmarkRegions = {
      faceOutline: FACE_LANDMARKS.FACE_OUTLINE.map(idx => landmarks[idx]).filter(p => p),
      leftEye: FACE_LANDMARKS.LEFT_EYE.outline.map(idx => landmarks[idx]).filter(p => p),
      rightEye: FACE_LANDMARKS.RIGHT_EYE.outline.map(idx => landmarks[idx]).filter(p => p),
      leftEyebrow: FACE_LANDMARKS.LEFT_EYEBROW.map(idx => landmarks[idx]).filter(p => p),
      rightEyebrow: FACE_LANDMARKS.RIGHT_EYEBROW.map(idx => landmarks[idx]).filter(p => p),
      nose: [
        ...FACE_LANDMARKS.NOSE.bridge.map(idx => landmarks[idx]).filter(p => p),
        ...FACE_LANDMARKS.NOSE.left_wing.map(idx => landmarks[idx]).filter(p => p),
        ...FACE_LANDMARKS.NOSE.right_wing.map(idx => landmarks[idx]).filter(p => p)
      ],
      mouth: FACE_LANDMARKS.MOUTH.outer.map(idx => landmarks[idx]).filter(p => p),
      leftCheek: FACE_LANDMARKS.LEFT_CHEEK.map(idx => landmarks[idx]).filter(p => p),
      rightCheek: FACE_LANDMARKS.RIGHT_CHEEK.map(idx => landmarks[idx]).filter(p => p),
      jaw: FACE_LANDMARKS.JAW.map(idx => landmarks[idx]).filter(p => p)
    };

    // Debug logging
    console.log('MediaPipe landmark extraction:', {
      totalLandmarks: landmarks.length,
      regionCounts: Object.entries(landmarkRegions).map(([name, points]) => `${name}:${points.length}`).join(' ')
    });

    return {
      // All 468 landmarks
      points: landmarks.map((p, idx) => ({
        x: p.x,
        y: p.y,
        z: p.z,
        visibility: 1.0,
        index: idx
      })),
      boundingBox,
      keyPoints,
      regions: landmarkRegions,
      totalLandmarks: landmarks.length
    };
  };

  /**
   * Calculate 3DOF head pose from landmarks
   */
  const calculateHeadPose = (landmarks, bbox) => {
    try {
      const rightEye = landmarks[FACE_LANDMARKS.RIGHT_EYE];
      const leftEye = landmarks[FACE_LANDMARKS.LEFT_EYE];
      const noseTip = landmarks[FACE_LANDMARKS.NOSE_TIP];
      const chin = landmarks[FACE_LANDMARKS.CHIN];

      // Calculate face center and dimensions
      const faceCenter = {
        x: (rightEye.x + leftEye.x) / 2,
        y: (rightEye.y + leftEye.y) / 2
      };

      const eyeDistance = Math.sqrt(
        Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
      );

      // Yaw calculation (left-right rotation)
      const noseCenterOffset = noseTip.x - faceCenter.x;
      const yaw = Math.atan2(noseCenterOffset, eyeDistance) * (180 / Math.PI);

      // Pitch calculation (up-down rotation)
      const noseVerticalOffset = noseTip.y - faceCenter.y;
      const faceHeight = Math.abs(chin.y - faceCenter.y);
      const pitch = Math.atan2(noseVerticalOffset, faceHeight) * (180 / Math.PI);

      // Roll calculation (head tilt)
      const eyeAngle = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);
      const roll = eyeAngle * (180 / Math.PI);

      // Calculate confidence based on landmark stability
      const confidence = Math.min(1.0, eyeDistance / (bbox.width * 0.3));

      return {
        yaw: Math.max(-90, Math.min(90, yaw)),
        pitch: Math.max(-60, Math.min(60, pitch)),
        roll: Math.max(-45, Math.min(45, roll)),
        confidence: Math.max(0.1, confidence)
      };
      
    } catch (_error) {
      return {
        yaw: 0,
        pitch: 0,
        roll: 0,
        confidence: 0
      };
    }
  };

  /**
   * Basic emotion analysis from facial landmarks
   */
  const analyzeBasicEmotions = (landmarks) => {
    try {
      const mouthLeft = landmarks[FACE_LANDMARKS.MOUTH_LEFT];
      const mouthRight = landmarks[FACE_LANDMARKS.MOUTH_RIGHT];
      const mouthCenter = landmarks[FACE_LANDMARKS.MOUTH_CENTER];
      
      // Simple mouth curve analysis
      const mouthCurvature = (mouthLeft.y + mouthRight.y) / 2 - mouthCenter.y;
      
      // Basic emotion scoring
      const isSmiling = mouthCurvature < -0.01;
      
      return {
        neutral: isSmiling ? 0.3 : 0.7,
        happy: isSmiling ? 0.6 : 0.1,
        sad: isSmiling ? 0.1 : 0.2,
        angry: 0.0,
        fearful: 0.0,
        disgusted: 0.0,
        surprised: 0.0
      };
      
    } catch (_error) {
      return {
        neutral: 1.0,
        happy: 0.0,
        sad: 0.0,
        angry: 0.0,
        fearful: 0.0,
        disgusted: 0.0,
        surprised: 0.0
      };
    }
  };

  /**
   * Calculate confidence based on landmark quality
   */
  const calculateConfidence = (landmarks) => {
    try {
      const validLandmarks = landmarks.filter(p => 
        p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
      );
      
      const completeness = validLandmarks.length / landmarks.length;
      return Math.max(0.1, Math.min(1.0, completeness));
      
    } catch (_error) {
      return 0.1;
    }
  };

  /**
   * Update performance metrics
   */
  const updatePerformanceMetrics = (processingTime) => {
    frameCount++;
    averageProcessingTime = (averageProcessingTime * 0.9) + (processingTime * 0.1);
    
    const now = performance.now();
    if (now - lastFPSUpdate > 1000) {
      currentFPS = frameCount;
      frameCount = 0;
      lastFPSUpdate = now;
      
      if (finalConfig.enablePerformanceMonitoring) {
        callbacks.onPerformance.forEach(callback => callback({
          fps: currentFPS,
          processingTime: averageProcessingTime,
          cpuUsage
        }));
      }
    }
  };

  /**
   * Adaptive quality control
   */
  const adaptQuality = () => {
    adaptationCounter++;
    
    if (adaptationCounter % 30 !== 0) return;
    
    const targetProcessingTime = 1000 / finalConfig.targetFPS;
    const isOverloaded = averageProcessingTime > targetProcessingTime * 1.5;
    const isUnderUtilized = averageProcessingTime < targetProcessingTime * 0.5;
    
    let newQuality = currentQuality;
    
    if (isOverloaded && currentQuality !== 'low') {
      const qualityLevels = ['low', 'medium', 'high', 'ultra'];
      const currentIndex = qualityLevels.indexOf(currentQuality);
      newQuality = qualityLevels[Math.max(0, currentIndex - 1)];
      
    } else if (isUnderUtilized && currentQuality !== 'ultra') {
      const qualityLevels = ['low', 'medium', 'high', 'ultra'];
      const currentIndex = qualityLevels.indexOf(currentQuality);
      newQuality = qualityLevels[Math.min(qualityLevels.length - 1, currentIndex + 1)];
    }
    
    if (newQuality !== currentQuality) {
      currentQuality = newQuality;
      updateMediaPipeOptions(currentQuality);
      callbacks.onQualityChange.forEach(callback => callback(currentQuality));
      console.log(`🎯 MediaPipe quality adapted to: ${currentQuality}`);
    }
  };

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    if (faceMesh) {
      faceMesh.close();
      faceMesh = null;
    }
    
    if (processingCanvas) {
      processingCanvas.remove();
      processingCanvas = null;
      processingContext = null;
    }
    
    isInitialized = false;
    isProcessing = false;
    
    callbacks.onAnalysis.length = 0;
    callbacks.onError.length = 0;
    callbacks.onQualityChange.length = 0;
    callbacks.onPerformance.length = 0;
    
    console.log('🎯 MediaPipe WebRTC Processor cleaned up');
  };

  // Public interface
  return {
    initialize,
    processFrame,
    cleanup,
    
    getConfig: () => ({ ...finalConfig }),
    updateConfig: (newConfig) => {
      Object.assign(finalConfig, newConfig);
      if (newConfig.quality && newConfig.quality !== currentQuality) {
        currentQuality = newConfig.quality;
        updateMediaPipeOptions(currentQuality);
      }
    },
    
    getStatus: () => ({
      isInitialized,
      isProcessing,
      currentQuality,
      performance: {
        fps: currentFPS,
        processingTime: averageProcessingTime,
        cpuUsage
      }
    }),
    
    onAnalysis: (callback) => {
      callbacks.onAnalysis.push(callback);
      return () => {
        const index = callbacks.onAnalysis.indexOf(callback);
        if (index > -1) callbacks.onAnalysis.splice(index, 1);
      };
    },
    
    onError: (callback) => {
      callbacks.onError.push(callback);
      return () => {
        const index = callbacks.onError.indexOf(callback);
        if (index > -1) callbacks.onError.splice(index, 1);
      };
    },
    
    onQualityChange: (callback) => {
      callbacks.onQualityChange.push(callback);
      return () => {
        const index = callbacks.onQualityChange.indexOf(callback);
        if (index > -1) callbacks.onQualityChange.splice(index, 1);
      };
    },
    
    onPerformance: (callback) => {
      callbacks.onPerformance.push(callback);
      return () => {
        const index = callbacks.onPerformance.indexOf(callback);
        if (index > -1) callbacks.onPerformance.splice(index, 1);
      };
    }
  };
};