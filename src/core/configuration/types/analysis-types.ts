/**
 * Analysis Result Types
 * Types for face detection, emotion analysis, and analysis result containers
 */

import { Point2D, Point3D, BoundingBox, Pose3DOF, Pose6DOF } from './geometry-types.js';
import { PerformanceMetrics, CapabilityType } from './index.js';

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