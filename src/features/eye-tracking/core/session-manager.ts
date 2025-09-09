/**
 * Eye Tracking Session Management Module
 * Handles recording and calibration session lifecycle
 */

// Session types and interfaces
interface SessionConfig {
  [key: string]: any;
}

interface RecordingSession {
  sessionId: string;
  deviceId: string;
  recordingId: string;
  startTime: number;
  status: string;
  config: SessionConfig;
}

interface CalibrationSession {
  sessionId: string;
  deviceId: string;
  calibrationId: string;
  startTime: number;
  status: string;
  config: SessionConfig;
}

interface SessionState {
  recordingSessions: Map<string, RecordingSession>;
  calibrationSessions: Map<string, CalibrationSession>;
}

interface SessionManager {
  cleanupDeviceSessions(deviceId: string): void;
  createRecordingSession(deviceId: string, recordingId: string, config: SessionConfig): RecordingSession;
  updateRecordingSession(sessionId: string, updates: Partial<RecordingSession>): RecordingSession | undefined;
  getRecordingSessions(deviceId?: string | null): RecordingSession[];
  findActiveRecordingSession(deviceId: string): RecordingSession | null;
  createCalibrationSession(deviceId: string, calibrationId: string, config: SessionConfig): CalibrationSession;
  updateCalibrationSession(sessionId: string, updates: Partial<CalibrationSession>): CalibrationSession | undefined;
  getCalibrationSessions(deviceId?: string | null): CalibrationSession[];
  findActiveCalibrationSession(deviceId: string): CalibrationSession | null;
}

export const createSessionManager = (state: SessionState): SessionManager => {
  // Clean up sessions when device disconnects
  const cleanupDeviceSessions = (deviceId: string): void => {
    // Stop any active calibration sessions
    for (const [sessionId, session] of state.calibrationSessions.entries()) {
      if (session.deviceId === deviceId) {
        session.status = 'aborted';
        state.calibrationSessions.delete(sessionId);
      }
    }

    // Stop any active recording sessions
    for (const [sessionId, session] of state.recordingSessions.entries()) {
      if (session.deviceId === deviceId) {
        session.status = 'aborted';
        state.recordingSessions.delete(sessionId);
      }
    }
  };

  // Recording session management
  const createRecordingSession = (deviceId: string, recordingId: string, config: SessionConfig): RecordingSession => {
    const sessionId = `${deviceId}-${recordingId}`;
    
    const session: RecordingSession = {
      sessionId,
      deviceId,
      recordingId,
      startTime: Date.now(),
      status: 'recording',
      config
    };

    state.recordingSessions.set(sessionId, session);
    return session;
  };

  const updateRecordingSession = (sessionId: string, updates: Partial<RecordingSession>): RecordingSession | undefined => {
    const session = state.recordingSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  };

  const getRecordingSessions = (deviceId: string | null = null): RecordingSession[] => {
    const sessions = Array.from(state.recordingSessions.values());
    return deviceId ? sessions.filter(s => s.deviceId === deviceId) : sessions;
  };

  const findActiveRecordingSession = (deviceId: string): RecordingSession | null => {
    const activeSessions = Array.from(state.recordingSessions.values())
      .filter(s => s.deviceId === deviceId && s.status === 'recording');
    
    return activeSessions.length > 0 ? activeSessions[0] : null;
  };

  // Calibration session management
  const createCalibrationSession = (deviceId: string, calibrationId: string, config: SessionConfig): CalibrationSession => {
    const sessionId = `${deviceId}-calibration-${Date.now()}`;
    
    const session: CalibrationSession = {
      sessionId,
      deviceId,
      calibrationId,
      startTime: Date.now(),
      status: 'in_progress',
      config
    };

    state.calibrationSessions.set(sessionId, session);
    return session;
  };

  const updateCalibrationSession = (sessionId: string, updates: Partial<CalibrationSession>): CalibrationSession | undefined => {
    const session = state.calibrationSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  };

  const getCalibrationSessions = (deviceId: string | null = null): CalibrationSession[] => {
    const sessions = Array.from(state.calibrationSessions.values());
    return deviceId ? sessions.filter(s => s.deviceId === deviceId) : sessions;
  };

  const findActiveCalibrationSession = (deviceId: string): CalibrationSession | null => {
    const activeSessions = Array.from(state.calibrationSessions.values())
      .filter(s => s.deviceId === deviceId && s.status === 'in_progress');
    
    return activeSessions.length > 0 ? activeSessions[0] : null;
  };

  return {
    cleanupDeviceSessions,
    createRecordingSession,
    updateRecordingSession,
    getRecordingSessions,
    findActiveRecordingSession,
    createCalibrationSession,
    updateCalibrationSession,
    getCalibrationSessions,
    findActiveCalibrationSession
  };
};