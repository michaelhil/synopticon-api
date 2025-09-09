/**
 * Eye Tracking Recording Control Module
 * Handles recording start/stop operations and progress tracking
 */

export const createRecordingController = (state, sessionManager, eventNotifier) => {
  // Recording Control API
  const startRecording = async (deviceId, recordingConfig = {}) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const recordingId = recordingConfig.recordingId || `recording-${Date.now()}`;

    // Start recording on device
    const result = await deviceInfo.device.startRecording(recordingId, recordingConfig);
    
    if (result.success) {
      // Track recording session
      const session = sessionManager.createRecordingSession(deviceId, recordingId, recordingConfig);

      // Notify progress callbacks
      eventNotifier.notifyRecordingProgress({
        event: 'started',
        sessionId: session.sessionId,
        deviceId,
        recordingId,
        timestamp: Date.now()
      });
    }

    return { 
      success: result.success, 
      sessionId: result.success ? `${deviceId}-${recordingId}` : null,
      recordingId 
    };
  };

  const stopRecording = async (deviceId, sessionId = null) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    // Find session if not provided
    if (!sessionId) {
      const activeSession = sessionManager.findActiveRecordingSession(deviceId);
      if (!activeSession) {
        throw new Error('No active recording session found');
      }
      sessionId = activeSession.sessionId;
    }

    const session = state.recordingSessions.get(sessionId);
    if (!session) {
      throw new Error(`Recording session ${sessionId} not found`);
    }

    // Stop recording on device
    const result = await deviceInfo.device.stopRecording();
    
    if (result.success) {
      // Update session
      const updatedSession = sessionManager.updateRecordingSession(sessionId, {
        status: 'completed',
        endTime: Date.now(),
        duration: Date.now() - session.startTime
      });

      // Notify progress callbacks
      eventNotifier.notifyRecordingProgress({
        event: 'completed',
        sessionId,
        deviceId: session.deviceId,
        recordingId: session.recordingId,
        duration: updatedSession.duration,
        timestamp: Date.now()
      });
    }

    return { success: result.success, session };
  };

  return {
    startRecording,
    stopRecording
  };
};
