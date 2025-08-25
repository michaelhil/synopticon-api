/**
 * Advanced Pose Calibration System
 * Provides personal calibration for accurate head tracking across users
 */

import { createPose6DOF, createPose3DOF } from '../core/types.js';

// Create personal calibration system
export const createPoseCalibrator = (config = {}) => {
  const state = {
    calibrationData: {
      samples: [],
      neutralPose: null,
      personalOffsets: null,
      facialProportions: null
    },
    config: {
      sampleCount: config.sampleCount || 30,
      samplingDuration: config.samplingDuration || 3000, // 3 seconds
      minConfidence: config.minConfidence || 0.5,
      outlierThreshold: config.outlierThreshold || 2.0, // Standard deviations
      autoCalibrationFrames: config.autoCalibrationFrames || 90, // 3 seconds at 30fps
      ...config
    },
    isCalibrating: false,
    calibrationStartTime: null
  };

  // Start calibration process
  const startCalibration = () => {
    state.isCalibrating = true;
    state.calibrationStartTime = Date.now();
    state.calibrationData.samples = [];
    
    return {
      duration: state.config.samplingDuration,
      requiredSamples: state.config.sampleCount,
      instructions: "Look straight ahead and keep your head still for calibration"
    };
  };

  // Add calibration sample
  const addSample = (pose, landmarks = null) => {
    if (!state.isCalibrating) {
      return { accepted: false, reason: 'not_calibrating' };
    }
    
    const now = Date.now();
    const elapsed = now - state.calibrationStartTime;
    
    // Check if calibration period is over
    if (elapsed > state.config.samplingDuration) {
      return { accepted: false, reason: 'calibration_timeout' };
    }
    
    // Validate pose quality
    if (!pose || pose.confidence < state.config.minConfidence) {
      return { accepted: false, reason: 'low_confidence' };
    }
    
    // Add sample with metadata
    const sample = {
      pose: { ...pose },
      landmarks: landmarks ? [...landmarks] : null,
      timestamp: now,
      confidence: pose.confidence
    };
    
    state.calibrationData.samples.push(sample);
    
    return {
      accepted: true,
      samplesCollected: state.calibrationData.samples.length,
      samplesRequired: state.config.sampleCount,
      progress: state.calibrationData.samples.length / state.config.sampleCount,
      remainingTime: Math.max(0, state.config.samplingDuration - elapsed)
    };
  };

  // Finish calibration and compute neutral pose
  const finishCalibration = () => {
    if (!state.isCalibrating) {
      throw new Error('No calibration in progress');
    }
    
    if (state.calibrationData.samples.length < state.config.sampleCount * 0.5) {
      throw new Error(`Insufficient samples: ${state.calibrationData.samples.length}/${state.config.sampleCount}`);
    }
    
    try {
      // Filter out outliers
      const filteredSamples = filterOutliers(state.calibrationData.samples);
      
      if (filteredSamples.length < 5) {
        throw new Error('Too many outliers in calibration data');
      }
      
      // Compute neutral pose
      state.calibrationData.neutralPose = computeNeutralPose(filteredSamples);
      
      // Compute personal facial proportions if landmarks available
      const samplesWithLandmarks = filteredSamples.filter(s => s.landmarks);
      if (samplesWithLandmarks.length > 0) {
        state.calibrationData.facialProportions = computeFacialProportions(samplesWithLandmarks);
      }
      
      // Compute personal offsets
      state.calibrationData.personalOffsets = computePersonalOffsets(
        filteredSamples, 
        state.calibrationData.neutralPose
      );
      
      state.isCalibrating = false;
      
      return {
        success: true,
        neutralPose: state.calibrationData.neutralPose,
        samplesUsed: filteredSamples.length,
        totalSamples: state.calibrationData.samples.length,
        outliers: state.calibrationData.samples.length - filteredSamples.length,
        facialProportions: state.calibrationData.facialProportions,
        quality: assessCalibrationQuality(filteredSamples)
      };
      
    } catch (error) {
      state.isCalibrating = false;
      throw error;
    }
  };

  // Apply calibration to raw pose
  const applyCalibratedPose = (rawPose, landmarks = null) => {
    if (!state.calibrationData.neutralPose) {
      return rawPose; // No calibration available
    }
    
    try {
      // Apply neutral pose offset
      const calibratedRotation = {
        yaw: rawPose.rotation.yaw - state.calibrationData.neutralPose.rotation.yaw,
        pitch: rawPose.rotation.pitch - state.calibrationData.neutralPose.rotation.pitch,
        roll: rawPose.rotation.roll - state.calibrationData.neutralPose.rotation.roll
      };
      
      // Apply translation offset
      const calibratedTranslation = {
        x: rawPose.translation.x - state.calibrationData.neutralPose.translation.x,
        y: rawPose.translation.y - state.calibrationData.neutralPose.translation.y,
        z: rawPose.translation.z - state.calibrationData.neutralPose.translation.z
      };
      
      // Apply personal corrections if available
      let correctedRotation = calibratedRotation;
      if (state.calibrationData.personalOffsets) {
        correctedRotation = applyPersonalCorrections(
          calibratedRotation, 
          state.calibrationData.personalOffsets
        );
      }
      
      // Apply facial proportion corrections if available
      if (state.calibrationData.facialProportions && landmarks) {
        correctedRotation = applyProportionCorrections(
          correctedRotation,
          landmarks,
          state.calibrationData.facialProportions
        );
      }
      
      // Create calibrated pose
      if (rawPose.rotation && rawPose.translation) {
        // 6DOF pose
        return createPose6DOF({
          rotation: correctedRotation,
          translation: calibratedTranslation,
          confidence: rawPose.confidence
        });
      } else {
        // 3DOF pose  
        return createPose3DOF({
          yaw: correctedRotation.yaw,
          pitch: correctedRotation.pitch,
          roll: correctedRotation.roll,
          confidence: rawPose.confidence
        });
      }
      
    } catch (error) {
      console.warn('Pose calibration failed:', error);
      return rawPose;
    }
  };

  // Auto-calibration for initial setup
  const autoCalibrate = () => {
    const autoCalibrationState = {
      samples: [],
      frameCount: 0,
      startFrame: null
    };
    
    const processFrame = (pose, landmarks = null) => {
      if (!pose || pose.confidence < state.config.minConfidence) {
        return { status: 'waiting', reason: 'low_confidence' };
      }
      
      autoCalibrationState.frameCount++;
      
      // Start collecting after initial frames for stability
      if (autoCalibrationState.frameCount > 30) {
        if (!autoCalibrationState.startFrame) {
          autoCalibrationState.startFrame = autoCalibrationState.frameCount;
        }
        
        // Collect samples over specified duration
        if (autoCalibrationState.frameCount - autoCalibrationState.startFrame < state.config.autoCalibrationFrames) {
          autoCalibrationState.samples.push({
            pose: { ...pose },
            landmarks: landmarks ? [...landmarks] : null,
            timestamp: Date.now(),
            confidence: pose.confidence
          });
          
          const progress = autoCalibrationState.samples.length / state.config.autoCalibrationFrames;
          return { status: 'collecting', progress, samples: autoCalibrationState.samples.length };
        }
        
        // Finish auto-calibration
        if (autoCalibrationState.samples.length >= state.config.autoCalibrationFrames * 0.7) {
          state.calibrationData.samples = autoCalibrationState.samples;
          
          try {
            // Temporarily set calibrating state for finishCalibration
            const wasCalibrating = state.isCalibrating;
            state.isCalibrating = true;
            
            const result = finishCalibration();
            
            // Restore original state (though it should now be false after finishCalibration)
            if (!wasCalibrating) {
              state.isCalibrating = false;
            }
            
            return { status: 'completed', ...result };
          } catch (error) {
            state.isCalibrating = false; // Reset on error
            return { status: 'failed', error: error.message };
          }
        } else {
          return { status: 'failed', error: 'Insufficient stable samples' };
        }
      }
      
      return { status: 'waiting', reason: 'stabilizing' };
    };
    
    return { processFrame };
  };

  // Utility functions
  const filterOutliers = (samples) => {
    if (samples.length < 3) return samples;
    
    // Calculate statistics for each pose component
    const stats = calculatePoseStatistics(samples);
    
    // Filter samples that are within threshold standard deviations
    return samples.filter(sample => {
      const pose = sample.pose;
      
      // Check each rotation component
      const yawZ = Math.abs(pose.rotation.yaw - stats.yaw.mean) / stats.yaw.std;
      const pitchZ = Math.abs(pose.rotation.pitch - stats.pitch.mean) / stats.pitch.std;
      const rollZ = Math.abs(pose.rotation.roll - stats.roll.mean) / stats.roll.std;
      
      // Check translation if available
      let translationOK = true;
      if (pose.translation) {
        const xZ = Math.abs(pose.translation.x - stats.x.mean) / stats.x.std;
        const yZ = Math.abs(pose.translation.y - stats.y.mean) / stats.y.std;
        const zZ = Math.abs(pose.translation.z - stats.z.mean) / stats.z.std;
        translationOK = xZ < state.config.outlierThreshold && 
                       yZ < state.config.outlierThreshold && 
                       zZ < state.config.outlierThreshold;
      }
      
      return yawZ < state.config.outlierThreshold &&
             pitchZ < state.config.outlierThreshold &&
             rollZ < state.config.outlierThreshold &&
             translationOK;
    });
  };

  const calculatePoseStatistics = (samples) => {
    const values = {
      yaw: samples.map(s => s.pose.rotation.yaw),
      pitch: samples.map(s => s.pose.rotation.pitch),
      roll: samples.map(s => s.pose.rotation.roll),
      x: samples.map(s => s.pose.translation?.x || 0),
      y: samples.map(s => s.pose.translation?.y || 0),
      z: samples.map(s => s.pose.translation?.z || 0)
    };
    
    const stats = {};
    for (const [key, vals] of Object.entries(values)) {
      const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
      const std = Math.sqrt(variance);
      
      stats[key] = { mean, std, variance };
    }
    
    return stats;
  };

  const computeNeutralPose = (samples) => {
    const stats = calculatePoseStatistics(samples);
    
    const neutralRotation = {
      yaw: stats.yaw.mean,
      pitch: stats.pitch.mean,
      roll: stats.roll.mean
    };
    
    const neutralTranslation = {
      x: stats.x.mean,
      y: stats.y.mean,
      z: stats.z.mean
    };
    
    return createPose6DOF({
      rotation: neutralRotation,
      translation: neutralTranslation,
      confidence: 1.0
    });
  };

  const computeFacialProportions = (samplesWithLandmarks) => {
    // Calculate average facial proportions from landmarks
    const proportions = {
      eyeDistance: 0,
      noseToMouthDistance: 0,
      faceWidth: 0,
      faceHeight: 0,
      eyeToNoseRatio: 0
    };
    
    // This would analyze landmark positions to determine personal facial geometry
    // Simplified implementation for now
    
    return proportions;
  };

  const computePersonalOffsets = (samples, neutralPose) => {
    // Analyze individual variations to create personal correction factors
    return {
      yawSensitivity: 1.0,
      pitchSensitivity: 1.0,
      rollSensitivity: 1.0,
      translationScale: 1.0
    };
  };

  const applyPersonalCorrections = (rotation, offsets) => {
    return {
      yaw: rotation.yaw * offsets.yawSensitivity,
      pitch: rotation.pitch * offsets.pitchSensitivity,
      roll: rotation.roll * offsets.rollSensitivity
    };
  };

  const applyProportionCorrections = (rotation, landmarks, proportions) => {
    // Apply corrections based on individual facial proportions
    // This would use the person's specific facial geometry to improve accuracy
    return rotation;
  };

  const assessCalibrationQuality = (samples) => {
    const stats = calculatePoseStatistics(samples);
    
    // Lower standard deviation = higher quality
    const avgStd = (stats.yaw.std + stats.pitch.std + stats.roll.std) / 3;
    
    let quality = 'excellent';
    if (avgStd > 0.1) quality = 'good';
    if (avgStd > 0.2) quality = 'fair';
    if (avgStd > 0.3) quality = 'poor';
    
    return {
      rating: quality,
      stability: 1.0 - Math.min(1.0, avgStd / 0.3),
      sampleCount: samples.length,
      avgStandardDeviation: avgStd
    };
  };

  // Public interface
  return {
    // Calibration process
    startCalibration,
    addSample,
    finishCalibration,
    autoCalibrate,
    
    // Pose correction
    applyCalibratedPose,
    
    // State queries
    isCalibrating: () => state.isCalibrating,
    isCalibrated: () => !!state.calibrationData.neutralPose,
    getCalibrationData: () => ({ ...state.calibrationData }),
    
    // Utilities
    reset: () => {
      state.calibrationData = {
        samples: [],
        neutralPose: null,
        personalOffsets: null,
        facialProportions: null
      };
      state.isCalibrating = false;
    },
    
    getConfig: () => ({ ...state.config }),
    setConfig: (newConfig) => {
      state.config = { ...state.config, ...newConfig };
    }
  };
};

// Multi-user calibration system
export const createMultiUserCalibrator = () => {
  const users = new Map();
  let activeUser = null;
  
  const createUser = (userId, config = {}) => {
    const calibrator = createPoseCalibrator(config);
    users.set(userId, calibrator);
    return calibrator;
  };
  
  const selectUser = (userId) => {
    if (!users.has(userId)) {
      throw new Error(`User ${userId} not found`);
    }
    activeUser = userId;
    return users.get(userId);
  };
  
  const getUser = (userId) => {
    return users.get(userId);
  };
  
  const removeUser = (userId) => {
    users.delete(userId);
    if (activeUser === userId) {
      activeUser = null;
    }
  };
  
  const getCurrentCalibrator = () => {
    return activeUser ? users.get(activeUser) : null;
  };
  
  return {
    createUser,
    selectUser,
    getUser,
    removeUser,
    getCurrentCalibrator,
    getActiveUser: () => activeUser,
    getUserList: () => Array.from(users.keys()),
    getUserCount: () => users.size
  };
};

// Calibration persistence utilities
export const createCalibrationStorage = (storage = localStorage) => {
  const STORAGE_KEY = 'face_analysis_calibration';
  
  const save = (userId, calibrationData) => {
    try {
      const stored = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
      stored[userId] = {
        ...calibrationData,
        timestamp: Date.now()
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return true;
    } catch (error) {
      console.warn('Failed to save calibration:', error);
      return false;
    }
  };
  
  const load = (userId) => {
    try {
      const stored = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
      return stored[userId] || null;
    } catch (error) {
      console.warn('Failed to load calibration:', error);
      return null;
    }
  };
  
  const remove = (userId) => {
    try {
      const stored = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
      delete stored[userId];
      storage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return true;
    } catch (error) {
      console.warn('Failed to remove calibration:', error);
      return false;
    }
  };
  
  const clear = () => {
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.warn('Failed to clear calibrations:', error);
      return false;
    }
  };
  
  const listUsers = () => {
    try {
      const stored = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
      return Object.keys(stored);
    } catch (error) {
      console.warn('Failed to list calibrations:', error);
      return [];
    }
  };
  
  return { save, load, remove, clear, listUsers };
};