/**
 * @fileoverview Calibration Manager for Tobii 5 Eye Tracking
 * Extracted from multi-user-session-manager for better modularity
 */

import type { CalibrationProfile, UserSession } from '../types/session-types.js';

export interface CalibrationManagerConfig {
  requiredAccuracy: number;
  maxCalibrationAttempts: number;
  calibrationTimeout: number;
  autoRecalibrationThreshold: number;
}

/**
 * Factory function to create calibration manager
 */
export const createCalibrationManager = (config: CalibrationManagerConfig) => {
  const state = {
    calibrationProfiles: new Map<string, CalibrationProfile>(),
    activeCalibrations: new Map<string, Promise<CalibrationProfile>>(),
    config: {
      requiredAccuracy: 0.8,
      maxCalibrationAttempts: 3,
      calibrationTimeout: 30000,
      autoRecalibrationThreshold: 0.6,
      ...config
    }
  };

  const createCalibrationProfile = async (
    userId: string,
    deviceId: string,
    calibrationPoints: Array<{ x: number; y: number }>
  ): Promise<CalibrationProfile> => {
    const profileId = `cal_${userId}_${deviceId}_${Date.now()}`;
    
    // Mock calibration process - in real implementation, this would
    // interface with actual Tobii SDK
    const calibrationResults = calibrationPoints.map(point => ({
      x: point.x,
      y: point.y,
      accuracy: Math.random() * 0.4 + 0.6 // Random accuracy between 0.6-1.0
    }));

    const profile: CalibrationProfile = {
      profileId,
      deviceId,
      calibrationPoints: calibrationResults,
      eyeModel: {
        leftEye: { x: Math.random(), y: Math.random(), z: Math.random() },
        rightEye: { x: Math.random(), y: Math.random(), z: Math.random() }
      },
      accuracy: calibrationResults.reduce((sum, p) => sum + p.accuracy, 0) / calibrationResults.length,
      timestamp: Date.now(),
      version: '1.0.0'
    };

    state.calibrationProfiles.set(profileId, profile);
    return profile;
  };

  const validateCalibrationAccuracy = (profile: CalibrationProfile): boolean => {
    return profile.accuracy >= state.config.requiredAccuracy;
  };

  const needsRecalibration = (profile: CalibrationProfile): boolean => {
    return profile.accuracy < state.config.autoRecalibrationThreshold ||
           (Date.now() - profile.timestamp) > (7 * 24 * 60 * 60 * 1000); // 7 days
  };

  const getCalibrationProfile = (profileId: string): CalibrationProfile | null => {
    return state.calibrationProfiles.get(profileId) || null;
  };

  const deleteCalibrationProfile = (profileId: string): boolean => {
    return state.calibrationProfiles.delete(profileId);
  };

  const listUserCalibrations = (userId: string): CalibrationProfile[] => {
    return Array.from(state.calibrationProfiles.values())
      .filter(profile => profile.profileId.includes(userId));
  };

  const getCalibrationStats = () => ({
    totalProfiles: state.calibrationProfiles.size,
    averageAccuracy: Array.from(state.calibrationProfiles.values())
      .reduce((sum, p) => sum + p.accuracy, 0) / state.calibrationProfiles.size,
    recentCalibrations: Array.from(state.calibrationProfiles.values())
      .filter(p => (Date.now() - p.timestamp) < (24 * 60 * 60 * 1000)).length
  });

  const cleanup = async (): Promise<void> => {
    state.calibrationProfiles.clear();
    state.activeCalibrations.clear();
  };

  return {
    createCalibrationProfile,
    validateCalibrationAccuracy,
    needsRecalibration,
    getCalibrationProfile,
    deleteCalibrationProfile,
    listUserCalibrations,
    getCalibrationStats,
    cleanup
  };
};
