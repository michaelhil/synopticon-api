/**
 * Eye Tracking Sensor Integration
 * Unified interface for eye tracking devices and algorithms
 */

import type { FrameData } from '../../common/types';

export interface EyeTrackingConfig {
  device: 'webcam' | 'neon' | 'tobii';
  calibrationRequired: boolean;
  trackingMode: 'gaze' | 'pupil' | 'both';
  smoothing?: number;
}

export interface GazeData {
  timestamp: bigint;
  leftEye: {
    center: [number, number];
    pupil: [number, number];
    gazeVector: [number, number, number];
    confidence: number;
  };
  rightEye: {
    center: [number, number];
    pupil: [number, number];
    gazeVector: [number, number, number];
    confidence: number;
  };
  convergencePoint: [number, number, number];
  overallConfidence: number;
}

// Create mock gaze data for testing
const createMockGazeData = (frameData: FrameData): GazeData => ({
  timestamp: frameData.timestamp,
  leftEye: {
    center: [0.3, 0.4],
    pupil: [0.3, 0.4],
    gazeVector: [0, 0, -1],
    confidence: 0.8
  },
  rightEye: {
    center: [0.7, 0.4],
    pupil: [0.7, 0.4],
    gazeVector: [0, 0, -1],
    confidence: 0.8
  },
  convergencePoint: [0.5, 0.4, -100],
  overallConfidence: 0.8
});

// Factory function for eye tracking sensor
export const createEyeTrackingSensor = (config: EyeTrackingConfig) => {
  let isCalibrated = false;
  let isTracking = false;
  let calibrationData: unknown = null;

  const startCalibration = async (): Promise<boolean> => {
    console.log('Starting eye tracking calibration...');
    isCalibrated = true;
    return true;
  };

  const startTracking = async (): Promise<boolean> => {
    if (config.calibrationRequired && !isCalibrated) {
      throw new Error('Calibration required before starting tracking');
    }
    isTracking = true;
    return true;
  };

  const stopTracking = async (): Promise<void> => {
    isTracking = false;
  };

  const processFrame = async (frameData: FrameData): Promise<GazeData | null> => {
    if (!isTracking) return null;
    return createMockGazeData(frameData);
  };

  return {
    startCalibration,
    startTracking,
    stopTracking,
    processFrame,
    isCalibrated: () => isCalibrated,
    isTracking: () => isTracking,
    getConfig: () => ({ ...config })
  };
};