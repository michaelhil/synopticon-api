/**
 * Eye Tracking Pipeline Wrapper
 * Integrates the eye tracking system with the main pipeline orchestrator
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../../core/pipeline.js';
import { createPipelineConfig } from '../../core/pipeline-config.js';
import { createImageProcessor } from '../../core/image-processor.js';
import { getGlobalResourcePool } from '../../core/resource-pool.js';
import { createEyeTracker } from '../eye-tracking/index.js';
import { createEyeTrackingResult, createGazeData, Capability, createPerformanceProfile } from '../../core/types.js';
import { handleError, ErrorCategory, ErrorSeverity } from '../../shared/utils/error-handler.js';

// Eye tracking pipeline factory
export const createEyeTrackingPipeline = (userConfig = {}) => {
  // Use unified configuration system
  const config = createPipelineConfig('eye-tracking', userConfig);

  const state = {
    eyeTracker: null,
    currentDeviceId: null,
    isCalibrated: false,
    lastGazeData: null,
    imageProcessor: null,
    resourcePool: null,
    isInitialized: false,
    config: config,
    // Pipeline-specific state
    connected: false,
    streaming: false,
    sessionActive: false,
    calibrationStatus: 'not_started',
    lastProcessingTime: 0,
    totalFramesProcessed: 0,
    averageConfidence: 0,
    deviceInfo: null
  };

  // Initialize the eye tracking system
  const initialize = async (initConfig = {}) => {
    if (state.isInitialized) return true;

    try {
      handleError(
        'Initializing Eye Tracking pipeline',
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.INFO,
        { config: state.config }
      );

      // Initialize shared resources
      state.resourcePool = getGlobalResourcePool();
      state.imageProcessor = createImageProcessor({ resourcePool: state.resourcePool });

      // Merge pipeline config with options
      const eyeTrackerConfig = {
        useMockDevices: state.config.useMockDevices !== false,
        autoStart: true,
        enableSynchronization: true,
        ...initConfig.eyeTracking
      };

      state.eyeTracker = createEyeTracker(eyeTrackerConfig);
      await state.eyeTracker.initialize();

      // Setup event handlers for pipeline integration
      setupEventHandlers();

      state.isInitialized = true;
      console.log('✅ Eye tracking pipeline initialized successfully');

      // Auto-connect if enabled
      if (state.config.autoConnect !== false) {
        await autoConnectToDevice();
      }

      return true;
    } catch (error) {
      handleError(
        `Eye tracking pipeline initialization failed: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        ErrorSeverity.ERROR,
        { error }
      );
      throw new Error(`Eye tracking pipeline initialization failed: ${error.message}`);
    }
  };

  // Auto-connect to first available device
  const autoConnectToDevice = async () => {
    try {
      await eyeTracker.autoConnectToFirstDevice();
      const connectedDevices = eyeTracker.getConnectedDevices();
      
      if (connectedDevices.length > 0) {
        currentDeviceId = connectedDevices[0];
        state.connected = true;
        state.deviceInfo = await eyeTracker.getDeviceStatus(currentDeviceId);
        
        // Start streaming
        await startStreaming();
        
        // Auto-calibrate if enabled
        if (config.autoCalibrate !== false) {
          await performCalibration();
        }
      }
    } catch (error) {
      console.warn('Auto-connect to eye tracker failed:', error.message);
      // Continue without device - can use mock data
    }
  };

  // Setup event handlers for pipeline integration
  const setupEventHandlers = () => {
    // Handle gaze data
    eyeTracker.onGazeData((gazeData) => {
      lastGazeData = gazeData;
      state.streaming = true;
      
      // Update statistics
      state.totalFramesProcessed++;
      if (gazeData.confidence) {
        state.averageConfidence = (state.averageConfidence * (state.totalFramesProcessed - 1) + 
          gazeData.confidence) / state.totalFramesProcessed;
      }
    });

    // Handle device connection changes
    eyeTracker.onDeviceStatusChange((event) => {
      if (event.event === 'connected') {
        state.connected = true;
        currentDeviceId = event.deviceId;
      } else if (event.event === 'disconnected') {
        state.connected = false;
        state.streaming = false;
        currentDeviceId = null;
      }
    });

    // Handle calibration updates
    eyeTracker.onCalibrationProgress((update) => {
      if (update.event === 'completed') {
        isCalibrated = true;
        state.calibrationStatus = 'completed';
      } else if (update.event === 'started') {
        state.calibrationStatus = 'in_progress';
      }
    });
  };

  // Start gaze data streaming
  const startStreaming = async () => {
    if (!state.connected || state.streaming) return;

    try {
      // Streaming is handled automatically by device connection
      state.streaming = true;
      console.log('Eye tracking streaming started');
    } catch (error) {
      console.warn('Failed to start eye tracking streaming:', error);
    }
  };

  // Perform calibration
  const performCalibration = async () => {
    if (!currentDeviceId) return false;

    try {
      state.calibrationStatus = 'starting';
      const result = await eyeTracker.startCalibration(currentDeviceId);
      
      if (result.success) {
        // Wait for calibration to complete (auto-handled by mock devices)
        // Reduced for better test performance
        const calibrationDelay = state.config.mockCalibrationDelay || 200;
        await new Promise(resolve => setTimeout(resolve, calibrationDelay));
        
        const stopResult = await eyeTracker.stopCalibration(currentDeviceId, result.sessionId);
        if (stopResult.success) {
          isCalibrated = true;
          state.calibrationStatus = 'completed';
          console.log('Eye tracking calibration completed');
          return true;
        }
      }
      
      state.calibrationStatus = 'failed';
      return false;
    } catch (error) {
      console.warn('Eye tracking calibration failed:', error);
      state.calibrationStatus = 'failed';
      return false;
    }
  };

  // Main processing function - integrates with pipeline interface
  const process = async (imageData, options = {}) => {
    const startTime = performance.now();

    try {
      // Ensure system is ready
      if (!state.initialized) {
        throw new Error('Eye tracking pipeline not initialized');
      }

      // Get current gaze data
      let gazeData = lastGazeData;
      let confidence = 0;
      let quality = 'no_data';

      if (gazeData && state.streaming) {
        // Use real gaze data
        confidence = gazeData.confidence || 0;
        quality = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
      } else if (config.useMockDevices !== false) {
        // Generate mock gaze data for testing
        gazeData = generateMockGazeData();
        confidence = gazeData.confidence;
        quality = 'mock';
      } else {
        // No data available
        gazeData = null;
        confidence = 0;
        quality = 'unavailable';
      }

      // Create standardized result
      const result = createEyeTrackingResult({
        timestamp: Date.now(),
        source: 'eye_tracking_pipeline',
        gazeData: gazeData ? [gazeData] : [],
        deviceStatus: {
          connected: state.connected,
          calibrated: isCalibrated,
          streaming: state.streaming,
          deviceId: currentDeviceId
        },
        quality: {
          level: quality,
          confidence,
          dataAvailable: gazeData !== null
        },
        metadata: {
          processingTime: performance.now() - startTime,
          totalFramesProcessed: state.totalFramesProcessed,
          averageConfidence: state.averageConfidence,
          calibrationStatus: state.calibrationStatus
        }
      });

      state.lastProcessingTime = performance.now() - startTime;
      return result;

    } catch (error) {
      console.warn('Eye tracking pipeline processing error:', error);
      
      // Return error result
      return createEyeTrackingResult({
        timestamp: Date.now(),
        source: 'eye_tracking_pipeline',
        gazeData: [],
        error: error.message,
        quality: { level: 'error', confidence: 0, dataAvailable: false },
        metadata: {
          processingTime: performance.now() - startTime,
          error: true
        }
      });
    }
  };

  // Generate mock gaze data for testing
  const generateMockGazeData = () => {
    const time = Date.now() / 1000;
    return createGazeData({
      timestamp: Date.now(),
      x: 0.5 + Math.sin(time * 0.5) * 0.2,
      y: 0.5 + Math.cos(time * 0.3) * 0.15,
      confidence: 0.8 + Math.random() * 0.2,
      worn: true,
      eyeStates: {
        left: { pupilDiameter: 3.2 + Math.sin(time) * 0.2 },
        right: { pupilDiameter: 3.1 + Math.sin(time) * 0.2 }
      }
    });
  };

  // Get pipeline capabilities
  const getCapabilities = () => [
    Capability.EYE_TRACKING,
    Capability.GAZE_ESTIMATION,
    Capability.DEVICE_CONTROL
  ];

  // Get pipeline status
  const getStatus = () => ({
    ...state,
    isCalibrated,
    currentDeviceId,
    lastGazeAvailable: lastGazeData !== null,
    lastGazeTimestamp: lastGazeData?.timestamp || null
  });

  // Start recording session
  const startRecording = async (recordingId) => {
    if (!currentDeviceId) {
      throw new Error('No eye tracking device connected');
    }

    const result = await eyeTracker.startRecording(currentDeviceId, { recordingId });
    if (result.success) {
      state.sessionActive = true;
    }
    return result;
  };

  // Stop recording session
  const stopRecording = async () => {
    if (!currentDeviceId || !state.sessionActive) {
      return { success: false, reason: 'No active recording session' };
    }

    const result = await eyeTracker.stopRecording(currentDeviceId);
    if (result.success) {
      state.sessionActive = false;
    }
    return result;
  };

  // Cleanup pipeline resources
  const cleanup = () => {
    try {
      if (state.sessionActive && state.currentDeviceId) {
        state.eyeTracker.stopRecording(state.currentDeviceId);
      }
      
      if (state.eyeTracker) {
        state.eyeTracker.shutdown();
      }
      
      // Clean up image processor cache
      if (state.imageProcessor) {
        state.imageProcessor.cleanup();
      }
      
      // Reset state
      state.eyeTracker = null;
      state.currentDeviceId = null;
      state.isCalibrated = false;
      state.lastGazeData = null;
      state.isInitialized = false;
      state.connected = false;
      state.streaming = false;
      state.sessionActive = false;
      state.calibrationStatus = 'not_started';
      
      console.log('🧹 Eye tracking pipeline cleaned up');
    } catch (error) {
      console.warn('⚠️ Eye tracking pipeline cleanup error:', error);
    }
  };

  // Return standardized pipeline interface
  return createPipeline({
    name: 'eye-tracking',
    capabilities: [
      Capability.EYE_TRACKING,
      Capability.GAZE_ESTIMATION,
      Capability.DEVICE_CONTROL
    ],
    performance: createPerformanceProfile({
      fps: 30,
      latency: '5-15ms',
      modelSize: 'Variable (hardware)',
      cpuUsage: 'low',
      memoryUsage: 'medium',
      batteryImpact: 'high' // Hardware device
    }),
    initialize,
    process,
    cleanup,
    getConfig: () => state.config,
    updateConfig: (updates) => {
      state.config = { ...state.config, ...updates };
    },
    isInitialized: () => state.isInitialized,
    getHealthStatus: () => ({
      healthy: state.eyeTracker && state.eyeTracker.getStatus().connected,
      runtime: 'universal', // Works in both browser and Node.js
      backend: 'pupil-labs-neon',
      modelLoaded: !!state.eyeTracker,
      deviceConnected: state.eyeTracker ? state.eyeTracker.getStatus().connected : false
    }),
    
    // Eye tracking specific methods
    startRecording,
    stopRecording,
    performCalibration,
    getCapabilities,
    getStatus,
    getEyeTracker: () => state.eyeTracker
  });
};

// Factory function for pipeline registration
export const createEyeTrackingPipelineFactory = () => ({
  name: 'eye-tracking',
  description: 'Pupil Labs Neon eye tracker integration pipeline',
  capabilities: [Capability.EYE_TRACKING, Capability.GAZE_ESTIMATION, Capability.DEVICE_CONTROL],
  create: createEyeTrackingPipeline,
  requiresHardware: false, // Can work with mock devices
  supportsRealtime: true,
  supportsCalibration: true
});