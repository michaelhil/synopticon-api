/**
 * Eye Tracking Calibration Control Module  
 * Handles calibration start/stop operations and progress tracking
 */

export const createCalibrationController = (state, sessionManager, eventNotifier) => {
  // Setup calibration update handler for a device
  const setupCalibrationUpdateHandler = (device, sessionId) => {
    device.onCalibrationUpdate((calibrationResult) => {
      const session = state.calibrationSessions.get(sessionId);
      if (session) {
        const updates = {
          lastUpdate: Date.now(),
          result: calibrationResult
        };
        
        if (calibrationResult.status === 'completed' || calibrationResult.status === 'failed') {
          updates.status = calibrationResult.status;
          updates.endTime = Date.now();
        }

        sessionManager.updateCalibrationSession(sessionId, updates);

        // Notify progress callbacks
        eventNotifier.notifyCalibrationProgress({
          event: 'update',
          sessionId,
          deviceId: session.deviceId,
          calibrationResult,
          timestamp: Date.now()
        });
      }
    });
  };

  // Calibration Control API
  const startCalibration = async (deviceId, calibrationConfig = {}) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    // Start calibration on device
    const result = await deviceInfo.device.startCalibration();
    
    if (result.success) {
      // Track calibration session
      const session = sessionManager.createCalibrationSession(
        deviceId, 
        result.calibrationId, 
        calibrationConfig
      );

      // Setup calibration update handler
      setupCalibrationUpdateHandler(deviceInfo.device, session.sessionId);

      // Notify start
      eventNotifier.notifyCalibrationProgress({
        event: 'started',
        sessionId: session.sessionId,
        deviceId,
        timestamp: Date.now()
      });
    }

    return { success: result.success, sessionId: result.success ? session.sessionId : null };
  };

  const stopCalibration = async (deviceId, sessionId = null) => {
    const deviceInfo = state.activeDevices.get(deviceId);
    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    // Find session if not provided
    if (!sessionId) {
      const activeSession = sessionManager.findActiveCalibrationSession(deviceId);
      if (!activeSession) {
        throw new Error('No active calibration session found');
      }
      sessionId = activeSession.sessionId;
    }

    const session = state.calibrationSessions.get(sessionId);
    if (!session) {
      throw new Error(`Calibration session ${sessionId} not found`);
    }

    // Stop calibration on device
    const result = await deviceInfo.device.stopCalibration();
    
    if (result.success) {
      // Update session
      sessionManager.updateCalibrationSession(sessionId, {
        status: result.result.status,
        endTime: Date.now(),
        result: result.result
      });

      // Notify progress callbacks
      eventNotifier.notifyCalibrationProgress({
        event: 'completed',
        sessionId,
        deviceId: session.deviceId,
        result: session.result,
        timestamp: Date.now()
      });
    }

    return { success: result.success, session };
  };

  return {
    startCalibration,
    stopCalibration
  };
};
