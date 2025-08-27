/**
 * Pipeline Configuration Types
 * Types for pipeline configuration, requirements, and stream capabilities
 */

import { CapabilityType } from './capability-types.js';
import { PerformanceProfile } from './performance-types.js';

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