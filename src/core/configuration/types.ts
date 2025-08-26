/**
 * Core types and interfaces for the face analysis pipeline system
 * TypeScript-native implementation with strict typing
 */

// Capability types that pipelines can provide
export const Capability = {
  FACE_DETECTION: 'face_detection',
  POSE_ESTIMATION_3DOF: 'pose_3dof', 
  POSE_ESTIMATION_6DOF: 'pose_6dof',
  EYE_TRACKING: 'eye_tracking',
  EXPRESSION_ANALYSIS: 'expression',
  LANDMARK_DETECTION: 'landmarks',
  DEPTH_ESTIMATION: 'depth',
  AGE_ESTIMATION: 'age_estimation',
  GENDER_DETECTION: 'gender_detection',
  GAZE_ESTIMATION: 'gaze_estimation',
  DEVICE_CONTROL: 'device_control',
  SPEECH_RECOGNITION: 'speech_recognition',
  SPEECH_ANALYSIS: 'speech_analysis',
  CONVERSATION_CONTEXT: 'conversation_context',
  MULTI_PROMPT_ANALYSIS: 'multi_prompt_analysis',
  REAL_TIME_TRANSCRIPTION: 'real_time_transcription'
} as const;

export type CapabilityType = typeof Capability[keyof typeof Capability];

// Performance profile interfaces
export type ModelSize = 'small' | 'medium' | 'large' | 'extra_large' | 'unknown';
export type UsageLevel = 'low' | 'medium' | 'high';
export type HealthStatusType = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface PerformanceProfile {
  readonly fps: number;
  readonly latency: string;
  readonly modelSize: ModelSize;
  readonly cpuUsage: UsageLevel;
  readonly memoryUsage: UsageLevel;
  readonly batteryImpact: UsageLevel;
}

export interface HealthStatus {
  readonly status: HealthStatusType;
  readonly lastCheck: number;
  readonly errorCount: number;
  readonly successRate: number;
  readonly averageLatency: number;
  readonly isCircuitOpen: boolean;
}

export interface PerformanceMetrics {
  readonly processedFrames: number;
  readonly averageProcessingTime: number;
  readonly currentFPS: number;
  readonly peakMemoryUsage: number;
  readonly gcPressure: number;
  readonly droppedFrames: number;
  readonly qualityScore: number;
  readonly timestamp: number;
}

// Point and geometry types
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly confidence?: number;
}

// Pose estimation types
export interface Pose3DOF {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly confidence: number;
  readonly timestamp: number;
}

export interface Pose6DOF {
  readonly translation: Point3D;
  readonly rotation: {
    readonly yaw: number;
    readonly pitch: number;
    readonly roll: number;
  };
  readonly confidence: number;
  readonly timestamp: number;
  readonly rotationMatrix?: ReadonlyArray<ReadonlyArray<number>>;
}

// Face analysis results
export interface FaceDetection {
  readonly boundingBox: BoundingBox;
  readonly landmarks?: ReadonlyArray<Point2D>;
  readonly keypoints?: ReadonlyArray<Point3D>;
  readonly confidence: number;
  readonly faceId?: string;
  readonly timestamp: number;
}

export interface EyeResult {
  readonly position: Point2D;
  readonly openness: number;
  readonly gazeDirection?: Point3D;
  readonly pupilDilation?: number;
  readonly blinkState?: 'open' | 'closed' | 'partial';
  readonly confidence: number;
}

export interface EmotionResult {
  readonly emotion: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'fear' | 'disgust';
  readonly confidence: number;
  readonly intensityScore?: number;
  readonly valence?: number;
  readonly arousal?: number;
}

export interface AgeResult {
  readonly estimatedAge: number;
  readonly ageRange?: {
    readonly min: number;
    readonly max: number;
  };
  readonly confidence: number;
}

export interface GenderResult {
  readonly gender: 'male' | 'female' | 'unknown';
  readonly confidence: number;
  readonly genderScore?: number;
}

// Analysis result containers
export interface FaceResult {
  readonly detection: FaceDetection;
  readonly pose?: Pose3DOF;
  readonly pose6DOF?: Pose6DOF;
  readonly eyes?: {
    readonly left: EyeResult;
    readonly right: EyeResult;
  };
  readonly expression?: EmotionResult;
  readonly age?: AgeResult;
  readonly gender?: GenderResult;
  readonly landmarks?: ReadonlyArray<Point2D>;
  readonly quality?: {
    readonly blur: number;
    readonly illumination: number;
    readonly angle: number;
  };
}

// Base result interface for discriminated union
export interface BaseAnalysisResult {
  readonly id: string;
  readonly timestamp: number;
  readonly processingTime: number;
  readonly source: string;
  readonly metadata?: Record<string, unknown>;
}

// Discriminated union for analysis results
export type AnalysisResult<T = unknown> = 
  | (BaseAnalysisResult & { readonly status: 'success'; readonly data: T })
  | (BaseAnalysisResult & { readonly status: 'partial'; readonly data: Partial<T>; readonly missing: ReadonlyArray<string> })
  | (BaseAnalysisResult & { readonly status: 'failed' | 'timeout' | 'unsupported'; readonly error: ErrorResult });

// Specific face analysis result data
export interface FaceAnalysisData {
  readonly faces: ReadonlyArray<FaceResult>;
  readonly metadata: {
    readonly processingTime: number;
    readonly algorithm: string;
    readonly modelVersion: string;
    readonly imageSize: {
      readonly width: number;
      readonly height: number;
    };
    readonly timestamp: number;
  };
  readonly performance: PerformanceMetrics;
  readonly errors?: ReadonlyArray<string>;
}

// Speech analysis types
export interface SpeechAnalysisResult {
  readonly transcript: string;
  readonly confidence: number;
  readonly emotion?: EmotionResult;
  readonly speakerId?: string;
  readonly segments: ReadonlyArray<{
    readonly start: number;
    readonly end: number;
    readonly text: string;
    readonly confidence: number;
  }>;
  readonly audioQuality: {
    readonly snr: number;
    readonly clarity: number;
    readonly volume: number;
  };
  readonly timestamp: number;
}

export interface SpeechEvent {
  readonly type: 'speech_start' | 'speech_end' | 'word_boundary' | 'silence_detected';
  readonly timestamp: number;
  readonly confidence: number;
  readonly data?: Record<string, unknown>;
}

// Configuration and requirements
export interface AnalysisRequirements {
  readonly capabilities: ReadonlyArray<CapabilityType>;
  readonly strategy?: 'performance_first' | 'accuracy_first' | 'battery_optimized' | 'hybrid' | 'adaptive' | 'balanced';
  readonly performance?: Partial<PerformanceProfile>;
  readonly quality?: {
    readonly minConfidence: number;
    readonly maxLatency: number;
    readonly requiredFPS: number;
    readonly realtime?: boolean;
  };
  readonly constraints?: {
    readonly maxFaces?: number;
    readonly minFaceSize?: number;
    readonly trackingEnabled?: boolean;
  };
}

export interface PipelineConfig {
  readonly name: string;
  readonly type: string;
  readonly version: string;
  readonly capabilities: ReadonlyArray<CapabilityType>;
  readonly performance: PerformanceProfile;
  readonly options?: Record<string, unknown>;
  readonly dependencies?: ReadonlyArray<string>;
  readonly metadata?: Record<string, unknown>;
}

// Error handling
export interface ErrorResult {
  readonly error: true;
  readonly message: string;
  readonly code: string;
  readonly timestamp: number;
  readonly source: string;
  readonly details?: Record<string, unknown>;
  readonly stack?: string;
}

// Stream capabilities
export const StreamCapability = {
  REAL_TIME_PROCESSING: 'real_time_processing',
  BATCH_PROCESSING: 'batch_processing', 
  AUDIO_STREAMING: 'audio_streaming',
  VIDEO_STREAMING: 'video_streaming',
  BIDIRECTIONAL: 'bidirectional',
  MULTIPLEXED: 'multiplexed'
} as const;

export type StreamCapabilityType = typeof StreamCapability[keyof typeof StreamCapability];

// Additional result types
export interface AudioResult {
  readonly audioData: Float32Array;
  readonly sampleRate: number;
  readonly channels: number;
  readonly timestamp: number;
  readonly quality: {
    readonly snr: number;
    readonly thd: number;
    readonly peakLevel: number;
  };
}

export interface MotionResult {
  readonly acceleration: Point3D;
  readonly gyroscope: Point3D;
  readonly magnetometer?: Point3D;
  readonly timestamp: number;
  readonly deviceOrientation?: {
    readonly alpha: number;
    readonly beta: number;
    readonly gamma: number;
  };
}

export interface SensorResult {
  readonly sensorType: string;
  readonly value: number | Point2D | Point3D;
  readonly unit: string;
  readonly timestamp: number;
  readonly accuracy?: number;
}

export interface SimulatorResult {
  readonly simulatedData: Record<string, unknown>;
  readonly timestamp: number;
  readonly fidelity: number;
  readonly randomSeed?: number;
}

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

// Type guards
export const isErrorResult = (result: unknown): result is ErrorResult => {
  return typeof result === 'object' && result !== null && 'error' in result && result.error === true;
};

export const isFaceResult = (result: unknown): result is FaceResult => {
  return typeof result === 'object' && result !== null && 'detection' in result;
};

export const isAnalysisResult = (result: unknown): result is AnalysisResult => {
  return typeof result === 'object' && result !== null && 'faces' in result && 'metadata' in result;
};
/**
 * Gaze Semantics Configuration Interface
 */
export interface GazeSemanticsConfig {
  region?: string;
  quality?: string;
  description?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * Gaze Semantics Result Interface
 */
export interface GazeSemantics {
  region: string;
  quality: string;
  description: string;
  confidence: number;
  timestamp: number;
  metadata: Record<string, any>;
}

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

/**
 * Analysis Pipeline Result Metadata Interface
 */
export interface AnalysisPipelineMetadata {
  processingTime?: number;
  pipeline?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Analysis Pipeline Result Interface
 */
export interface AnalysisPipelineResult<T = any> {
  success: boolean;
  data: T;
  metadata: AnalysisPipelineMetadata;
  pipeline: string;
}

/**
 * Analysis Pipeline Result - Missing export
 */
export const createAnalysisPipelineResult = <T = any>(
  data: T | { success?: boolean; data?: T }, 
  metadata: AnalysisPipelineMetadata = {}
): AnalysisPipelineResult<T> => ({
  success: (data as any)?.success ?? true,
  data: (data as any)?.data || data as T,
  metadata: {
    timestamp: Date.now(),
    processingTime: metadata.processingTime || 0,
    ...metadata
  },
  pipeline: metadata.pipeline || 'unknown'
});

/**
 * Analysis Prompt Result Interface
 */
export interface AnalysisPromptResult {
  prompt: string;
  response: string;
  confidence: number;
  metadata: Record<string, any>;
}

/**
 * Create Analysis Prompt Result
 */
export const createAnalysisPromptResult = (config: {
  prompt: string;
  response: string;
  confidence?: number;
  metadata?: Record<string, any>;
}): AnalysisPromptResult => ({
  prompt: config.prompt,
  response: config.response,
  confidence: config.confidence || 0.8,
  metadata: config.metadata || {}
});

/**
 * Eye State Interface for individual eye data
 */
export interface EyeState {
  center: [number, number];
  pupil: [number, number];
  landmarks?: number[][];
  gazeVector?: [number, number, number];
  openness: number;
  pupilDiameter?: number;
}

/**
 * Create Eye State factory function
 */
export const createEyeState = (config: Partial<EyeState> = {}): EyeState => ({
  center: config.center || [0, 0],
  pupil: config.pupil || [0, 0],
  landmarks: config.landmarks || [],
  gazeVector: config.gazeVector || [0, 0, -1],
  openness: config.openness || 1.0,
  pupilDiameter: config.pupilDiameter || 3.0
});

/**
 * Gaze Data Interface for processed gaze information
 */
export interface GazeData {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
  worn?: boolean;
  eyeStates?: {
    left?: EyeState;
    right?: EyeState;
  };
  semantic?: GazeSemantics;
  metadata?: Record<string, any>;
}

/**
 * Create Gaze Data factory function
 */
export const createGazeData = (config: Partial<GazeData> = {}): GazeData => ({
  x: config.x || 0,
  y: config.y || 0,
  confidence: config.confidence || 0,
  timestamp: config.timestamp || Date.now(),
  worn: config.worn !== false,
  eyeStates: config.eyeStates || {},
  semantic: config.semantic,
  metadata: config.metadata || {}
});

/**
 * Eye Tracking Result Interface for complete eye tracking data
 */
export interface EyeTrackingResult {
  timestamp: number;
  source: string;
  gazeData: GazeData[];
  deviceStatus?: {
    connected: boolean;
    calibrated: boolean;
    streaming: boolean;
    deviceId: string | null;
  };
  quality?: {
    level: string;
    confidence: number;
    dataAvailable: boolean;
  };
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Create Eye Tracking Result factory function
 */
export const createEyeTrackingResult = (config: Partial<EyeTrackingResult> = {}): EyeTrackingResult => ({
  timestamp: config.timestamp || Date.now(),
  source: config.source || 'eye_tracking',
  gazeData: config.gazeData || [],
  deviceStatus: config.deviceStatus,
  quality: config.quality,
  metadata: config.metadata || {},
  error: config.error
});

/**
 * Device Status Interface for eye tracking devices
 */
export interface DeviceStatus {
  deviceId: string;
  connectionState: string;
  lastHeartbeat?: number;
  connectedAt?: number;
  deviceInfo?: Record<string, any>;
}

/**
 * Create Device Status factory function
 */
export const createDeviceStatus = (config: Partial<DeviceStatus> = {}): DeviceStatus => ({
  deviceId: config.deviceId || 'unknown',
  connectionState: config.connectionState || 'disconnected',
  lastHeartbeat: config.lastHeartbeat,
  connectedAt: config.connectedAt,
  deviceInfo: config.deviceInfo || {}
});

/**
 * Calibration Result Interface for calibration data
 */
export interface CalibrationResult {
  sessionId?: string;
  status: string;
  quality?: string;
  accuracy?: string;
  timestamp: number;
  metrics?: Record<string, any>;
  recommendations?: any[];
}

/**
 * Create Calibration Result factory function
 */
export const createCalibrationResult = (config: Partial<CalibrationResult> = {}): CalibrationResult => ({
  sessionId: config.sessionId,
  status: config.status || 'unknown',
  quality: config.quality,
  accuracy: config.accuracy,
  timestamp: config.timestamp || Date.now(),
  metrics: config.metrics,
  recommendations: config.recommendations || []
});
