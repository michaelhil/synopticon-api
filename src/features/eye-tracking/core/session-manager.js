/**
 * Eye Tracking Session Management Module
 * Handles recording and calibration session lifecycle
 */

export const createSessionManager = (state) => {
  // Clean up sessions when device disconnects
  const cleanupDeviceSessions = (deviceId) => {
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
  const createRecordingSession = (deviceId, recordingId, config) => {
    const sessionId = `${deviceId}-${recordingId}`;
    
    const session = {
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

  const updateRecordingSession = (sessionId, updates) => {
    const session = state.recordingSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  };

  const getRecordingSessions = (deviceId = null) => {
    const sessions = Array.from(state.recordingSessions.values());
    return deviceId ? sessions.filter(s => s.deviceId === deviceId) : sessions;
  };

  const findActiveRecordingSession = (deviceId) => {
    const activeSessions = Array.from(state.recordingSessions.values())
      .filter(s => s.deviceId === deviceId && s.status === 'recording');
    
    return activeSessions.length > 0 ? activeSessions[0] : null;
  };

  // Calibration session management
  const createCalibrationSession = (deviceId, calibrationId, config) => {
    const sessionId = `${deviceId}-calibration-${Date.now()}`;
    
    const session = {
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

  const updateCalibrationSession = (sessionId, updates) => {
    const session = state.calibrationSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  };

  const getCalibrationSessions = (deviceId = null) => {
    const sessions = Array.from(state.calibrationSessions.values());
    return deviceId ? sessions.filter(s => s.deviceId === deviceId) : sessions;
  };

  const findActiveCalibrationSession = (deviceId) => {
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