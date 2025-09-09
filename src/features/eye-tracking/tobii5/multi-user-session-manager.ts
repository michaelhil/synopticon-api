/**
 * @fileoverview Multi-User Session Manager for Tobii 5 Eye Tracking
 * 
 * Manages multiple users sharing Tobii 5 devices with session isolation,
 * user authentication, calibration profiles, and data privacy controls.
 * 
 * Features:
 * - Session management with automatic user switching
 * - Per-user calibration profiles and settings
 * - Privacy controls and data isolation
 * - Collaborative features (shared attention heatmaps)
 * - Real-time session monitoring and analytics
 * - Integration with existing distribution system
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type { GazeDataPoint, AttentionPrediction } from '@/core/sensors/eye-tracking/index.js';
import type { DistributionManager } from '@/core/distribution/distribution-manager.js';
import type { AttentionPredictionEngine } from './attention-prediction-engine.js';

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
 * User calibration profile
 */
export interface CalibrationProfile {
  profileId: string;
  deviceId: string;
  calibrationPoints: Array<{ x: number; y: number; accuracy: number }>;
  eyeModel: {
    leftEye: { x: number; y: number; z: number };
    rightEye: { x: number; y: number; z: number };
    ipd: number; // Inter-pupillary distance
  };
  trackingQuality: {
    accuracy: number; // degrees
    precision: number; // pixels RMS
    validationScore: number;
  };
  createdAt: number;
  lastUpdated: number;
  isDefault: boolean;
}

/**
 * Privacy levels for user data
 */
export type PrivacyLevel = 'public' | 'group-only' | 'private' | 'anonymous';

/**
 * User permissions
 */
export interface UserPermissions {
  canViewOtherUsers: boolean;
  canExportData: boolean;
  canModifyROIs: boolean;
  canAccessAnalytics: boolean;
  collaborationLevel: 'none' | 'basic' | 'full';
  dataRetentionDays: number;
}

/**
 * Collaboration settings
 */
export interface CollaborationSettings {
  enableSharedHeatmaps: boolean;
  shareAttentionMetrics: boolean;
  allowRealTimeViewing: boolean;
  groupSessionId?: string;
  followMode: 'none' | 'follow-leader' | 'synchronized';
}

/**
 * Multi-user session statistics
 */
export interface SessionAnalytics {
  totalUsers: number;
  activeUsers: number;
  sessionDuration: number;
  dataPointsCollected: number;
  averageTrackingQuality: number;
  collaborativeInsights: CollaborativeInsights;
}

/**
 * Collaborative insights from multiple users
 */
export interface CollaborativeInsights {
  commonAttentionAreas: Array<{ x: number; y: number; userCount: number; dwellTime: number }>;
  divergentAttentionPatterns: Array<{ area: string; variance: number }>;
  groupCognitiveLoad: { average: number; variance: number; trend: number };
  attentionSynchronization: number; // 0-1 how synchronized users are
}

/**
 * Configuration for multi-user session manager
 */
export interface MultiUserConfig {
  maxConcurrentUsers: number;
  sessionTimeout: number; // milliseconds
  dataRetentionPeriod: number; // milliseconds
  enableCollaboration: boolean;
  privacyEnforcement: 'strict' | 'moderate' | 'lenient';
  autoUserSwitching: boolean;
  calibrationRequired: boolean;
}

/**
 * Creates a multi-user session manager for Tobii 5 devices
 */
export const createTobii5MultiUserSessionManager = (
  distributionManager: DistributionManager,
  config: Partial<MultiUserConfig> = {}
) => {
  // Default configuration
  const {
    maxConcurrentUsers = 10,
    sessionTimeout = 30 * 60 * 1000, // 30 minutes
    dataRetentionPeriod = 7 * 24 * 60 * 60 * 1000, // 7 days
    enableCollaboration = true,
    privacyEnforcement = 'moderate',
    autoUserSwitching = true,
    calibrationRequired = true
  } = config;

  // State management
  const state = {
    activeSessions: new Map<string, UserSession>(),
    userProfiles: new Map<string, CalibrationProfile>(),
    groupSessions: new Map<string, Set<string>>(), // groupId -> userIds
    gazeDataBuffer: new Map<string, GazeDataPoint[]>(),
    sessionAnalytics: new Map<string, SessionAnalytics>(),
    lastCleanup: Date.now(),
    deviceAssignments: new Map<string, string>() // deviceId -> userId
  };

  // Attention prediction engine integration
  let attentionEngine: AttentionPredictionEngine | null = null;

  /**
   * User management utilities
   */
  const userManagement = {
    /**
     * Create a new user session
     */
    createSession: async (
      userId: string,
      username: string,
      permissions: Partial<UserPermissions> = {},
      collaborationSettings: Partial<CollaborationSettings> = {}
    ): Promise<UserSession> => {
      // Check concurrent user limit
      const activeSessionCount = Array.from(state.activeSessions.values())
        .filter(session => session.isActive).length;
      
      if (activeSessionCount >= maxConcurrentUsers) {
        throw new Error(`Maximum concurrent users (${maxConcurrentUsers}) reached`);
      }

      // Generate session ID
      const sessionId = `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get or create calibration profile
      let calibrationProfile = state.userProfiles.get(userId);
      if (!calibrationProfile && calibrationRequired) {
        calibrationProfile = await userManagement.createDefaultCalibrationProfile(userId);
      }

      // Create session
      const session: UserSession = {
        userId,
        username,
        sessionId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
        calibrationProfile: calibrationProfile || await userManagement.createDefaultCalibrationProfile(userId),
        privacyLevel: 'group-only',
        permissions: {
          canViewOtherUsers: false,
          canExportData: false,
          canModifyROIs: false,
          canAccessAnalytics: false,
          collaborationLevel: 'basic',
          dataRetentionDays: 7,
          ...permissions
        },
        gazeData: [],
        predictions: [],
        collaborationSettings: {
          enableSharedHeatmaps: enableCollaboration,
          shareAttentionMetrics: enableCollaboration,
          allowRealTimeViewing: false,
          followMode: 'none',
          ...collaborationSettings
        }
      };

      // Store session
      state.activeSessions.set(sessionId, session);
      state.gazeDataBuffer.set(sessionId, []);

      // Initialize analytics
      state.sessionAnalytics.set(sessionId, {
        totalUsers: 1,
        activeUsers: 1,
        sessionDuration: 0,
        dataPointsCollected: 0,
        averageTrackingQuality: 0,
        collaborativeInsights: {
          commonAttentionAreas: [],
          divergentAttentionPatterns: [],
          groupCognitiveLoad: { average: 0, variance: 0, trend: 0 },
          attentionSynchronization: 0
        }
      });

      // Notify other systems
      distributionManager.broadcast('user-session-created', {
        sessionId,
        userId,
        username,
        timestamp: Date.now()
      });

      return session;
    },

    /**
     * Create default calibration profile
     */
    createDefaultCalibrationProfile: async (userId: string): Promise<CalibrationProfile> => {
      const profileId = `profile_${userId}_${Date.now()}`;
      
      const profile: CalibrationProfile = {
        profileId,
        deviceId: 'tobii5_default',
        calibrationPoints: [
          { x: 0.1, y: 0.1, accuracy: 0.8 },
          { x: 0.5, y: 0.1, accuracy: 0.9 },
          { x: 0.9, y: 0.1, accuracy: 0.8 },
          { x: 0.1, y: 0.5, accuracy: 0.9 },
          { x: 0.5, y: 0.5, accuracy: 0.95 },
          { x: 0.9, y: 0.5, accuracy: 0.9 },
          { x: 0.1, y: 0.9, accuracy: 0.8 },
          { x: 0.5, y: 0.9, accuracy: 0.9 },
          { x: 0.9, y: 0.9, accuracy: 0.8 }
        ],
        eyeModel: {
          leftEye: { x: -30, y: 0, z: 600 },
          rightEye: { x: 30, y: 0, z: 600 },
          ipd: 60
        },
        trackingQuality: {
          accuracy: 0.5, // degrees
          precision: 25, // pixels
          validationScore: 0.85
        },
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        isDefault: true
      };

      state.userProfiles.set(userId, profile);
      return profile;
    },

    /**
     * End user session
     */
    endSession: async (sessionId: string): Promise<void> => {
      const session = state.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.isActive = false;
      session.lastActivity = Date.now();

      // Remove from group sessions
      for (const [groupId, userIds] of state.groupSessions) {
        if (userIds.has(session.userId)) {
          userIds.delete(session.userId);
          if (userIds.size === 0) {
            state.groupSessions.delete(groupId);
          }
        }
      }

      // Release device assignment
      for (const [deviceId, userId] of state.deviceAssignments) {
        if (userId === session.userId) {
          state.deviceAssignments.delete(deviceId);
        }
      }

      // Archive session data based on privacy settings
      if (session.privacyLevel !== 'private') {
        await userManagement.archiveSessionData(session);
      } else {
        // Delete private data immediately
        state.gazeDataBuffer.delete(sessionId);
        session.gazeData = [];
        session.predictions = [];
      }

      // Notify other systems
      distributionManager.broadcast('user-session-ended', {
        sessionId,
        userId: session.userId,
        duration: Date.now() - session.startTime,
        timestamp: Date.now()
      });
    },

    /**
     * Archive session data for retention period
     */
    archiveSessionData: async (session: UserSession): Promise<void> => {
      // In a real implementation, this would save to persistent storage
      // For now, we'll keep it in memory with cleanup
      const archiveKey = `archive_${session.sessionId}`;
      
      // Store compressed session data
      const archiveData = {
        userId: session.userId,
        sessionId: session.sessionId,
        startTime: session.startTime,
        endTime: Date.now(),
        gazeDataSummary: userManagement.summarizeGazeData(session.gazeData),
        predictionsSummary: userManagement.summarizePredictions(session.predictions),
        analytics: state.sessionAnalytics.get(session.sessionId)
      };

      // Schedule cleanup after retention period
      setTimeout(() => {
        // Clean up archived data
        console.log(`Cleaning up archived data for session ${session.sessionId}`);
      }, dataRetentionPeriod);
    },

    /**
     * Summarize gaze data for archival
     */
    summarizeGazeData: (gazeData: GazeDataPoint[]) => {
      if (gazeData.length === 0) return null;

      return {
        totalPoints: gazeData.length,
        duration: gazeData[gazeData.length - 1].timestamp - gazeData[0].timestamp,
        averagePosition: {
          x: gazeData.reduce((sum, point) => sum + point.x, 0) / gazeData.length,
          y: gazeData.reduce((sum, point) => sum + point.y, 0) / gazeData.length
        },
        trackingQuality: {
          validPoints: gazeData.filter(point => point.confidence > 0.7).length,
          averageConfidence: gazeData.reduce((sum, point) => sum + point.confidence, 0) / gazeData.length
        }
      };
    },

    /**
     * Summarize predictions for archival
     */
    summarizePredictions: (predictions: AttentionPrediction[]) => {
      if (predictions.length === 0) return null;

      return {
        totalPredictions: predictions.length,
        averageConfidence: predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length,
        cognitiveLoadAverage: predictions
          .filter(pred => pred.cognitiveMetrics)
          .reduce((sum, pred) => sum + pred.cognitiveMetrics!.cognitiveLoadIndex, 0) / predictions.length
      };
    },

    /**
     * Switch active user (for shared device scenarios)
     */
    switchUser: async (deviceId: string, newUserId: string): Promise<void> => {
      // End current user's session on device
      const currentUserId = state.deviceAssignments.get(deviceId);
      if (currentUserId) {
        const currentSession = Array.from(state.activeSessions.values())
          .find(session => session.userId === currentUserId && session.isActive);
        
        if (currentSession) {
          currentSession.isActive = false;
        }
      }

      // Assign device to new user
      state.deviceAssignments.set(deviceId, newUserId);

      // Load calibration profile for new user
      const calibrationProfile = state.userProfiles.get(newUserId);
      if (calibrationProfile) {
        // Apply calibration to device
        await userManagement.applyCalibration(deviceId, calibrationProfile);
      }

      // Notify systems of user switch
      distributionManager.broadcast('user-switched', {
        deviceId,
        previousUserId: currentUserId,
        newUserId,
        timestamp: Date.now()
      });
    },

    /**
     * Apply calibration profile to device
     */
    applyCalibration: async (deviceId: string, profile: CalibrationProfile): Promise<void> => {
      // In a real implementation, this would communicate with Tobii 5 SDK
      console.log(`Applying calibration profile ${profile.profileId} to device ${deviceId}`);
      
      // Simulate calibration application
      return new Promise(resolve => {
        setTimeout(() => {
          console.log('Calibration applied successfully');
          resolve();
        }, 500);
      });
    }
  };

  /**
   * Collaboration utilities
   */
  const collaboration = {
    /**
     * Create or join group session
     */
    createGroupSession: (groupId: string, userIds: string[]): void => {
      state.groupSessions.set(groupId, new Set(userIds));

      // Update collaboration settings for all users
      for (const userId of userIds) {
        const session = Array.from(state.activeSessions.values())
          .find(s => s.userId === userId && s.isActive);
        
        if (session) {
          session.collaborationSettings.groupSessionId = groupId;
        }
      }

      // Notify group creation
      distributionManager.broadcast('group-session-created', {
        groupId,
        userIds: Array.from(userIds),
        timestamp: Date.now()
      });
    },

    /**
     * Generate shared attention heatmap
     */
    generateSharedHeatmap: (groupId: string, timeWindow: number = 10000): Float32Array => {
      const userIds = state.groupSessions.get(groupId);
      if (!userIds) return new Float32Array();

      // Collect gaze data from all users in group
      const allGazeData: GazeDataPoint[] = [];
      const cutoff = Date.now() - timeWindow;

      for (const userId of userIds) {
        const session = Array.from(state.activeSessions.values())
          .find(s => s.userId === userId && s.isActive);
        
        if (session && session.collaborationSettings.enableSharedHeatmaps) {
          const recentGaze = session.gazeData.filter(point => point.timestamp >= cutoff);
          allGazeData.push(...recentGaze);
        }
      }

      // Generate heatmap (simplified 2D grid)
      const width = 100;
      const height = 100;
      const heatmap = new Float32Array(width * height);
      const sigma = 5; // Gaussian blur sigma

      for (const gazePoint of allGazeData) {
        const x = Math.floor((gazePoint.x / 1920) * width); // Assume 1920x1080 screen
        const y = Math.floor((gazePoint.y / 1080) * height);

        if (x >= 0 && x < width && y >= 0 && y < height) {
          // Apply Gaussian kernel
          for (let dy = -sigma * 2; dy <= sigma * 2; dy++) {
            for (let dx = -sigma * 2; dx <= sigma * 2; dx++) {
              const nx = x + dx;
              const ny = y + dy;

              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
                heatmap[ny * width + nx] += weight * gazePoint.confidence;
              }
            }
          }
        }
      }

      return heatmap;
    },

    /**
     * Calculate collaborative insights
     */
    calculateCollaborativeInsights: (groupId: string): CollaborativeInsights => {
      const userIds = state.groupSessions.get(groupId);
      if (!userIds || userIds.size < 2) {
        return {
          commonAttentionAreas: [],
          divergentAttentionPatterns: [],
          groupCognitiveLoad: { average: 0, variance: 0, trend: 0 },
          attentionSynchronization: 0
        };
      }

      // Get recent gaze data from all users
      const userGazeData = new Map<string, GazeDataPoint[]>();
      const recentWindow = 10000; // 10 seconds
      const cutoff = Date.now() - recentWindow;

      for (const userId of userIds) {
        const session = Array.from(state.activeSessions.values())
          .find(s => s.userId === userId && s.isActive);
        
        if (session) {
          const recentGaze = session.gazeData.filter(point => point.timestamp >= cutoff);
          userGazeData.set(userId, recentGaze);
        }
      }

      // Find common attention areas
      const commonAreas = collaboration.findCommonAttentionAreas(userGazeData);

      // Calculate divergent patterns
      const divergentPatterns = collaboration.calculateDivergentPatterns(userGazeData);

      // Calculate group cognitive load
      const groupCognitiveLoad = collaboration.calculateGroupCognitiveLoad(userIds);

      // Calculate attention synchronization
      const synchronization = collaboration.calculateAttentionSynchronization(userGazeData);

      return {
        commonAttentionAreas: commonAreas,
        divergentAttentionPatterns: divergentPatterns,
        groupCognitiveLoad,
        attentionSynchronization: synchronization
      };
    },

    /**
     * Find common attention areas across users
     */
    findCommonAttentionAreas: (userGazeData: Map<string, GazeDataPoint[]>) => {
      const areas = [];
      const gridSize = 50;
      const threshold = 0.5; // Minimum overlap threshold

      // Create spatial grid
      const grid = new Map<string, { userCount: number; dwellTime: number; users: Set<string> }>();

      for (const [userId, gazeData] of userGazeData) {
        for (const point of gazeData) {
          const gridX = Math.floor(point.x / gridSize);
          const gridY = Math.floor(point.y / gridSize);
          const gridKey = `${gridX},${gridY}`;

          if (!grid.has(gridKey)) {
            grid.set(gridKey, { userCount: 0, dwellTime: 0, users: new Set() });
          }

          const cell = grid.get(gridKey)!;
          if (!cell.users.has(userId)) {
            cell.userCount++;
            cell.users.add(userId);
          }
          cell.dwellTime += 16; // Assume 16ms per sample
        }
      }

      // Find areas with significant overlap
      for (const [gridKey, cell] of grid) {
        const overlapRatio = cell.userCount / userGazeData.size;
        if (overlapRatio >= threshold) {
          const [gridX, gridY] = gridKey.split(',').map(Number);
          areas.push({
            x: gridX * gridSize + gridSize / 2,
            y: gridY * gridSize + gridSize / 2,
            userCount: cell.userCount,
            dwellTime: cell.dwellTime
          });
        }
      }

      return areas.sort((a, b) => b.userCount - a.userCount).slice(0, 10);
    },

    /**
     * Calculate divergent attention patterns
     */
    calculateDivergentPatterns: (userGazeData: Map<string, GazeDataPoint[]>) => {
      const patterns = [];
      
      // Calculate variance in attention for different screen regions
      const regions = [
        { name: 'top-left', bounds: { x: 0, y: 0, width: 480, height: 270 } },
        { name: 'top-right', bounds: { x: 480, y: 0, width: 480, height: 270 } },
        { name: 'bottom-left', bounds: { x: 0, y: 270, width: 480, height: 270 } },
        { name: 'bottom-right', bounds: { x: 480, y: 270, width: 480, height: 270 } },
        { name: 'center', bounds: { x: 240, y: 135, width: 480, height: 270 } }
      ];

      for (const region of regions) {
        const userAttentionInRegion = [];

        for (const [userId, gazeData] of userGazeData) {
          const pointsInRegion = gazeData.filter(point =>
            point.x >= region.bounds.x &&
            point.x < region.bounds.x + region.bounds.width &&
            point.y >= region.bounds.y &&
            point.y < region.bounds.y + region.bounds.height
          );

          const attentionRatio = pointsInRegion.length / Math.max(gazeData.length, 1);
          userAttentionInRegion.push(attentionRatio);
        }

        if (userAttentionInRegion.length > 1) {
          const mean = userAttentionInRegion.reduce((sum, val) => sum + val, 0) / userAttentionInRegion.length;
          const variance = userAttentionInRegion.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / userAttentionInRegion.length;

          patterns.push({
            area: region.name,
            variance: Math.sqrt(variance)
          });
        }
      }

      return patterns.sort((a, b) => b.variance - a.variance);
    },

    /**
     * Calculate group cognitive load metrics
     */
    calculateGroupCognitiveLoad: (userIds: Set<string>) => {
      const cognitiveLoads = [];

      for (const userId of userIds) {
        const session = Array.from(state.activeSessions.values())
          .find(s => s.userId === userId && s.isActive);
        
        if (session && session.predictions.length > 0) {
          const recentPredictions = session.predictions.slice(-10);
          const avgLoad = recentPredictions.reduce((sum, pred) => 
            sum + (pred.cognitiveMetrics?.cognitiveLoadIndex || 0), 0) / recentPredictions.length;
          cognitiveLoads.push(avgLoad);
        }
      }

      if (cognitiveLoads.length === 0) {
        return { average: 0, variance: 0, trend: 0 };
      }

      const average = cognitiveLoads.reduce((sum, load) => sum + load, 0) / cognitiveLoads.length;
      const variance = cognitiveLoads.reduce((sum, load) => sum + Math.pow(load - average, 2), 0) / cognitiveLoads.length;

      // Simple trend calculation (would need historical data for proper trend)
      const trend = 0; // Placeholder

      return { average, variance, trend };
    },

    /**
     * Calculate attention synchronization between users
     */
    calculateAttentionSynchronization: (userGazeData: Map<string, GazeDataPoint[]>): number => {
      const userIds = Array.from(userGazeData.keys());
      if (userIds.length < 2) return 0;

      let totalSynchronization = 0;
      let pairCount = 0;

      for (let i = 0; i < userIds.length; i++) {
        for (let j = i + 1; j < userIds.length; j++) {
          const user1Data = userGazeData.get(userIds[i]) || [];
          const user2Data = userGazeData.get(userIds[j]) || [];

          const sync = collaboration.calculatePairSynchronization(user1Data, user2Data);
          totalSynchronization += sync;
          pairCount++;
        }
      }

      return pairCount > 0 ? totalSynchronization / pairCount : 0;
    },

    /**
     * Calculate synchronization between two users
     */
    calculatePairSynchronization: (user1Data: GazeDataPoint[], user2Data: GazeDataPoint[]): number => {
      if (user1Data.length === 0 || user2Data.length === 0) return 0;

      // Align data by timestamp and calculate spatial correlation
      const timeWindow = 100; // 100ms window for alignment
      let correlationSum = 0;
      let alignmentCount = 0;

      for (const point1 of user1Data) {
        // Find closest point in time from user2
        const closestPoint2 = user2Data.find(point2 => 
          Math.abs(point2.timestamp - point1.timestamp) <= timeWindow
        );

        if (closestPoint2) {
          const distance = Math.sqrt(
            Math.pow(point1.x - closestPoint2.x, 2) + 
            Math.pow(point1.y - closestPoint2.y, 2)
          );

          // Convert distance to correlation (closer = higher correlation)
          const correlation = Math.exp(-distance / 200); // 200px falloff
          correlationSum += correlation;
          alignmentCount++;
        }
      }

      return alignmentCount > 0 ? correlationSum / alignmentCount : 0;
    }
  };

  /**
   * Privacy and security utilities
   */
  const privacy = {
    /**
     * Enforce privacy controls on data access
     */
    enforcePrivacyControls: (requestingUserId: string, targetUserId: string, dataType: string): boolean => {
      const requestingSession = Array.from(state.activeSessions.values())
        .find(s => s.userId === requestingUserId);
      
      const targetSession = Array.from(state.activeSessions.values())
        .find(s => s.userId === targetUserId);

      if (!requestingSession || !targetSession) return false;

      // Self access always allowed
      if (requestingUserId === targetUserId) return true;

      // Check privacy level
      switch (targetSession.privacyLevel) {
      case 'private':
        return false;
        
      case 'group-only':
        // Check if users are in same group
        for (const [groupId, userIds] of state.groupSessions) {
          if (userIds.has(requestingUserId) && userIds.has(targetUserId)) {
            return true;
          }
        }
        return false;
        
      case 'public':
        return requestingSession.permissions.canViewOtherUsers;
        
      case 'anonymous':
        // Allow access to anonymized data
        return dataType === 'anonymized';
        
      default:
        return false;
      }
    },

    /**
     * Anonymize user data
     */
    anonymizeUserData: (data: any): any => {
      // Remove or hash identifying information
      const anonymized = { ...data };
      delete anonymized.userId;
      delete anonymized.username;
      delete anonymized.sessionId;
      
      // Hash or generalize sensitive data
      if (anonymized.gazeData) {
        anonymized.gazeData = anonymized.gazeData.map((point: GazeDataPoint) => ({
          ...point,
          timestamp: Math.floor(point.timestamp / 1000) * 1000 // Round to seconds
        }));
      }

      return anonymized;
    },

    /**
     * Clean up expired data
     */
    cleanupExpiredData: (): void => {
      const now = Date.now();
      const expiredSessions = [];

      for (const [sessionId, session] of state.activeSessions) {
        const timeSinceActivity = now - session.lastActivity;
        
        if (!session.isActive && timeSinceActivity > sessionTimeout) {
          expiredSessions.push(sessionId);
        }
      }

      // Clean up expired sessions
      for (const sessionId of expiredSessions) {
        const session = state.activeSessions.get(sessionId);
        if (session) {
          // Archive or delete based on privacy settings
          if (session.privacyLevel === 'private') {
            // Delete immediately
            state.activeSessions.delete(sessionId);
            state.gazeDataBuffer.delete(sessionId);
            state.sessionAnalytics.delete(sessionId);
          } else {
            // Archive for retention period
            userManagement.archiveSessionData(session);
            state.activeSessions.delete(sessionId);
          }
        }
      }

      state.lastCleanup = now;
    }
  };

  // Periodic cleanup
  setInterval(() => {
    privacy.cleanupExpiredData();
  }, 5 * 60 * 1000); // Every 5 minutes

  // Public API
  return {
    /**
     * Create new user session
     */
    createSession: userManagement.createSession,

    /**
     * End user session
     */
    endSession: userManagement.endSession,

    /**
     * Switch active user on device
     */
    switchUser: userManagement.switchUser,

    /**
     * Process gaze data for user
     */
    processGazeData: (sessionId: string, gazeData: GazeDataPoint): void => {
      const session = state.activeSessions.get(sessionId);
      if (!session || !session.isActive) return;

      // Update last activity
      session.lastActivity = Date.now();

      // Store gaze data
      session.gazeData.push(gazeData);

      // Buffer for real-time processing
      const buffer = state.gazeDataBuffer.get(sessionId) || [];
      buffer.push(gazeData);

      // Keep buffer size manageable
      if (buffer.length > 1000) {
        buffer.shift();
      }

      state.gazeDataBuffer.set(sessionId, buffer);

      // Process with attention engine if available
      if (attentionEngine) {
        const prediction = attentionEngine.processGazeData(gazeData);
        session.predictions.push(prediction);

        // Keep predictions manageable
        if (session.predictions.length > 100) {
          session.predictions.shift();
        }
      }

      // Update analytics
      const analytics = state.sessionAnalytics.get(sessionId);
      if (analytics) {
        analytics.dataPointsCollected++;
        analytics.sessionDuration = Date.now() - session.startTime;
        analytics.averageTrackingQuality = 
          (analytics.averageTrackingQuality + gazeData.confidence) / 2;
      }

      // Broadcast to collaboration if enabled
      if (session.collaborationSettings.allowRealTimeViewing) {
        distributionManager.broadcast('gaze-data-update', {
          userId: session.userId,
          gazeData: privacy.enforcePrivacyControls(session.userId, session.userId, 'gaze') 
            ? gazeData : privacy.anonymizeUserData(gazeData),
          timestamp: Date.now()
        });
      }
    },

    /**
     * Create or join group session
     */
    createGroupSession: collaboration.createGroupSession,

    /**
     * Generate shared heatmap
     */
    generateSharedHeatmap: collaboration.generateSharedHeatmap,

    /**
     * Get collaborative insights
     */
    getCollaborativeInsights: collaboration.calculateCollaborativeInsights,

    /**
     * Get active sessions
     */
    getActiveSessions: (): UserSession[] => {
      return Array.from(state.activeSessions.values()).filter(session => session.isActive);
    },

    /**
     * Get session analytics
     */
    getSessionAnalytics: (sessionId: string): SessionAnalytics | null => {
      return state.sessionAnalytics.get(sessionId) || null;
    },

    /**
     * Integrate with attention prediction engine
     */
    integrateAttentionEngine: (engine: AttentionPredictionEngine): void => {
      attentionEngine = engine;
    },

    /**
     * Update user permissions
     */
    updateUserPermissions: (userId: string, permissions: Partial<UserPermissions>): boolean => {
      const session = Array.from(state.activeSessions.values())
        .find(s => s.userId === userId);
      
      if (session) {
        Object.assign(session.permissions, permissions);
        return true;
      }
      
      return false;
    },

    /**
     * Get system statistics
     */
    getSystemStats: () => ({
      totalActiveSessions: state.activeSessions.size,
      activeUsers: Array.from(state.activeSessions.values()).filter(s => s.isActive).length,
      totalGroupSessions: state.groupSessions.size,
      totalDataPoints: Array.from(state.gazeDataBuffer.values())
        .reduce((sum, buffer) => sum + buffer.length, 0),
      averageSessionDuration: Array.from(state.sessionAnalytics.values())
        .reduce((sum, analytics) => sum + analytics.sessionDuration, 0) / state.sessionAnalytics.size || 0
    })
  };
};
