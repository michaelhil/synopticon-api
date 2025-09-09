/**
 * Eye Tracking Pipeline Wrapper
 * Integrates the eye tracking system with the main pipeline orchestrator
 * Following functional programming patterns with factory functions
 */

import { createPipeline } from '../../../../core/pipeline/pipeline.js';
import { createPipelineConfig } from '../../../../core/pipeline/pipeline-config.js';
import { createImageProcessor } from '../../../../core/engine/image-processor.js';
import { getGlobalResourcePool } from '../../../../core/performance/resource-pool.js';
import { createEyeTracker } from '../../index.js';
import { Capability, createEyeTrackingResult, createGazeData, createPerformanceProfile } from '../../../../core/configuration/types.js';
import { ErrorCategory, ErrorSeverity, handleError } from "../../../../shared/utils/error-handler.js";

// Pipeline configuration and result types
interface EyeTrackingPipelineConfig {
  useMockDevices?: boolean;
  autoConnect?: boolean;
  autoCalibrate?: boolean;
  mockCalibrationDelay?: number;
  eyeTracking?: any;
}

interface DeviceStatus {
  connected: boolean;
  calibrated: boolean;
  streaming: boolean;
  deviceId: string | null;
}

interface QualityMetrics {
  level: string;
  confidence: number;
  dataAvailable: boolean;
}

interface ProcessingMetadata {
  processingTime: number;
  totalFramesProcessed?: number;
  averageConfidence?: number;
  calibrationStatus?: string;
  error?: boolean;
}

interface EyeTrackingResult {
  timestamp: number;
  source: string;
  gazeData: any[];
  deviceStatus?: DeviceStatus;
  quality?: QualityMetrics;
  metadata?: ProcessingMetadata;
  error?: string;
}

interface PipelineState {
  eyeTracker: any;
  currentDeviceId: string | null;
  isCalibrated: boolean;
  lastGazeData: any;
  imageProcessor: any;
  resourcePool: any;
  isInitialized: boolean;
  config: any;
  connected: boolean;
  streaming: boolean;
  sessionActive: boolean;
  calibrationStatus: string;
  lastProcessingTime: number;
  totalFramesProcessed: number;
  averageConfidence: number;
  deviceInfo: any;
}

interface EyeTrackingPipeline {
  name: string;
  capabilities: string[];
  performance: any;
  initialize(initConfig?: any): Promise<boolean>;
  process(imageData: any, options?: any): Promise<EyeTrackingResult>;
  cleanup(): void;
  getConfig(): any;
  updateConfig(updates: any): void;
  isInitialized(): boolean;
  getHealthStatus(): any;
  startRecording(recordingId: string): Promise<any>;
  stopRecording(): Promise<any>;
  performCalibration(): Promise<boolean>;
  getCapabilities(): string[];
  getStatus(): any;
  getEyeTracker(): any;
}

interface PipelineFactory {
  name: string;
  description: string;
  capabilities: string[];
  create: (config?: EyeTrackingPipelineConfig) => EyeTrackingPipeline;
  requiresHardware: boolean;
  supportsRealtime: boolean;
  supportsCalibration: boolean;
}

// Eye tracking pipeline factory
export const createEyeTrackingPipeline = (userConfig: EyeTrackingPipelineConfig = {}): EyeTrackingPipeline => {
  // Use unified configuration system
  const config = createPipelineConfig('eye-tracking', userConfig);

  const state: PipelineState = {
    eyeTracker: null,
    currentDeviceId: null,
    isCalibrated: false,
    lastGazeData: null,
    imageProcessor: null,
    resourcePool: null,
    isInitialized: false,
    config,
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
  const initialize = async (initConfig: any = {}): Promise<boolean> => {
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
    } catch (error: any) {
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
  const autoConnectToDevice = async (): Promise<void> => {
    try {
      await state.eyeTracker.autoConnectToFirstDevice();
      const connectedDevices = state.eyeTracker.getConnectedDevices();
      
      if (connectedDevices.length > 0) {
        state.currentDeviceId = connectedDevices[0];
        state.connected = true;
        state.deviceInfo = await state.eyeTracker.getDeviceStatus(state.currentDeviceId);
        
        // Start streaming
        await startStreaming();
        
        // Auto-calibrate if enabled
        if (state.config.autoCalibrate !== false) {
          await performCalibration();
        }
      }
    } catch (error: any) {
      console.warn('Auto-connect to eye tracker failed:', error.message);
      // Continue without device - can use mock data
    }
  };

  // Setup event handlers for pipeline integration
  const setupEventHandlers = (): void => {
    // Handle gaze data
    state.eyeTracker.onGazeData((gazeData: any) => {
      state.lastGazeData = gazeData;
      state.streaming = true;
      
      // Update statistics
      state.totalFramesProcessed++;
      if (gazeData.confidence) {
        state.averageConfidence = (state.averageConfidence * (state.totalFramesProcessed - 1) + 
          gazeData.confidence) / state.totalFramesProcessed;
      }
    });

    // Handle device connection changes
    state.eyeTracker.onDeviceStatusChange((event: any) => {
      if (event.event === 'connected') {
        state.connected = true;
        state.currentDeviceId = event.deviceId;
      } else if (event.event === 'disconnected') {
        state.connected = false;
        state.streaming = false;
        state.currentDeviceId = null;
      }
    });

    // Handle calibration updates
    state.eyeTracker.onCalibrationProgress((update: any) => {
      if (update.event === 'completed') {
        state.isCalibrated = true;
        state.calibrationStatus = 'completed';
      } else if (update.event === 'started') {
        state.calibrationStatus = 'in_progress';
      }
    });
  };

  // Start gaze data streaming
  const startStreaming = async (): Promise<void> => {
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
  const performCalibration = async (): Promise<boolean> => {
    if (!state.currentDeviceId) return false;

    try {
      state.calibrationStatus = 'starting';
      const result = await state.eyeTracker.startCalibration(state.currentDeviceId);
      
      if (result.success) {
        // Wait for calibration to complete (auto-handled by mock devices)
        // Reduced for better test performance
        const calibrationDelay = state.config.mockCalibrationDelay || 200;
        await new Promise(resolve => setTimeout(resolve, calibrationDelay));
        
        const stopResult = await state.eyeTracker.stopCalibration(state.currentDeviceId, result.sessionId);
        if (stopResult.success) {
          state.isCalibrated = true;
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
  const process = async (imageData: any, options: any = {}): Promise<EyeTrackingResult> => {
    const startTime = performance.now();

    try {
      // Ensure system is ready
      if (!state.isInitialized) {
        throw new Error('Eye tracking pipeline not initialized');
      }

      // Get current gaze data
      let gazeData = state.lastGazeData;
      let confidence = 0;
      let quality = 'no_data';

      if (gazeData && state.streaming) {
        // Use real gaze data
        confidence = gazeData.confidence || 0;
        quality = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
      } else if (state.config.useMockDevices !== false) {
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
          calibrated: state.isCalibrated,
          streaming: state.streaming,
          deviceId: state.currentDeviceId
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

    } catch (error: any) {
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
  const generateMockGazeData = (): any => {
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
  const getCapabilities = (): string[] => [
    Capability.EYE_TRACKING,
    Capability.GAZE_ESTIMATION,
    Capability.DEVICE_CONTROL
  ];

  // Get pipeline status
  const getStatus = () => ({
    ...state,
    isCalibrated: state.isCalibrated,
    currentDeviceId: state.currentDeviceId,
    lastGazeAvailable: state.lastGazeData !== null,
    lastGazeTimestamp: state.lastGazeData?.timestamp || null
  });

  // Start recording session
  const startRecording = async (recordingId: string): Promise<any> => {
    if (!state.currentDeviceId) {
      throw new Error('No eye tracking device connected');
    }

    const result = await state.eyeTracker.startRecording(state.currentDeviceId, { recordingId });
    if (result.success) {
      state.sessionActive = true;
    }
    return result;
  };

  // Stop recording session
  const stopRecording = async (): Promise<any> => {
    if (!state.currentDeviceId || !state.sessionActive) {
      return { success: false, reason: 'No active recording session' };
    }

    const result = await state.eyeTracker.stopRecording(state.currentDeviceId);
    if (result.success) {
      state.sessionActive = false;
    }
    return result;
  };

  // Cleanup pipeline resources
  const cleanup = (): void => {
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
    updateConfig: (updates: any) => {
      state.config = { ...state.config, ...updates };
    },
    isInitialized: () => state.isInitialized,
    getHealthStatus: () => ({
      healthy: state.eyeTracker && state.eyeTracker.getStatus().connected,
      runtime: 'universal', // Works in both browser and Node.js
      backend: 'pupil-labs-neon',
      modelLoaded: Boolean(state.eyeTracker),
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
export const createEyeTrackingPipelineFactory = (): PipelineFactory => ({
  name: 'eye-tracking',
  description: 'Pupil Labs Neon eye tracker integration pipeline',
  capabilities: [Capability.EYE_TRACKING, Capability.GAZE_ESTIMATION, Capability.DEVICE_CONTROL],
  create: createEyeTrackingPipeline,
  requiresHardware: false, // Can work with mock devices
  supportsRealtime: true,
  supportsCalibration: true
});