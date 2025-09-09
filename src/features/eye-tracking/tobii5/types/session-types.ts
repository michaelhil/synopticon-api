/**
 * @fileoverview Type definitions for Multi-User Session Manager
 * Extracted types for better modularity and maintainability
 */

import type { GazeDataPoint, AttentionPrediction } from '@/core/sensors/eye-tracking/index.js';

/**
 * Privacy levels for user sessions
 */
export enum PrivacyLevel {
  PUBLIC = 'public',
  SHARED = 'shared', 
  PRIVATE = 'private',
  ANONYMOUS = 'anonymous'
}

/**
 * User permissions for session management
 */
export interface UserPermissions {
  canViewOthersData: boolean;
  canExportData: boolean;
  canModifySettings: boolean;
  canInviteCollaborators: boolean;
  isAdministrator: boolean;
}

/**
 * Collaboration settings
 */
export interface CollaborationSettings {
  enabled: boolean;
  shareRealTimeGaze: boolean;
  shareAttentionMaps: boolean;
  allowScreenShare: boolean;
  maxCollaborators: number;
}

/**
 * User calibration profile
 */
export interface CalibrationProfile {
  profileId: string;
  deviceId: string;
  calibrationPoints: Array<{ x: number; y: number; accuracy: number }>;
  eyeModel: {
    leftEye: { x: number; y: number; z: number };
    rightEye: { x: number; y: number; z: number };
  };
  accuracy: number;
  timestamp: number;
  version: string;
}

/**
 * User session configuration
 */
export interface UserSession {
  userId: string;
  username: string;
  sessionId: string;
  startTime: number;
  lastActivity: number;
  isActive: boolean;
  calibrationProfile: CalibrationProfile;
  privacyLevel: PrivacyLevel;
  permissions: UserPermissions;
  gazeData: GazeDataPoint[];
  predictions: AttentionPrediction[];
  collaborationSettings: CollaborationSettings;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  maxUsers: number;
  sessionTimeout: number;
  dataRetentionDays: number;
  enableCollaboration: boolean;
  requireCalibration: boolean;
  autoSwitchThreshold: number;
  privacyEnforcement: boolean;
}

/**
 * Session statistics
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  totalGazePoints: number;
  collaborativeSessions: number;
  calibrationAccuracy: number;
}

/**
 * Session event types
 */
export enum SessionEvent {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  SESSION_CREATED = 'session_created',
  SESSION_ENDED = 'session_ended',
  CALIBRATION_UPDATED = 'calibration_updated',
  PRIVACY_CHANGED = 'privacy_changed',
  COLLABORATION_STARTED = 'collaboration_started',
  COLLABORATION_ENDED = 'collaboration_ended'
}

/**
 * Session event data
 */
export interface SessionEventData {
  event: SessionEvent;
  sessionId: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
