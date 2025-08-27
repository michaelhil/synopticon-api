/**
 * Core System Types
 * Fundamental types and interfaces used across the entire system
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

// Performance and health types
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

// Basic geometry types
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

// Base analysis interfaces
export interface BaseAnalysisResult {
  readonly success: boolean;
  readonly confidence: number;
  readonly timestamp: number;
  readonly processingTime: number;
  readonly metadata?: Record<string, unknown>;
}

export type AnalysisResult<T = unknown> = BaseAnalysisResult & {
  readonly data: T;
  readonly error?: string;
};

// Error handling
export interface ErrorResult {
  readonly success: false;
  readonly error: string;
  readonly code?: string;
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
  readonly retryable?: boolean;
  readonly severity?: 'low' | 'medium' | 'high' | 'critical';
}