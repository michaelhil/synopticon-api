/**
 * Factory Functions
 * Factory functions for creating typed configuration and result objects
 */

import { 
  PerformanceProfile, 
  HealthStatus, 
  PerformanceMetrics 
} from './performance-types.js';

import {
  AnalysisResult,
  BaseAnalysisResult,
  FaceResult,
  ErrorResult,
  SpeechAnalysisResult,
  SpeechEvent
} from './analysis-types.js';

import {
  Pose3DOF,
  Pose6DOF
} from './geometry-types.js';

import {
  EyeResult,
  EmotionResult,
  AgeResult,
  GenderResult
} from './analysis-types.js';

import {
  AnalysisRequirements,
  PipelineConfig
} from './pipeline-types.js';

import {
  AudioResult,
  MotionResult,
  SensorResult,
  SimulatorResult,
  GazeSemantics,
  GazeSemanticsConfig
} from './sensor-types.js';

// Factory functions with proper typing
export const createPerformanceProfile = (config: Partial<PerformanceProfile> = {}): PerformanceProfile => ({
  fps: 30,
  latency: '50ms',
  modelSize: 'medium',
  cpuUsage: 'medium',
  memoryUsage: 'medium',
  batteryImpact: 'medium',
  ...config
});

export const createHealthStatus = (config: Partial<HealthStatus> = {}): HealthStatus => ({
  status: 'healthy',
  lastCheck: Date.now(),
  errorCount: 0,
  successRate: 1.0,
  averageLatency: 0,
  isCircuitOpen: false,
  ...config
});

export const createPerformanceMetrics = (config: Partial<PerformanceMetrics> = {}): PerformanceMetrics => ({
  processedFrames: 0,
  averageProcessingTime: 0,
  currentFPS: 0,
  peakMemoryUsage: 0,
  gcPressure: 0,
  droppedFrames: 0,
  qualityScore: 1.0,
  timestamp: Date.now(),
  ...config
});

// Factory function for creating analysis results with discriminated union
export const createAnalysisResult = <T = unknown>(config: Partial<BaseAnalysisResult> & (
  | { status: 'success'; data: T }
  | { status: 'partial'; data: Partial<T>; missing: ReadonlyArray<string> }
  | { status: 'failed' | 'timeout' | 'unsupported'; error: ErrorResult }
)): AnalysisResult<T> => {
  const base: BaseAnalysisResult = {
    id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    processingTime: 0,
    source: 'unknown',
    ...config
  };

  return { ...base, ...config } as AnalysisResult<T>;
};

export const createFaceResult = (config: Partial<FaceResult>): FaceResult => ({
  detection: {
    boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    confidence: 0,
    timestamp: Date.now(),
    ...config.detection
  },
  ...config
});

export const createPose3DOF = (config: Partial<Pose3DOF> = {}): Pose3DOF => ({
  yaw: 0,
  pitch: 0,
  roll: 0,
  confidence: 0,
  timestamp: Date.now(),
  ...config
});

export const createPose6DOF = (config: Partial<Pose6DOF> = {}): Pose6DOF => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
  confidence: 0,
  timestamp: Date.now(),
  ...config
});

export const createEyeResult = (config: Partial<EyeResult> = {}): EyeResult => ({
  position: { x: 0, y: 0 },
  openness: 1.0,
  confidence: 0,
  ...config
});

export const createEmotionResult = (config: Partial<EmotionResult> = {}): EmotionResult => ({
  emotion: 'neutral',
  confidence: 0,
  ...config
});

export const createAgeResult = (config: Partial<AgeResult> = {}): AgeResult => ({
  estimatedAge: 25,
  confidence: 0,
  ...config
});

export const createGenderResult = (config: Partial<GenderResult> = {}): GenderResult => ({
  gender: 'unknown',
  confidence: 0,
  ...config
});

export const createSpeechAnalysisResult = (config: Partial<SpeechAnalysisResult>): SpeechAnalysisResult => ({
  transcript: '',
  confidence: 0,
  segments: [],
  audioQuality: {
    snr: 0,
    clarity: 0,
    volume: 0,
    ...config.audioQuality
  },
  timestamp: Date.now(),
  ...config
});

export const createSpeechEvent = (config: Partial<SpeechEvent>): SpeechEvent => ({
  type: 'speech_start',
  timestamp: Date.now(),
  confidence: 0,
  ...config
});

export const createAnalysisRequirements = (config: Partial<AnalysisRequirements>): AnalysisRequirements => ({
  capabilities: [],
  ...config
});

export const createPipelineConfig = (config: Partial<PipelineConfig>): PipelineConfig => ({
  name: 'unknown',
  type: 'unknown',
  version: '1.0.0',
  capabilities: [],
  performance: createPerformanceProfile(),
  ...config
});

export const createErrorResult = (error: string | Error, source = 'unknown'): ErrorResult => {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;
  
  return {
    error: true,
    message,
    code: 'PIPELINE_ERROR',
    timestamp: Date.now(),
    source,
    stack
  };
};

export const createAudioResult = (config: Partial<AudioResult>): AudioResult => ({
  audioData: new Float32Array(0),
  sampleRate: 44100,
  channels: 1,
  timestamp: Date.now(),
  quality: {
    snr: 0,
    thd: 0,
    peakLevel: 0,
    ...config.quality
  },
  ...config
});

export const createMotionResult = (config: Partial<MotionResult> = {}): MotionResult => ({
  acceleration: { x: 0, y: 0, z: 0 },
  gyroscope: { x: 0, y: 0, z: 0 },
  timestamp: Date.now(),
  ...config
});

export const createSensorResult = (config: Partial<SensorResult>): SensorResult => ({
  sensorType: 'unknown',
  value: 0,
  unit: '',
  timestamp: Date.now(),
  ...config
});

export const createSimulatorResult = (config: Partial<SimulatorResult> = {}): SimulatorResult => ({
  simulatedData: {},
  timestamp: Date.now(),
  fidelity: 1.0,
  ...config
});

/**
 * Gaze Semantics - Missing export for eye tracking
 */
export const createGazeSemantics = (config: GazeSemanticsConfig = {}): GazeSemantics => ({
  region: config.region || 'center',
  quality: config.quality || 'medium',
  description: config.description || 'Gaze data semantic interpretation',
  confidence: config.confidence || 0.5,
  timestamp: Date.now(),
  metadata: config.metadata || {}
});