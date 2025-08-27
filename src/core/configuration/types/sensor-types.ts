/**
 * Sensor and Device Result Types
 * Types for audio, motion, sensor, and simulation results
 */

import { Point2D, Point3D } from './geometry-types.js';

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