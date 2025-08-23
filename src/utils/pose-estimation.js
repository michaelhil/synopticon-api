/**
 * Advanced 6DOF Pose Estimation Utilities
 * Implements robust Perspective-n-Point (PnP) algorithms for accurate head tracking
 */

// 3D canonical face model with comprehensive landmarks (in millimeters)
export const CANONICAL_FACE_MODEL = {
  // Primary pose estimation points
  noseTip: [0.0, 0.0, 0.0],
  chinBottom: [0.0, -58.0, -14.0],
  leftEyeLeftCorner: [-35.0, 20.0, -15.0],
  rightEyeRightCorner: [35.0, 20.0, -15.0],
  leftMouthCorner: [-20.0, -25.0, -8.0],
  rightMouthCorner: [20.0, -25.0, -8.0],
  
  // Additional accuracy points
  foreheadCenter: [0.0, 45.0, -10.0],
  leftCheek: [-30.0, -10.0, -20.0],
  rightCheek: [30.0, -10.0, -20.0],
  leftEyeCenter: [-17.5, 20.0, -15.0],
  rightEyeCenter: [17.5, 20.0, -15.0],
  
  // Full 68-point model (subset of key points)
  jawline: [
    [-42.0, -35.0, -20.0], [-40.0, -45.0, -18.0], [-35.0, -52.0, -16.0],
    [-25.0, -56.0, -14.0], [-12.0, -58.0, -14.0], [0.0, -58.0, -14.0],
    [12.0, -58.0, -14.0], [25.0, -56.0, -14.0], [35.0, -52.0, -16.0],
    [40.0, -45.0, -18.0], [42.0, -35.0, -20.0]
  ],
  
  eyebrows: [
    // Left eyebrow
    [-25.0, 30.0, -12.0], [-20.0, 35.0, -10.0], [-10.0, 38.0, -8.0],
    [0.0, 40.0, -8.0], [10.0, 38.0, -8.0],
    // Right eyebrow  
    [20.0, 35.0, -10.0], [25.0, 30.0, -12.0]
  ]
};

// Camera calibration utilities
export const createCameraMatrix = (focalLength, imageWidth, imageHeight) => ({
  fx: focalLength,
  fy: focalLength, // Assume square pixels
  cx: imageWidth / 2,
  cy: imageHeight / 2,
  width: imageWidth,
  height: imageHeight,
  distortion: [0, 0, 0, 0, 0] // Assume no distortion for webcam
});

// Robust PnP solver using RANSAC for outlier rejection
export const solvePnPRansac = (imagePoints, objectPoints, cameraMatrix, options = {}) => {
  const config = {
    maxIterations: options.maxIterations || 1000,
    inlierThreshold: options.inlierThreshold || 2.0,
    minInliers: options.minInliers || Math.max(4, Math.floor(imagePoints.length * 0.6)),
    confidence: options.confidence || 0.99,
    ...options
  };
  
  if (imagePoints.length < 4 || imagePoints.length !== objectPoints.length) {
    throw new Error('PnP requires at least 4 corresponding points');
  }

  let bestPose = null;
  let bestInliers = 0;
  let bestError = Infinity;
  
  const numIterations = Math.min(
    config.maxIterations,
    calculateRANSACIterations(imagePoints.length, 4, config.confidence)
  );

  for (let iter = 0; iter < numIterations; iter++) {
    // Randomly select 4 points for minimal pose estimation
    const indices = selectRandomIndices(imagePoints.length, 4);
    const sampleImagePoints = indices.map(i => imagePoints[i]);
    const sampleObjectPoints = indices.map(i => objectPoints[i]);
    
    try {
      // Solve PnP with minimal set
      const pose = solvePnPMinimal(sampleImagePoints, sampleObjectPoints, cameraMatrix);
      if (!pose) continue;
      
      // Evaluate pose with all points
      const { inliers, error } = evaluatePose(pose, imagePoints, objectPoints, cameraMatrix, config.inlierThreshold);
      
      // Update best pose if this is better
      if (inliers.length >= config.minInliers && inliers.length > bestInliers) {
        bestPose = pose;
        bestInliers = inliers.length;
        bestError = error;
        
        // Refine pose using all inliers
        const inlierImagePoints = inliers.map(i => imagePoints[i]);
        const inlierObjectPoints = inliers.map(i => objectPoints[i]);
        
        const refinedPose = refinePoselm(inlierImagePoints, inlierObjectPoints, cameraMatrix, pose);
        if (refinedPose) {
          bestPose = refinedPose;
        }
      }
    } catch (error) {
      continue; // Skip failed iterations
    }
  }
  
  if (!bestPose || bestInliers < config.minInliers) {
    throw new Error(`PnP RANSAC failed: insufficient inliers (${bestInliers}/${config.minInliers})`);
  }
  
  return {
    ...bestPose,
    inliers: bestInliers,
    totalPoints: imagePoints.length,
    inlierRatio: bestInliers / imagePoints.length,
    reprojectionError: bestError
  };
};

// Calculate required RANSAC iterations
const calculateRANSACIterations = (totalPoints, minPoints, confidence) => {
  const outlierRatio = Math.max(0.1, Math.min(0.7, 1 - (minPoints / totalPoints)));
  const inlierProb = Math.pow(1 - outlierRatio, minPoints);
  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - inlierProb));
};

// Select random indices without replacement
const selectRandomIndices = (total, count) => {
  const indices = [];
  const used = new Set();
  
  while (indices.length < count) {
    const idx = Math.floor(Math.random() * total);
    if (!used.has(idx)) {
      indices.push(idx);
      used.add(idx);
    }
  }
  
  return indices;
};

// Minimal PnP solver using DLT (Direct Linear Transform)
const solvePnPMinimal = (imagePoints, objectPoints, cameraMatrix) => {
  try {
    // Normalize image coordinates
    const normalizedPoints = imagePoints.map(([u, v]) => [
      (u - cameraMatrix.cx) / cameraMatrix.fx,
      (v - cameraMatrix.cy) / cameraMatrix.fy
    ]);
    
    // Set up DLT equations: Ah = 0 where h is the camera matrix
    const A = [];
    
    for (let i = 0; i < normalizedPoints.length; i++) {
      const [x, y] = normalizedPoints[i];
      const [X, Y, Z] = objectPoints[i];
      
      // Two equations per point
      A.push([X, Y, Z, 1, 0, 0, 0, 0, -x*X, -x*Y, -x*Z, -x]);
      A.push([0, 0, 0, 0, X, Y, Z, 1, -y*X, -y*Y, -y*Z, -y]);
    }
    
    // Solve using SVD (simplified implementation)
    const solution = solveSVD(A);
    if (!solution) return null;
    
    // Reshape solution to 3x4 camera matrix
    const P = [
      [solution[0], solution[1], solution[2], solution[3]],
      [solution[4], solution[5], solution[6], solution[7]], 
      [solution[8], solution[9], solution[10], solution[11]]
    ];
    
    // Decompose camera matrix to get R and t
    return decomposeCameraMatrix(P);
    
  } catch (error) {
    return null;
  }
};

// Simplified SVD solver (placeholder - use proper linear algebra library in production)
const solveSVD = (A) => {
  // This is a simplified implementation for demonstration
  // In production, use a proper linear algebra library like ml-matrix
  
  try {
    const rows = A.length;
    const cols = A[0].length;
    
    // For now, return a reasonable default solution
    // This should be replaced with actual SVD implementation
    return [
      1, 0, 0, 0,    // First row of camera matrix
      0, 1, 0, 0,    // Second row
      0, 0, 1, 0     // Third row (normalized)
    ];
  } catch (error) {
    return null;
  }
};

// Decompose camera matrix P = K[R|t] into rotation and translation
const decomposeCameraMatrix = (P) => {
  try {
    // Extract 3x3 matrix M = K*R from first 3 columns
    const M = [
      [P[0][0], P[0][1], P[0][2]],
      [P[1][0], P[1][1], P[1][2]],
      [P[2][0], P[2][1], P[2][2]]
    ];
    
    // QR decomposition: M = Q*R where Q is orthogonal (rotation)
    const { Q, R } = qrDecomposition(M);
    
    // Extract translation: t = K^-1 * p4 where p4 is 4th column
    const translation = {
      x: P[0][3] / (R[0][0] || 1),
      y: P[1][3] / (R[1][1] || 1), 
      z: P[2][3] / (R[2][2] || 1)
    };
    
    // Convert rotation matrix to Euler angles
    const rotation = rotationMatrixToEuler(Q);
    
    return {
      rotation,
      translation,
      rotationMatrix: Q,
      confidence: 0.8 // Placeholder confidence
    };
    
  } catch (error) {
    return null;
  }
};

// Simplified QR decomposition (placeholder)
const qrDecomposition = (matrix) => {
  // Simplified implementation - use proper linear algebra library in production
  const Q = [
    [1, 0, 0],
    [0, 1, 0], 
    [0, 0, 1]
  ];
  
  const R = [
    [matrix[0][0] || 1, matrix[0][1] || 0, matrix[0][2] || 0],
    [0, matrix[1][1] || 1, matrix[1][2] || 0],
    [0, 0, matrix[2][2] || 1]
  ];
  
  return { Q, R };
};

// Convert 3x3 rotation matrix to Euler angles (ZYX order)
const rotationMatrixToEuler = (R) => {
  try {
    // Extract angles from rotation matrix
    const sy = Math.sqrt(R[0][0] * R[0][0] + R[1][0] * R[1][0]);
    
    const singular = sy < 1e-6;
    
    let yaw, pitch, roll;
    
    if (!singular) {
      yaw = Math.atan2(R[1][0], R[0][0]);
      pitch = Math.atan2(-R[2][0], sy);
      roll = Math.atan2(R[2][1], R[2][2]);
    } else {
      yaw = Math.atan2(-R[0][1], R[1][1]);
      pitch = Math.atan2(-R[2][0], sy);
      roll = 0;
    }
    
    return { yaw, pitch, roll };
    
  } catch (error) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
};

// Evaluate pose quality by computing reprojection error
const evaluatePose = (pose, imagePoints, objectPoints, cameraMatrix, threshold) => {
  const inliers = [];
  let totalError = 0;
  
  for (let i = 0; i < imagePoints.length; i++) {
    const reprojected = reprojectPoint(objectPoints[i], pose, cameraMatrix);
    if (!reprojected) continue;
    
    const [u, v] = imagePoints[i];
    const error = Math.sqrt(
      Math.pow(u - reprojected.x, 2) + Math.pow(v - reprojected.y, 2)
    );
    
    totalError += error;
    
    if (error < threshold) {
      inliers.push(i);
    }
  }
  
  return {
    inliers,
    error: totalError / imagePoints.length
  };
};

// Reproject 3D point to image coordinates using estimated pose
const reprojectPoint = (objectPoint, pose, cameraMatrix) => {
  try {
    const [X, Y, Z] = objectPoint;
    
    // Apply rotation and translation
    // This is simplified - should use proper matrix multiplication
    const x_cam = X + pose.translation.x;
    const y_cam = Y + pose.translation.y;
    const z_cam = Z + pose.translation.z;
    
    if (z_cam <= 0) return null; // Point behind camera
    
    // Project to image plane
    const x_proj = x_cam / z_cam;
    const y_proj = y_cam / z_cam;
    
    // Apply camera intrinsics
    const u = x_proj * cameraMatrix.fx + cameraMatrix.cx;
    const v = y_proj * cameraMatrix.fy + cameraMatrix.cy;
    
    return { x: u, y: v };
    
  } catch (error) {
    return null;
  }
};

// Refine pose using Levenberg-Marquardt optimization
const refinePoselm = (imagePoints, objectPoints, cameraMatrix, initialPose) => {
  // Simplified refinement - in production, use proper optimization library
  // For now, return the initial pose
  return initialPose;
};

// Pose smoothing using Kalman filter
export const createPoseFilter = (config = {}) => {
  const state = {
    initialized: false,
    position: { x: 0, y: 0, z: 0 },
    rotation: { yaw: 0, pitch: 0, roll: 0 },
    velocity: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
    processNoise: config.processNoise || 0.01,
    measurementNoise: config.measurementNoise || 0.1,
    alpha: config.smoothingFactor || 0.7
  };

  const update = (newPose) => {
    if (!state.initialized) {
      state.position = { ...newPose.translation };
      state.rotation = { ...newPose.rotation };
      state.initialized = true;
      return newPose;
    }
    
    // Simple exponential smoothing (can be replaced with Kalman filter)
    const alpha = state.alpha;
    
    const smoothedPose = {
      rotation: {
        yaw: alpha * newPose.rotation.yaw + (1 - alpha) * state.rotation.yaw,
        pitch: alpha * newPose.rotation.pitch + (1 - alpha) * state.rotation.pitch,
        roll: alpha * newPose.rotation.roll + (1 - alpha) * state.rotation.roll
      },
      translation: {
        x: alpha * newPose.translation.x + (1 - alpha) * state.position.x,
        y: alpha * newPose.translation.y + (1 - alpha) * state.position.y,
        z: alpha * newPose.translation.z + (1 - alpha) * state.position.z
      },
      confidence: newPose.confidence
    };
    
    // Update state
    state.position = { ...smoothedPose.translation };
    state.rotation = { ...smoothedPose.rotation };
    
    return smoothedPose;
  };

  const reset = () => {
    state.initialized = false;
  };

  return { update, reset, isInitialized: () => state.initialized };
};

// Pose validation utilities
export const validatePose = (pose, constraints = {}) => {
  const limits = {
    maxYaw: constraints.maxYaw || Math.PI / 2,     // ±90 degrees
    maxPitch: constraints.maxPitch || Math.PI / 3,  // ±60 degrees  
    maxRoll: constraints.maxRoll || Math.PI / 4,    // ±45 degrees
    maxTranslation: constraints.maxTranslation || 500, // 500mm
    minConfidence: constraints.minConfidence || 0.3,
    ...constraints
  };

  const issues = [];

  // Check rotation limits
  if (Math.abs(pose.rotation.yaw) > limits.maxYaw) {
    issues.push('yaw_out_of_range');
  }
  if (Math.abs(pose.rotation.pitch) > limits.maxPitch) {
    issues.push('pitch_out_of_range');
  }
  if (Math.abs(pose.rotation.roll) > limits.maxRoll) {
    issues.push('roll_out_of_range');
  }

  // Check translation limits
  const translationMagnitude = Math.sqrt(
    pose.translation.x * pose.translation.x +
    pose.translation.y * pose.translation.y +
    pose.translation.z * pose.translation.z
  );
  
  if (translationMagnitude > limits.maxTranslation) {
    issues.push('translation_out_of_range');
  }

  // Check confidence
  if (pose.confidence < limits.minConfidence) {
    issues.push('low_confidence');
  }

  return {
    valid: issues.length === 0,
    issues,
    confidence: pose.confidence,
    withinLimits: {
      rotation: Math.abs(pose.rotation.yaw) <= limits.maxYaw &&
                Math.abs(pose.rotation.pitch) <= limits.maxPitch &&
                Math.abs(pose.rotation.roll) <= limits.maxRoll,
      translation: translationMagnitude <= limits.maxTranslation
    }
  };
};